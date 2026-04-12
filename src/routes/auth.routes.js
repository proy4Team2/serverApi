// src/routes/auth.routes.js
const router = require('express').Router();
const authMiddleware = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');

// Públicas
router.post('/register', authController.register);
router.post('/login', authController.login);

// Privadas (Requieren token)
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;