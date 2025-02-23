// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const AuthValidators = require('../validators/authValidators');
const { sanitizeBody, securityHeaders } = require('../middleware/security');

// Aplicar headers de seguridad a todas las rutas
router.use(securityHeaders);

// Ruta de registro
router.post(
    '/register',
    sanitizeBody,
    AuthValidators.validateName,
    AuthValidators.validateEmail,
    AuthValidators.validatePassword,
    authController.register
);

// Ruta de login
router.post(
    '/login',
    authController.loginLimiter,
    sanitizeBody,
    AuthValidators.validateLoginData,
    AuthValidators.validateEmail,
    AuthValidators.validatePassword,
    authController.login
);

module.exports = router;