const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware'); // Importation du middleware d'authentification

// Inscription
router.post('/signup', authController.signup);

// Connexion
router.post('/login', authController.login);

// Route pour obtenir le profil utilisateur
// Route pour obtenir le profil utilisateur par ID
router.get('/userprofil/:userId', authMiddleware, authController.getUserProfile);

module.exports = router;
