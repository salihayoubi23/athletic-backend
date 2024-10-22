const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Créer une réservation
router.post('/', authMiddleware, reservationController.createReservation);

// Récupérer toutes les réservations (Admin)
router.get('/', authMiddleware, reservationController.getAllReservations);

// Récupérer les réservations d'un utilisateur
router.get('/user', authMiddleware, reservationController.getUserReservations);

// Récupérer les réservations payées d'un utilisateur
router.get('/user/paid', authMiddleware, reservationController.getUserPaidReservations);

// Mettre à jour le statut d'une réservation
router.put('/update-status', authMiddleware, reservationController.updateReservationStatus);

// Créer une session de paiement
router.post('/create-checkout-session', authMiddleware, reservationController.createCheckoutSession);

// Gérer le webhook de Stripe
// Endpoint pour écouter les webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event (exemple pour un paiement réussi)
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Update reservation status in your database
        const reservationIds = session.metadata.reservationIds;
        // Mettre à jour le statut à 'paid'
        updateReservationStatusToPaid(reservationIds);
    }

    res.json({ received: true });
});

// Récupérer une réservation par ID
router.get('/:id', authMiddleware, reservationController.getReservationById); 

router.get('/reservations-paid', async (req, res) => {
    try {
        const userId = req.user.id; 
        const reservations = await Reservation.find({
            user: userId,
            status: 'paid'
        });
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations.' });
    }
});




module.exports = router;
