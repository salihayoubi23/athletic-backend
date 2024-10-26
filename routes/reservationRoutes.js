const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, reservationController.createReservation);
router.get('/', authMiddleware, reservationController.getAllReservations);
router.get('/user', authMiddleware, reservationController.getUserReservations);
router.get('/user/paid', authMiddleware, reservationController.getUserPaidReservations);
router.get('/:id', authMiddleware, reservationController.getReservationById);
router.put('/:id/status', authMiddleware, reservationController.updateReservationStatusToPaid);
router.post('/create-checkout-session', authMiddleware, reservationController.createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), reservationController.handleStripeWebhook);

module.exports = router;
