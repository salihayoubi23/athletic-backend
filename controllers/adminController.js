const User = require('../models/userModel'); // Modèle pour les utilisateurs
const Reservation = require('../models/reservationModel'); // Modèle pour les réservations

// Récupérer tous les utilisateurs
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs.' });
    }
};

// Récupérer toutes les réservations
exports.getAllReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find().populate('userId prestationId');
        res.status(200).json(reservations);
    } catch (err) {
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations.' });
    }
};
