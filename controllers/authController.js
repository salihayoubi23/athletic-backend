const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Importez le module jsonwebtoken
const User = require('../models/userModel');

// Récupérer le profil utilisateur

exports.getUserProfile = async (req, res) => {
    const userId = req.params.userId; // Récupérez l'ID utilisateur des paramètres de la requête

    try {
        const user = await User.findById(userId); // Trouvez l'utilisateur par ID

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        // Ne renvoyez que les informations nécessaires
        res.status(200).json({
            username: user.username,
            email: user.email,
            // Ajoutez d'autres informations si nécessaire
        });
    } catch (error) {
        console.error("Erreur lors de la récupération du profil utilisateur:", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
};


// Inscription
exports.signup = async (req, res) => {
    const { username, email, password } = req.body;  // Récupère le username, email et password

    console.log('Signup request body:', req.body);  // Log pour vérifier le corps de la requête

    try {
        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Utilisateur déjà existant.' });
        }

        // Hashage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer un nouvel utilisateur
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Utilisateur créé avec succès.' });
    } catch (err) {
        console.error('Erreur lors de l\'inscription:', err);  // Log de l'erreur
        res.status(500).json({ message: "Erreur lors de l'inscription." });
    }
};

// Connexion
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Utilisateur non trouvé.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Mot de passe incorrect.' });
        }

        // Générer un token JWT avec l'userId et username
        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ 
            message: 'Connexion réussie.', 
            token, 
            userId: user._id,
            username: user.username 
        });
    } catch (err) {
        console.error('Erreur lors de la connexion:', err);
        res.status(500).json({ message: "Erreur lors de la connexion." });
    }
};
