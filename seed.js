require('dotenv').config(); // Charger les variables d'environnement depuis le fichier .env
const mongoose = require('mongoose');
const Prestation = require('./models/prestationModel'); // Chemin vers votre modèle

const prestations = [
    {
        name: 'Prestation Du Lundi',
        description: 'Découvrez notre première prestation exceptionnelle qui vous aidera à atteindre vos objectifs sportifs.',
        price: 3,
        availableDays: ['lundi'],
        slug: 'prestation-du-lundi' // Ajoutez le slug ici
    },
    {
        name: 'Prestation Du Mercredi',
        description: 'La deuxième prestation met l\'accent sur des techniques avancées pour améliorer vos performances.',
        price: 3,
        availableDays: ['mercredi'],
        slug: 'prestation-du-mercredi' // Ajoutez le slug ici
    },
    {
        name: 'Prestation Du Dimanche',
        description: 'Profitez de notre troisième prestation pour un accompagnement personnalisé et des conseils experts.',
        price: 3,
        availableDays: ['dimanche'],
        slug: 'prestation-du-dimanche' // Ajoutez le slug ici
    }
];
const seedDB = async () => {
    await Prestation.deleteMany({});
    const insertedPrestations = await Prestation.insertMany(prestations);
    console.log('Prestations insérées:', insertedPrestations);
    console.log('Base de données remplie avec succès');
};


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Connexion à MongoDB réussie');
        return seedDB(); // Appel de la fonction pour remplir la DB
    })
    .then(() => {
        mongoose.connection.close(); // Fermer la connexion
    })
    .catch(err => {
        console.error('Erreur de connexion à MongoDB:', err);
    });
