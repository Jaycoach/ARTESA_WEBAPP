const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const AuthValidators = require('../validators/authValidators');
const { sanitizeBody, securityHeaders } = require('../middleware/security');

// Aplicar headers de seguridad a todas las rutas
router.use(securityHeaders);

/**
 * @typedef {object} LoginRequest
 * @property {string} mail.required - Correo electrónico del usuario - format:email
 * @property {string} password.required - Contraseña del usuario - format:password
 */

/**
 * @typedef {object} LoginResponse
 * @property {boolean} success - Estado de la operación
 * @property {string} message - Mensaje descriptivo
 * @property {object} data - Datos del usuario y token
 * @property {string} data.token - Token JWT para autenticación
 * @property {object} data.user - Información del usuario
 * @property {number} data.user.id - ID del usuario
 * @property {string} data.user.name - Nombre del usuario
 * @property {string} data.user.mail - Correo del usuario
 * @property {object} data.user.role - Rol del usuario
 * @property {number} data.user.role.id - ID del rol
 * @property {string} data.user.role.name - Nombre del rol
 */

/**
 * Inicio de sesión
 * @route POST /auth/login
 * @group Auth - Operaciones relacionadas con autenticación
 * @param {LoginRequest} request.body.required - Credenciales de inicio de sesión
 * @returns {LoginResponse} 200 - Respuesta exitosa con token
 * @returns {object} 401 - Credenciales inválidas
 * @returns {object} 500 - Error interno del servidor
 */
router.post(
    '/login',
    authController.loginLimiter,
    sanitizeBody,
    AuthValidators.validateLoginData,
    AuthValidators.validateEmail,
    AuthValidators.validatePassword,
    authController.login
);

/**
 * @typedef {object} RegisterRequest
 * @property {string} name.required - Nombre del usuario - minLength:2, maxLength:50
 * @property {string} mail.required - Correo electrónico del usuario - format:email
 * @property {string} password.required - Contraseña del usuario - minLength:8, maxLength:100
 */

/**
 * Registro de usuario
 * @route POST /auth/register
 * @group Auth - Operaciones relacionadas con autenticación
 * @param {RegisterRequest} request.body.required - Datos de registro
 * @returns {LoginResponse} 201 - Usuario registrado exitosamente
 * @returns {object} 400 - Datos inválidos o correo ya registrado
 * @returns {object} 500 - Error interno del servidor
 */
router.post(
    '/register',
    sanitizeBody,
    AuthValidators.validateName,
    AuthValidators.validateEmail,
    AuthValidators.validatePassword,
    authController.register
);

module.exports = router;