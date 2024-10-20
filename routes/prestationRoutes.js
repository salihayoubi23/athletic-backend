// prestationRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAllPrestations,
    getPrestationById,
    getPrestationByName,
    createPrestation,
    deletePrestation
} = require('../controllers/prestationController');

// Récupérer toutes les prestations
router.get('/', getAllPrestations);

// Récupérer une prestation par ID
router.get('/:id', getPrestationById);

// Récupérer une prestation par nom
router.get('/name/:name', getPrestationByName); // Assurez-vous que cette route est définie correctement

// Créer une nouvelle prestation
router.post('/', createPrestation);

// Supprimer une prestation
router.delete('/:id', deletePrestation);

module.exports = router;
