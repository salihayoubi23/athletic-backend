const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');

// Charger les variables d'environnement
dotenv.config();

// Connexion à la base de données
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

// Limitation des requêtes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes.'
});
app.use(limiter);

// Middleware pour le webhook Stripe pour capturer le corps brut
app.post('/api/reservations/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
    // Ici, vous traitez le webhook avec `req.body` en format brut
    const sig = req.headers['stripe-signature'];

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        // Traitement de l'événement Stripe
        res.status(200).send(`Event received: ${event.type}`);
    } catch (err) {
        console.log('Erreur de validation du webhook:', err.message);
        res.status(400).send(`Webhook error: ${err.message}`);
    }
});

// Utiliser express.json() pour toutes les autres routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/authRoutes');
const prestationRoutes = require('./routes/prestationRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const adminRoutes = require('./routes/adminRoutes');

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
