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
router.post('/webhook', express.raw({ type: 'application/json' }), reservationController.handleStripeWebhook);

// Récupérer une réservation par ID
router.get('/:id', authMiddleware, reservationController.getReservationById); // Ajoutez cette ligne ici

module.exports = router;
