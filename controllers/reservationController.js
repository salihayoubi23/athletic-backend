const Reservation = require('../models/reservationModel');
const Prestation = require('../models/prestationModel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const moment = require('moment');
const dotenv = require('dotenv');

dotenv.config();

exports.getUserReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find({ user: req.user._id }).populate('prestation').exec();
        res.json(reservations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations.' });
    }
};

exports.getAllReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find().populate('user prestation');
        res.json(reservations);
    } catch (err) {
        console.error('Erreur lors de la récupération des réservations:', err);
        res.status(500).json({ message: "Erreur lors de la récupération des réservations." });
    }
};

exports.getUserPaidReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find({ user: req.user._id, status: 'paid' }).populate('prestation').exec();
        res.json(reservations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations payées.' });
    }
};

exports.updateReservationStatus = async (req, res) => {
    try {
        const { reservationId } = req.body;
        const reservation = await Reservation.findById(reservationId);
        if (!reservation) return res.status(404).json({ message: 'Réservation non trouvée.' });

        reservation.status = 'paid';
        await reservation.save();
        res.status(200).json({ message: 'Réservation mise à jour avec succès.' });
    } catch (err) {
        console.error('Erreur lors de la mise à jour de la réservation:', err);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la réservation.' });
    }
};

exports.createReservation = async (req, res) => {
    const { prestations } = req.body;
    const user = req.user?.id;

    if (!user) return res.status(400).json({ message: "L'utilisateur est requis." });
    if (!Array.isArray(prestations) || prestations.length === 0) return res.status(400).json({ message: 'Le panier de prestations doit contenir au moins une prestation.' });

    try {
        const prestationsDetails = prestations.map(prestationItem => ({
            prestationId: prestationItem.prestationId,
            name: prestationItem.name,
            price: prestationItem.price,
            date: prestationItem.date
        }));

        const newReservation = new Reservation({
            user,
            prestations: prestationsDetails,
            date: new Date(),
            status: 'pending'
        });

        await newReservation.save();
        res.status(201).json({ message: 'Réservation créée avec succès.', reservationId: newReservation._id });
    } catch (err) {
        console.error('Erreur lors de la création de la réservation:', err);
        res.status(500).json({ message: 'Erreur lors de la création de la réservation.' });
    }
};
exports.createCheckoutSession = async (req, res) => {
    try {
        const { reservationIds } = req.body;

        // Vérifiez que les IDs des réservations sont fournis
        if (!reservationIds || reservationIds.length === 0) {
            return res.status(400).json({ message: 'Aucun ID de réservation fourni.' });
        }

        // Trouvez les réservations basées sur les IDs fournis
        const reservations = await Reservation.find({ _id: { $in: reservationIds } }).populate('prestations.prestationId');

        // Vérifiez si des réservations ont été trouvées
        if (reservations.length === 0) {
            return res.status(404).json({ message: 'Aucune réservation trouvée pour les IDs fournis.' });
        }

        // Préparez les items pour la session de checkout
        const line_items = reservations.flatMap(reservation =>
            reservation.prestations.map(prestation => ({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: prestation.prestationId.name,
                        description: prestation.prestationId.description || prestation.prestationId.name,
                    },
                    unit_amount: Math.round(prestation.prestationId.price * 100), // Assurez-vous que le prix est en cents
                },
                quantity: prestation.quantity || 1,
            }))
        );

        // Créez la session de paiement Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/Success`,
            cancel_url: `${process.env.CLIENT_URL}/Cancel`,
            metadata: { reservationIds: reservationIds.join(',') },
        });

        // Retournez l'URL de la session
        res.json({ url: session.url });
    } catch (error) {
        console.error("Erreur lors de la création de la session de paiement:", error);
        res.status(500).json({ message: 'Erreur lors de la création de la session de paiement.' });
    }
};



const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer l'événement
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const reservationIds = session.metadata.reservationIds.split(',');  // Assurez-vous que cela correspond à votre format

            console.log(`Session checkout terminée pour les réservations ${reservationIds}`);

            // Vérifiez que l'ID est bien transmis, puis appelez la fonction de mise à jour
            if (reservationIds && reservationIds.length > 0) {
                await updateReservationStatus(reservationIds);
            } else {
                console.error('Erreur: Aucune réservation trouvée dans le webhook');
            }
            break;

        default:
            console.log(`Type d'événement non pris en charge: ${event.type}`);
    }

    res.sendStatus(200);
};


const updateReservationStatus = async (reservationIds) => {
    try {
        const result = await Reservation.updateMany(
            { _id: { $in: reservationIds } },
            { $set: { status: 'paid' } }
        );
        console.log(`Réservation ${reservationIds} mise à jour avec le statut "paid". Modifications: ${result.modifiedCount}`);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des réservations :', error);
    }
};


exports.getReservationById = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate('prestations.prestationId');
        if (!reservation) return res.status(404).json({ message: 'Réservation non trouvée.' });

        res.json(reservation);
    } catch (error) {
        console.error('Erreur lors de la récupération de la réservation:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};