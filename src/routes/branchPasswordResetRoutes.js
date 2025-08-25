const express = require('express');
const router = express.Router();
const branchPasswordResetController = require('../controllers/branchPasswordResetController');
const { sanitizeBody } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: BranchPasswordReset
 *   description: Operaciones de recuperación de contraseña para sucursales
 */

/**
 * @swagger
 * /api/branch-password/request-reset:
 *   post:
 *     summary: Solicitar restablecimiento de contraseña para sucursal
 *     description: Envía un correo electrónico con un token para restablecer la contraseña de una sucursal
 *     tags: [BranchPasswordReset]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mail
 *             properties:
 *               mail:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico de la sucursal
 *                 example: sucursal@cliente.com
 *               recaptchaToken:
 *                 type: string
 *                 description: Token de reCAPTCHA para validación
 *     responses:
 *       200:
 *         description: Solicitud procesada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Si el correo de sucursal existe, recibirás instrucciones para restablecer tu contraseña
 *                 token:
 *                   type: string
 *                   description: Token generado (solo en modo desarrollo)
 *       400:
 *         description: Datos inválidos
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
 *                   example: El correo electrónico es requerido
 *       500:
 *         description: Error interno del servidor
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
 *                   example: Error interno del servidor
 */
router.post('/request-reset', 
    sanitizeBody, 
    branchPasswordResetController.requestReset
);

/**
 * @swagger
 * /api/branch-password/reset:
 *   post:
 *     summary: Restablecer contraseña de sucursal
 *     description: Restablece la contraseña de una sucursal usando un token válido recibido por correo
 *     tags: [BranchPasswordReset]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token de recuperación recibido por correo
 *                 example: 8f7d8fca7e3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Nueva contraseña para la sucursal
 *                 minLength: 8
 *                 maxLength: 100
 *                 example: NuevaContraseñaSegura123
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
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
 *                   example: Contraseña de sucursal actualizada exitosamente
 *       400:
 *         description: Token inválido, expirado o datos inválidos
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
 *                   examples:
 *                     token_required:
 *                       value: Token y nueva contraseña son requeridos
 *                     password_length:
 *                       value: La contraseña debe tener al menos 8 caracteres
 *                     invalid_token:
 *                       value: Token inválido o expirado
 *       500:
 *         description: Error interno del servidor
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
 *                   example: Error interno del servidor
 */
router.post('/reset', 
    sanitizeBody, 
    branchPasswordResetController.resetPassword
);

module.exports = router;