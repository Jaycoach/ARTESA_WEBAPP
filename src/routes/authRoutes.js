const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const logoutController = require('../controllers/logoutController');
const AuthValidators = require('../validators/authValidators');
const { sanitizeBody, securityHeaders } = require('../middleware/security');
const { verifyToken } = require('../middleware/auth');
const { registrationLimiter } = require('../middleware/enhancedSecurity');


// Aplicar headers de seguridad a todas las rutas
router.use(securityHeaders);

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Endpoints de autenticación y gestión de usuarios
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicio de sesión
 *     description: Autentica a un usuario y devuelve un token JWT para acceso a la API
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mail
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico del usuario
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Contraseña del usuario
 *           example:
 *             mail: "usuario@example.com"
 *             password: "contraseña123"
 *     responses:
 *       '200':
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login exitoso
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: John Doe
 *                         mail:
 *                           type: string
 *                           example: john@example.com
 *                         role:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 2
 *                             name:
 *                               type: string
 *                               example: USER
 *       '400':
 *         description: Credenciales incompletas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Credenciales incompletas
 *       '401':
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Credenciales inválidas
 *       '429':
 *         description: Demasiados intentos fallidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Demasiados intentos fallidos. Por favor, espere 300 segundos.
 *                 remainingTime:
 *                   type: integer
 *                   example: 300
 *       '500':
 *         description: Error interno del servidor
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
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registro de nuevo usuario
 *     description: Crea un nuevo usuario en el sistema y devuelve un token JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - mail
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre completo del usuario
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico del usuario (debe ser único)
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Contraseña del usuario (mínimo 8 caracteres)
 *                 minLength: 8
 *                 example: Contraseña123
 *           example:
 *             name: "John Doe"
 *             mail: "john@example.com"
 *             password: "Contraseña123"
 *     responses:
 *       '201':
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Usuario registrado exitosamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: John Doe
 *                         mail:
 *                           type: string
 *                           example: john@example.com
 *                         role:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 2
 *                             name:
 *                               type: string
 *                               example: USER
 *       '400':
 *         description: Datos inválidos o correo ya registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: El correo electrónico ya está registrado
 *       '500':
 *         description: Error interno del servidor
 */
router.post(
    '/register',
    registrationLimiter,
    sanitizeBody,
    AuthValidators.validateName,
    AuthValidators.validateEmail,
    AuthValidators.validatePassword,
    authController.register
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Revoca el token JWT actual para cerrar la sesión del usuario
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Sesión cerrada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Sesión cerrada exitosamente
 *       '401':
 *         description: No autorizado - Token no proporcionado o inválido
 *       '500':
 *         description: Error interno del servidor
 */
router.post(
    '/logout',
    verifyToken,
    logoutController.logout
);

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   get:
 *     summary: Verificar dirección de correo electrónico
 *     description: Verifica la dirección de correo del usuario utilizando el token enviado
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de verificación de correo
 *     responses:
 *       '200':
 *         description: Correo verificado exitosamente
 *       '400':
 *         description: Token inválido o expirado
 *       '404':
 *         description: Usuario no encontrado
 *       '500':
 *         description: Error interno del servidor
 */
router.get(
    '/verify-email/:token',
    authController.verifyEmail
);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Reenviar correo de verificación
 *     description: Reenvía el correo de verificación a un usuario registrado
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mail
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico del usuario
 *     responses:
 *       '200':
 *         description: Solicitud procesada exitosamente
 *       '400':
 *         description: Correo electrónico no proporcionado
 *       '500':
 *         description: Error interno del servidor
 */
router.post(
    '/resend-verification',
    sanitizeBody,
    AuthValidators.validateEmail,
    authController.resendVerification
);

module.exports = router;