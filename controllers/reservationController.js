const Reservation = require('../models/reservationModel');
const Prestation = require('../models/prestationModel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();



// Créer une réservation
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

// Créer une session de paiement
exports.createCheckoutSession = async (req, res) => {
    try {
        const { reservationIds } = req.body;

        if (!reservationIds || reservationIds.length === 0) {
            return res.status(400).json({ message: 'Aucun ID de réservation fourni.' });
        }

        const reservations = await Reservation.find({ _id: { $in: reservationIds } }).populate('prestations.prestationId');

        if (reservations.length === 0) {
            return res.status(404).json({ message: 'Aucune réservation trouvée pour les IDs fournis.' });
        }

        const line_items = reservations.flatMap(reservation =>
            reservation.prestations.map(prestation => ({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: prestation.prestationId.name,
                        description: prestation.prestationId.description || prestation.prestationId.name,
                    },
                    unit_amount: Math.round(prestation.prestationId.price * 100),
                },
                quantity: prestation.quantity || 1,
            }))
        );

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            metadata: { reservationIds: reservationIds.join(',') },
            success_url: `${process.env.CLIENT_URL}/Success`,
            cancel_url: `${process.env.CLIENT_URL}/Cancel`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Erreur lors de la création de la session de paiement :", error.message);
        res.status(500).json({ message: 'Erreur lors de la création de la session de paiement.' });
    }
};

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log("Événement reçu :", JSON.stringify(event, null, 2));
    } catch (err) {
        console.error(`Échec de vérification de la signature du webhook: ${err.message}`);
        return res.status(400).send(`Erreur Webhook: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log("Session de paiement complétée détectée :", session);

        const reservationIds = session.metadata.reservationIds ? session.metadata.reservationIds.split(',') : [];
        console.log("Reservation IDs in webhook:", reservationIds);

        if (reservationIds.length > 0) {
            await exports.updateReservationStatus(reservationIds);
        } else {
            console.error('Erreur: Aucune réservation trouvée dans le webhook');
        }
    } else {
        console.log(`Type d'événement non pris en charge: ${event.type}`);
    }

    res.sendStatus(200);
};



// Mettre à jour le statut des réservations
exports.updateReservationStatus = async (reservationIds) => {
    try {
        const result = await Reservation.updateMany(
            { _id: { $in: reservationIds } },
            { status: 'paid' }
        );
        console.log(`Mise à jour réussie pour ${result.nModified} réservations.`);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des réservations :', error);
    }
};

exports.getUserReservations = async (req, res) => {
    try {
        // Récupérer l'ID utilisateur depuis les paramètres de l'URL
        const userId = req.params.userId;

        // Log pour vérifier l'ID utilisateur
        console.log('ID utilisateur:', userId);

        const reservations = await Reservation.find({ 
            user: userId, 
            status: 'paid' 
        }).populate('prestation').exec();

        // Log pour vérifier les réservations récupérées
        console.log('Réservations trouvées:', reservations);

        res.json({ data: reservations });
    } catch (err) {
        console.error('Erreur lors de la récupération des réservations payées:', err);
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations payées.' });
    }
};


// Récupérer une réservation par ID
exports.getReservationById = async (req, res) => {
    try {
        const reservation = await Reservation.findOne({
            _id: req.params.id,
            user: req.user._id  // Assure que la réservation appartient à l'utilisateur
        }).populate('prestations.prestationId');
        
        if (!reservation) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        res.json(reservation);
    } catch (error) {
        console.error('Erreur lors de la récupération de la réservation :', error.message);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};
