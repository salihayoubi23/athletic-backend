const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const connectDB = require('./config/db');
const Prestation = require('./models/prestationModel'); // Assurez-vous d'importer le modèle Prestation

// Charger les variables d'environnement
dotenv.config();

// Connexion à la base de données
connectDB();


const app = express();

// Middleware de sécurité
app.use(helmet());  // Sécurisation des en-têtes HTTP
app.use(compression());  // Compression des réponses HTTP

// Configuration CORS
const corsOptions = {
    origin: ['http://localhost:3000', 'https://athletic-men.vercel.app'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Méthodes HTTP autorisées
    allowedHeaders: ['Content-Type', 'Authorization'],  // En-têtes autorisés
    credentials: true  // Autoriser les cookies ou les informations d'authentification
};
app.use(cors(corsOptions));



// Limitation des requêtes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,  // Limite chaque IP à 100 requêtes par fenêtre de 15 minutes
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes.'
});
app.use(limiter);

// Middleware pour parser les requêtes JSON
app.use(express.json());  // Middleware pour les requêtes JSON

// Routes
const authRoutes = require('./routes/authRoutes');
const prestationRoutes = require('./routes/prestationRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);         // Routes pour l'authentification
app.use('/api/prestations', prestationRoutes); // Routes pour les prestations
app.use('/api/reservations', reservationRoutes); // Routes pour les réservations
app.use('/api/admin', adminRoutes);       // Routes pour l'administration

// Route pour récupérer la prestation par nom
app.get('/api/prestations/name/:name', async (req, res) => {
    try {
        const name = req.params.name; // Récupère le nom de la prestation
        console.log("Requête reçue pour la prestation avec le nom:", name); // Log pour le débogage

        // Recherche de la prestation dans la base de données
        const prestation = await Prestation.findOne({ name: name });
        
        if (!prestation) {
            return res.status(404).json({ message: 'Prestation non trouvée' });
        }
        res.json(prestation);
    } catch (error) {
        console.error("Erreur lors de la récupération de la prestation:", error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

// Gestion des erreurs 404
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route non trouvée.' });
});

// Gestion des erreurs générales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue, veuillez réessayer plus tard.' });
});
app.post('/webhook', express.raw({ type: 'application/json' }), reservationRoutes.handleStripeWebhook);



// Lancement du serveur
const PORT = process.env.PORT || 4400;
app.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
});
