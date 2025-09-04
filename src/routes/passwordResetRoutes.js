const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');

/**
 * @typedef {object} RequestResetRequest
 * @property {string} mail.required - Correo electrónico del usuario - format:email
 */

/**
 * @typedef {object} RequestResetResponse
 * @property {string} message - Mensaje de confirmación
 * @property {string} token - Token generado (solo en modo desarrollo)
 */

/**
 * Solicitar restablecimiento de contraseña
 * @route POST /password/request-reset
 * @group PasswordReset - Operaciones de recuperación de contraseña
 * @param {RequestResetRequest} request.body.required - Correo electrónico para recuperación
 * @returns {RequestResetResponse} 200 - Solicitud procesada correctamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/request-reset', passwordResetController.requestReset);

/**
 * @typedef {object} ResetPasswordRequest
 * @property {string} token.required - Token de recuperación recibido
 * @property {string} newPassword.required - Nueva contraseña - minLength:8, maxLength:100
 */

/**
 * @typedef {object} ResetPasswordResponse
 * @property {boolean} success - Estado de la operación
 * @property {string} message - Mensaje de confirmación
 */

/**
 * Restablecer contraseña
 * @route POST /password/reset
 * @group PasswordReset - Operaciones de recuperación de contraseña
 * @param {ResetPasswordRequest} request.body.required - Token y nueva contraseña
 * @returns {ResetPasswordResponse} 200 - Contraseña actualizada correctamente
 * @returns {object} 400 - Token inválido o expirado
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/reset', passwordResetController.resetPassword);

/**
 * Cambio directo de contraseña por administrador
 * @route POST /password/admin-reset
 * @group PasswordReset - Operaciones de recuperación de contraseña
 * @param {object} request.body.required - Email, nueva contraseña y token de admin
 * @returns {object} 200 - Contraseña actualizada correctamente
 * @returns {object} 403 - Token de administrador inválido
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/admin-reset', passwordResetController.adminResetPassword);

module.exports = router;