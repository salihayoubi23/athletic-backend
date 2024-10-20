const Prestation = require('../models/prestationModel');
const slugify = require('slugify'); // Assurez-vous d'importer slugify


// Récupérer toutes les prestations
exports.getAllPrestations = async (req, res) => {
    try {
        const prestations = await Prestation.find();
        res.status(200).json(prestations);
    } catch (error) {
        console.error('Erreur lors de la récupération des prestations:', error);
        res.status(500).json({ message: "Erreur lors de la récupération des prestations." });
    }
};

// Obtenir les détails d'une prestation par ID
exports.getPrestationById = async (req, res) => {
    console.log('Requête pour récupérer une prestation avec ID:', req.params.id);
    
    try {
        const prestation = await Prestation.findById(req.params.id);
        
        if (!prestation) {
            console.log('Prestation non trouvée pour ID:', req.params.id);
            return res.status(404).json({ message: 'Prestation non trouvée' });
        }

        console.log('Prestation trouvée:', prestation);
        res.status(200).json(prestation);
    } catch (error) {
        console.error('Erreur lors de la récupération de la prestation:', error); 
        res.status(500).json({ message: 'Erreur lors de la récupération de la prestation', error: error.message });
    }
};

// Créer une nouvelle prestation
exports.createPrestation = async (req, res) => {
    const { name, description, price } = req.body;

    // Générer le slug à partir du nom
    const slug = name.toLowerCase().replace(/ /g, '-');

    try {
        const newPrestation = new Prestation({ name, description, price, slug });
        await newPrestation.save();
        res.status(201).json(newPrestation);
    } catch (err) {
        console.error('Erreur lors de la création de la prestation:', err);
        res.status(500).json({ message: 'Erreur lors de la création de la prestation.' });
    }
};

// Supprimer une prestation
exports.deletePrestation = async (req, res) => {
    try {
        const prestation = await Prestation.findByIdAndDelete(req.params.id);
        if (!prestation) return res.status(404).json({ message: 'Prestation non trouvée.' });
        res.json({ message: 'Prestation supprimée avec succès.' });
    } catch (err) {
        console.error('Erreur lors de la suppression de la prestation:', err);
        res.status(500).json({ message: "Erreur lors de la suppression de la prestation." });
    }
};

// Obtenir une prestation par nom
exports.getPrestationByName = async (req, res) => {
    try {
        const name = req.params.name; // Récupération du nom depuis les paramètres de la requête
        const slug = slugify(name, { lower: true }); // Normaliser le nom en slug
        console.log("Requête pour récupérer la prestation avec le nom:", slug); // Log pour débogage

        const prestation = await Prestation.findOne({ slug: slug }); // Cherche la prestation par slug

        if (!prestation) {
            return res.status(404).json({ message: 'Prestation non trouvée' });
        }

        res.json(prestation); // Retourne la prestation trouvée
    } catch (error) {
        console.error("Erreur lors de la récupération de la prestation:", error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
};
