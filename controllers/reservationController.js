const Reservation = require('../models/reservationModel');
const Prestation = require('../models/prestationModel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mongoose = require('mongoose');
const slugify = require('slugify');
const authMiddleware = require('../middlewares/authMiddleware');
const dotenv = require('dotenv');
dotenv.config(); // Cela charge les variables de votre fichier .env

// Voir les réservations d'un utilisateur
exports.getUserReservations = async (req, res) => {
    try {
        const userId = req.user._id; // Utilisation de l'ID utilisateur
        console.log("ID de l'utilisateur :", userId); // Log pour le débogage
        const reservations = await Reservation.find({ user: userId })
            .populate('prestation') // Remplit les données de prestation
            .exec();

        console.log("Réservations trouvées :", reservations); // Log pour le débogage
        res.json(reservations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations.' });
    }
};

// Voir toutes les réservations (Admin)
exports.getAllReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find().populate('user prestation');
        res.json(reservations);
    } catch (err) {
        console.error('Erreur lors de la récupération des réservations:', err);
        res.status(500).json({ message: "Erreur lors de la récupération des réservations." });
    }
};

// Voir les réservations payées d'un utilisateur
exports.getUserPaidReservations = async (req, res) => {
    try {
        const userId = req.user._id;
        const reservations = await Reservation.find({ user: userId, status: 'paid' })
            .populate('prestation')
            .exec();

        const formattedReservations = reservations.map(reservation => ({
            prestations: reservation.prestations.map(prestation => ({
                name: prestation.name,
                price: prestation.price,
                date: moment(prestation.date).format('dddd, LL')  // Afficher la date formatée sans heure
            }))
        }));

        console.log("Réservations payées trouvées :", formattedReservations);
        res.json(formattedReservations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations payées.' });
    }
};

// Mettre à jour le statut de la réservation
exports.updateReservationStatus = async (req, res) => {
    try {
        const { reservationId } = req.body;

        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        reservation.status = 'paid'; // Mettre à jour le statut
        await reservation.save();

        res.status(200).json({ message: 'Réservation mise à jour avec succès.' });
    } catch (err) {
        console.error('Erreur lors de la mise à jour de la réservation:', err);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la réservation.' });
    }
};

// Créer une réservation
exports.createReservation = async (req, res) => {
    const { prestations } = req.body;

    const user = req.user?.id;
    console.log('ID utilisateur reçu depuis le token:', user); // Log pour vérifier que l'ID est bien reçu
    console.log('Prestations reçues:', prestations);

    if (!user) {
        return res.status(400).json({ message: "L'utilisateur est requis." });
    }

    if (!Array.isArray(prestations) || prestations.length === 0) {
        return res.status(400).json({ message: 'Le panier de prestations doit contenir au moins une prestation.' });
    }

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
        res.status(201).json({
            message: 'Réservation créée avec succès.',
            reservationId: newReservation._id
        });
    } catch (err) {
        console.error('Erreur lors de la création de la réservation:', err);
        res.status(500).json({ message: 'Erreur lors de la création de la réservation.' });
    }
};

// Créer une session de paiement
exports.createCheckoutSession = async (req, res) => {
    try {
        const { reservationIds } = req.body;

        const reservations = await Reservation.find({ _id: { $in: reservationIds } }).populate('prestations.prestationId');

        if (!reservations || reservations.length === 0) {
            return res.status(404).json({ message: "Aucune réservation trouvée pour ces IDs." });
        }

        const line_items = reservations.flatMap(reservation =>
            reservation.prestations.map(prestation => ({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: prestation.name,
                        description: prestation.name,
                    },
                    unit_amount: prestation.price * 100,
                },
                quantity: 1,
            }))
        );

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/Success`,  // URL après succès
            cancel_url: `${process.env.CLIENT_URL}/Cancel`,
            metadata: { reservationIds: reservationIds.join(',') },
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Erreur lors de la création de la session de paiement:", error);
        res.status(500).json({ message: 'Erreur lors de la création de la session de paiement.' });
    }
};

// Webhook Stripe pour mettre à jour les réservations payées
exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Erreur de vérification Webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const reservationIds = session.metadata.reservationIds.split(',');

        console.log("Reservation IDs reçus du webhook:", reservationIds);

        try {
            await Reservation.updateMany(
                { _id: { $in: reservationIds } },
                { $set: { status: 'paid' } }
            );
            console.log(`Réservations mises à jour avec succès pour les IDs: ${reservationIds}`);
        } catch (error) {
            console.error('Erreur lors de la mise à jour des réservations:', error);
            return res.status(500).json({ message: 'Erreur lors de la mise à jour des réservations.' });
        }
    }

    res.setHeader('ngrok-skip-browser-warning', 'true'); // Ajoutez cette ligne pour éviter la page de mise en garde
    res.json({ received: true }); // Répondre à Stripe
};

// Fonction pour récupérer une réservation par ID
exports.getReservationById = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate('prestation');

        if (!reservation) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        res.json(reservation);
    } catch (error) {
        console.error('Erreur lors de la récupération de la réservation:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};
