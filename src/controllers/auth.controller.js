// src/controllers/auth.controller.js
const firebaseService = require('../services/firebaseService');

exports.register = async (req, res, next) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required.' });
        }

        // Crear usuario y perfil
        const userRecord = await firebaseService.createUserAuth(email, password, name);
        await firebaseService.saveUserProfile(userRecord.uid, email, name);
        
        // Loguear automáticamente para devolver el token
        const authData = await firebaseService.loginUser(email, password);
        
        res.status(201).json({ 
            success: true, 
            uid: userRecord.uid, 
            email: userRecord.email,
            name: userRecord.displayName,
            token: authData.idToken
        });

    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            return res.status(409).json({ error: 'El correo ya está en uso.' });
        }
        if (error.code === 'auth/invalid-password') {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
        }

        const authData = await firebaseService.loginUser(email, password);
        const profile = await firebaseService.getUserProfile(authData.uid);

        res.status(200).json({ 
            success: true, 
            uid: authData.uid,
            email: authData.email,
            name: profile.name,
            token: authData.idToken,
            stats: profile.dashboardStats
        });

    } catch (error) {
        console.error("Login Error:", error.message);
        if (error.message.includes('INVALID_LOGIN_CREDENTIALS') || error.message.includes('INVALID_PASSWORD') || error.message.includes('EMAIL_NOT_FOUND')) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        }
        next(error);
    }
};

exports.getProfile = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const profile = await firebaseService.getUserProfile(uid);
        res.json({ success: true, data: profile });
    } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const { name } = req.body;
        await firebaseService.saveUserProfile(uid, req.user.email, name);
        await firebaseService.updateUserAuth(uid, { displayName: name });
        res.json({ success: true, message: 'Perfil actualizado correctamente' });
    } catch (error) { next(error); }
};