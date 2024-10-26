const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);  // Utilise la clé API Stripe de votre .env
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

// Limitation des requêtes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes.'
});
app.use(limiter);

// Middleware pour le webhook Stripe avec express.raw
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/api/reservations/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Erreur de validation du webhook : ${err.message}`);
        return res.status(400).send(`Webhook error: ${err.message}`);
    }

    // Gérer les événements Stripe
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`Paiement de ${paymentIntent.amount} réussi !`);
            // Logique de gestion pour le paiement réussi
            break;
        case 'payment_method.attached':
            const paymentMethod = event.data.object;
            // Logique de gestion pour l'ajout de méthode de paiement
            break;
        default:
            console.log(`Type d'événement non pris en charge: ${event.type}`);
    }

    res.sendStatus(200);
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
