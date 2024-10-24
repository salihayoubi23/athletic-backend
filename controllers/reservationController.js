const Reservation = require('../models/reservationModel');
const Prestation = require('../models/prestationModel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mongoose = require('mongoose');
const slugify = require('slugify');
const authMiddleware = require('../middlewares/authMiddleware');
const dotenv = require('dotenv');
dotenv.config(); // Charge les variables du fichier .env

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
        console.log('ID de réservation reçu pour la mise à jour du statut:', reservationId);

        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            console.log('Réservation non trouvée pour l\'ID:', reservationId);
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        reservation.status = 'paid'; // Mettre à jour le statut
        await reservation.save();

        console.log('Statut de la réservation mis à jour avec succès pour l\'ID:', reservationId);
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
        console.log("Erreur : l'utilisateur est requis.");
        return res.status(400).json({ message: "L'utilisateur est requis." });
    }

    if (!Array.isArray(prestations) || prestations.length === 0) {
        console.log("Erreur : le panier de prestations est vide ou invalide.");
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
        console.log('Réservation créée avec succès:', newReservation);
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
        console.log('Reservation IDs reçus dans la requête:', reservationIds);

        // Vérifie si les IDs de réservation sont présents
        if (!reservationIds || reservationIds.length === 0) {
            console.log('Aucun ID de réservation fourni');
            return res.status(400).json({ message: 'Aucun ID de réservation fourni.' });
        }

        // Récupérer les réservations associées
        const reservations = await Reservation.find({ _id: { $in: reservationIds } }).populate('prestations.prestationId');

        if (!reservations || reservations.length === 0) {
            console.log('Aucune réservation trouvée pour ces IDs:', reservationIds);
            return res.status(404).json({ message: "Aucune réservation trouvée pour ces IDs." });
        }

        // Créer les items de ligne à envoyer à Stripe
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

        console.log('Détails des articles pour Stripe (line_items):', JSON.stringify(line_items, null, 2));

        // Créer la session de paiement Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/Success`,
            cancel_url: `${process.env.CLIENT_URL}/Cancel`,
            metadata: { reservationIds: reservationIds.join(',') },
        });

        console.log('Session Stripe créée avec succès:', session);

        // Renvoie l'URL de la session
        res.json({ url: session.url });
    } catch (error) {
        console.error("Erreur lors de la création de la session de paiement:", error);
        res.status(500).json({ message: 'Erreur lors de la création de la session de paiement.' });
    }
};

// Webhook Stripe pour mettre à jour les réservations payées
exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    console.log("Signature Stripe reçue:", sig); // Log de la signature

    let event;

    try {
        // Utiliser le corps brut de la requête pour vérifier la signature Stripe
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log('Événement Stripe reçu avec succès:', event.type); // Log de l'événement
    } catch (err) {
        console.error('Erreur de validation du webhook:', err.message); // Log de l'erreur
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer les événements spécifiques (comme le paiement complété)
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('Détails de la session Stripe:', session); // Log des détails de la session

        // Récupérer les IDs de réservation depuis les métadonnées de la session Stripe
        const reservationIds = session.metadata.reservationIds ? session.metadata.reservationIds.split(',') : [];
        console.log('IDs de réservation trouvés:', reservationIds); // Log des IDs de réservation

        if (reservationIds.length > 0) {
            try {
                // Mettre à jour le statut des réservations à "payé"
                await updateReservationStatusToPaid(reservationIds);
                console.log('Statut des réservations mis à jour:', reservationIds);
            } catch (err) {
                console.error('Erreur lors de la mise à jour des réservations:', err.message);
                return res.status(500).send('Erreur lors de la mise à jour des réservations');
            }
        }
    }

    // Répondre à Stripe pour confirmer que l'événement a été traité
    res.status(200).json({ received: true });
};





// Fonction pour récupérer une réservation par ID
exports.getReservationById = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate('prestations.prestationId');

        if (!reservation) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

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
        console.log('Mise à jour des réservations dans la base de données pour les IDs:', reservationIds);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des réservations :', error);
    }
};