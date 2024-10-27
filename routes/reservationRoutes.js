const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, reservationController.createReservation);
router.get('/user/paid', authMiddleware, getUserReservations);
router.get('/:id', authMiddleware, reservationController.getReservationById);
router.put('/:id/status', authMiddleware, reservationController.updateReservationStatus);
router.post('/create-checkout-session', authMiddleware, reservationController.createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), reservationController.handleStripeWebhook);

module.exports = router;
