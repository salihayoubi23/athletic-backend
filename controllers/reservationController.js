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

exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Stripe vérifiera la signature avec le corps brut de la requête
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erreur de validation du webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const reservationIds = session.metadata.reservationIds ? session.metadata.reservationIds.split(',') : [];

        if (reservationIds.length > 0) {
            try {
                await updateReservationStatusToPaid(reservationIds);
            } catch (err) {
                console.error('Erreur lors de la mise à jour des réservations:', err.message);
                return res.status(500).send('Erreur lors de la mise à jour des réservations');
            }
        }
    }

    res.status(200).json({ received: true });
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

const updateReservationStatusToPaid = async (reservationIds) => {
    try {
        await Reservation.updateMany(
            { _id: { $in: reservationIds } },
            { $set: { status: 'paid' } }
        );
    } catch (error) {
        console.error('Erreur lors de la mise à jour des réservations :', error);
    }
};
