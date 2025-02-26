const crypto = require('crypto');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const PasswordReset = require('../models/PasswordReset');
const { createContextLogger } = require('../config/logger');
const EmailService = require('../services/EmailService');

// Crear una instancia del logger con contexto
const logger = createContextLogger('PasswordResetController');

/**
 * @swagger
 * components:
 *   schemas:
 *     RequestResetRequest:
 *       type: object
 *       required:
 *         - mail
 *       properties:
 *         mail:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *           example: usuario@example.com
 *     
 *     RequestResetResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Si el correo existe, recibirás instrucciones para restablecer tu contraseña
 *         token:
 *           type: string
 *           description: Token de restablecimiento (solo en entorno de desarrollo)
 *           example: 8f7d8fca7e3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d
 *     
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - newPassword
 *       properties:
 *         token:
 *           type: string
 *           description: Token de restablecimiento recibido por correo
 *           example: 8f7d8fca7e3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d6e5f4c3b2a1d
 *         newPassword:
 *           type: string
 *           format: password
 *           description: Nueva contraseña del usuario
 *           example: NuevaContraseña123
 *     
 *     ResetPasswordResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Contraseña actualizada exitosamente
 */

class PasswordResetController {
  /**
   * @swagger
   * /api/password/request-reset:
   *   post:
   *     summary: Solicitar restablecimiento de contraseña
   *     description: Envía un correo electrónico con un token para restablecer la contraseña
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RequestResetRequest'
   *     responses:
   *       200:
   *         description: Solicitud procesada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RequestResetResponse'
   *       400:
   *         description: Datos inválidos
   *       500:
   *         description: Error interno del servidor
   */
  async requestReset(req, res) {
    try {
      const { mail } = req.body;
      
      // Registrar el inicio de la solicitud
      logger.info('Iniciando solicitud de reset de contraseña', { mail });
      
      // Buscar usuario
      const user = await userModel.findByEmail(mail);
      
      if (!user) {
        logger.info('Correo no encontrado en la base de datos', { mail });
        return res.status(200).json({ 
          message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña'
        });
      }

      // Verificar explícitamente el user_id
      if (!user.user_id) {
        logger.error('Usuario encontrado pero sin user_id', { mail });
        return res.status(400).json({ 
          error: 'No se pudo identificar el usuario' 
        });
      }

      // Generar token único
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      // Guardar token
      await PasswordReset.createToken(user.user_id, resetToken, expiresAt);

      // Enviar correo con el token
      try {
        await EmailService.sendPasswordResetEmail(mail, resetToken);
        logger.info('Correo de recuperación enviado exitosamente', { mail });
      } catch (emailError) {
        logger.error('Error al enviar correo de recuperación', { 
          error: emailError.message,
          mail 
        });
        // No retornamos el error al cliente por seguridad
      }

      // En desarrollo, mostrar el token para pruebas
      if (process.env.NODE_ENV === 'development') {
        logger.info('Token generado para pruebas', { token: resetToken });
        return res.json({ 
          message: 'Token generado (modo desarrollo)',
          token: resetToken
        });
      }

      res.json({ 
        message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña'
      });
    } catch (error) {
      logger.error('Error en el proceso de recuperación de contraseña', { 
        error: error.message,
        stack: error.stack 
      });
      
      res.status(500).json({ 
        error: 'Error al procesar la solicitud de recuperación de contraseña' 
      });
    }
  }

  /**
   * @swagger
   * /api/password/reset:
   *   post:
   *     summary: Restablecer contraseña
   *     description: Establece una nueva contraseña utilizando el token recibido
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ResetPasswordRequest'
   *     responses:
   *       200:
   *         description: Contraseña actualizada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ResetPasswordResponse'
   *       400:
   *         description: Token inválido, expirado o datos incorrectos
   *       500:
   *         description: Error interno del servidor
   */
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // 1. Verificación del token
      const resetRequest = await PasswordReset.findByToken(token);
      if (!resetRequest) {
        logger.warn('Intento de uso de token inválido o expirado', { 
          tokenFragment: token.substring(0, 10) 
        });
        return res.status(400).json({ 
          error: 'Token inválido o expirado' 
        });
      }

      // 2. Obtener usuario y verificar contraseña actual
      const currentUser = await userModel.findById(resetRequest.user_id);
      if (!currentUser) {
        logger.error('Usuario no encontrado para el token de reset', {
          userId: resetRequest.user_id
        });
        return res.status(400).json({
          error: 'Error al procesar la solicitud'
        });
      }

      // 3. Verificar que la nueva contraseña no sea igual a la actual
      const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);
      if (isSamePassword) {
        logger.warn('Intento de usar la misma contraseña', {
          userId: resetRequest.user_id
        });
        return res.status(400).json({
          error: 'La nueva contraseña no puede ser igual a la actual'
        });
      }

      // 4. Generar nuevo hash
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 5. Verificar que el hash es válido
      const verificationTest = await bcrypt.compare(newPassword, hashedPassword);
      if (!verificationTest) {
        logger.error('Error en la generación del hash', {
          userId: resetRequest.user_id
        });
        throw new Error('Error en la generación del hash de contraseña');
      }

      // 6. Actualizar la contraseña
      await userModel.updatePassword(resetRequest.user_id, hashedPassword);

      // 7. Marcar token como usado
      await PasswordReset.markAsUsed(token);

      // 8. Verificación final
      const updatedUser = await userModel.findById(resetRequest.user_id);
      const finalCheck = await bcrypt.compare(newPassword, updatedUser.password);
      
      logger.info('Reset de contraseña completado exitosamente', {
        userId: resetRequest.user_id,
        success: finalCheck
      });

      return res.json({ 
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    } catch (error) {
      logger.error('Error en el proceso de reset de contraseña', {
        error: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error al restablecer la contraseña'
      });
    }
  }
}

module.exports = new PasswordResetController();