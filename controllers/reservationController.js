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
        if (!reservationIds || reservationIds.length === 0) return res.status(400).json({ message: 'Aucun ID de réservation fourni.' });

        const reservations = await Reservation.find({ _id: { $in: reservationIds } }).populate('prestations.prestationId');
        const line_items = reservations.flatMap(reservation =>
            reservation.prestations.map(prestation => ({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: prestation.prestationId.name,
                        description: prestation.prestationId.description || prestation.prestationId.name,
                    },
                    unit_amount: prestation.prestationId.price * 100,
                },
                quantity: prestation.quantity || 1,
            }))
        );

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/Success`,
            cancel_url: `${process.env.CLIENT_URL}/Cancel`,
            metadata: { reservationIds: reservationIds.join(',') },
        });

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
            const reservationId = session.metadata.reservationIds;  // Assurez-vous que le champ "metadata" est bien défini dans Stripe

            console.log(`Session checkout terminée pour la réservation ${reservationId}`);

            // Vérifiez que l'ID est bien transmis, puis appelez la fonction de mise à jour
            if (reservationId) {
                await updateReservationStatusToPaid([reservationId]);
            } else {
                console.error('Erreur: Aucune réservation trouvée dans le webhook');
            }
            break;

        default:
            console.log(`Type d'événement non pris en charge: ${event.type}`);
    }

    res.sendStatus(200);
};

const updateReservationStatusToPaid = async (reservationIds) => {
    try {
        await Reservation.updateMany(
            { _id: { $in: reservationIds } },
            { $set: { status: 'paid' } }
        );
        console.log(`Réservation ${reservationIds} mise à jour avec le statut "paid"`);
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