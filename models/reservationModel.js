const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId,  // Associer avec l'utilisateur
        ref: 'User',
        required: true
    },
    prestations: [
        {
            prestationId: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'Prestation',
                required: true
            },
            name: { 
                type: String, 
                required: true 
            },
            price: { 
                type: Number, 
                required: true 
            },
            date: {  // Date de la prestation
                type: Date,
                required: true
            }
        }
    ],
    date: {  // Date de création de la réservation
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'paid', 'cancelled']
    }
}, { timestamps: true });

const Reservation = mongoose.model('Reservation', reservationSchema);
module.exports = Reservation;
