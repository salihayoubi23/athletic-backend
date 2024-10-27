const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

// Middleware de sécurité
app.use(helmet());
app.use(compression());

// Configuration CORS
const corsOptions = {
    origin: ['http://localhost:3000', 'https://athletic-men.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// Limiteur de requêtes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes.'
});
app.use(limiter);

// Middleware pour gérer les webhooks Stripe avec express.raw uniquement pour la route webhook
// Middleware pour les requêtes JSON (sauf le webhook Stripe)
app.use((req, res, next) => {
    if (req.originalUrl === '/api/reservations/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});
// Middleware pour le parsing des requêtes JSON (pour toutes les autres routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Importation des routes
const authRoutes = require('./routes/authRoutes');
const prestationRoutes = require('./routes/prestationRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Utilisation des routes
app.use('/api/auth', authRoutes);
app.use('/api/prestations', prestationRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ message: 'Route non trouvée.' });
});

// Gestion des erreurs générales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue, veuillez réessayer plus tard.' });
});

// Lancement du serveur
const PORT = process.env.PORT || 4400;
app.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
});
