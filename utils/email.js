const nodemailer = require('nodemailer');

const sendEmailConfirmation = async (email, reservation) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Vous pouvez utiliser d'autres services ou SMTP
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Confirmation de Réservation',
        text: `Merci pour votre réservation. Voici les détails : ${JSON.stringify(reservation)}`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email envoyé avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
    }
};

module.exports = sendEmailConfirmation;
