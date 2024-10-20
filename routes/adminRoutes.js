const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const prestationController = require('../controllers/prestationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Gestion des utilisateurs (Admin)
router.get('/myusers', authMiddleware, adminController.getUsers); // Récupérer tous les utilisateurs

// Gestion des réservations (Admin)
router.get('/reservations', authMiddleware, adminController.getAllReservations); // Récupérer toutes les réservations

// Gestion des prestations (Admin)
router.post('/prestation', authMiddleware, prestationController.createPrestation); // Créer une prestation
router.delete('/prestation/:id', authMiddleware, prestationController.deletePrestation); // Supprimer une prestation

module.exports = router;


//ndnd





