const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const connectDB = require('./config/db');
const Prestation = require('./models/prestationModel'); // Importer le modèle Prestation

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

// Middleware pour parser les requêtes JSON
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

// Route pour récupérer la prestation par nom
app.get('/api/prestations/name/:name', async (req, res) => {
    try {
        const name = req.params.name;
        console.log("Requête reçue pour la prestation avec le nom:", name);

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

// Lancement du serveur
const PORT = process.env.PORT || 4400;
app.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
});
