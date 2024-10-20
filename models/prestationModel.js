const mongoose = require('mongoose');
const slugify = require('slugify'); // N'oubliez pas d'importer slugify

const prestationSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    },
    availableDays: { 
        type: [String], // Un tableau de chaînes (jours disponibles)
        required: true 
    },
    slug: { 
        type: String, 
        unique: true, // Le slug doit être unique
        required: true 
    }
}, { timestamps: true }); // Ajout de timestamps pour la prestation

// Génération automatique du slug avant de sauvegarder le document
prestationSchema.pre('save', function(next) {
    if (this.isModified('name')) {  // Vérifier si le nom a été modifié avant de regénérer le slug
        this.slug = slugify(this.name, { lower: true }); // Génère un slug en minuscules
    }
    next();
});

const Prestation = mongoose.model('Prestation', prestationSchema);
module.exports = Prestation;
