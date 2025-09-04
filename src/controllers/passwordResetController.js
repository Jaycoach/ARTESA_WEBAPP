const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const PasswordReset = require('../models/PasswordReset');
const { createContextLogger } = require('../config/logger');
const EmailService = require('../services/EmailService');
const { validateRecaptcha } = require('../utils/recaptchaValidator');

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
      // Log completo de la solicitud para depuración
      logger.debug('Solicitud de reset de contraseña recibida', {
        body: Object.keys(req.body),
        contentType: req.headers['content-type'],
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Validación de reCAPTCHA (agregar en el método resetPassword)
      if (process.env.RECAPTCHA_ENABLED === 'true' && process.env.NODE_ENV !== 'development') {
        const userAgent = req.get('User-Agent') || '';
        const isApiRequest = userAgent.includes('curl') || 
                userAgent.includes('PostmanRuntime') || 
                userAgent.includes('insomnia') || 
                userAgent.includes('Thunder Client') ||
                req.get('X-Requested-With') === 'swagger' ||
                process.env.NODE_ENV === 'staging' ||
                process.env.RECAPTCHA_BYPASS === 'true';
        
        if (!isApiRequest) {
          const recaptchaResponse = req.body.recaptchaToken || req.body['g-recaptcha-response'] || req.body.captchaToken;
          
          if (!recaptchaResponse) {
            logger.warn('Intento de reset de contraseña sin token reCAPTCHA', { 
              tokenFragment: req.body.token ? req.body.token.substring(0, 10) + '...' : 'No token',
              ip: req.ip 
            });
            return res.status(400).json({
              success: false,
              errorCode: 'MISSING_RECAPTCHA',
              message: 'Por favor, complete la verificación de seguridad'
            });
          }
          
          const recaptchaValid = await validateRecaptcha(recaptchaResponse, req);
          
          if (!recaptchaValid) {
            logger.warn('Verificación reCAPTCHA fallida en reset de contraseña', {
              tokenFragment: req.body.token ? req.body.token.substring(0, 10) + '...' : 'No token',
              ip: req.ip
            });
            
            return res.status(400).json({
              success: false,
              errorCode: 'RECAPTCHA_FAILED',
              message: 'Verificación de seguridad fallida. Por favor, intenta nuevamente.'
            });
          }
        } else {
          logger.debug('Saltando verificación de reCAPTCHA para solicitud API directa en reset', { 
            tokenFragment: req.body.token ? req.body.token.substring(0, 10) + '...' : 'No token',
            userAgent: userAgent,
            environment: process.env.NODE_ENV
          });
        }
      } else if (process.env.NODE_ENV === 'development') {
        logger.debug('Saltando verificación de reCAPTCHA en desarrollo para reset', {
          tokenFragment: req.body.token ? req.body.token.substring(0, 10) + '...' : 'No token'
        });
      }
  
      const { token, password, newPassword, recaptchaToken } = req.body;
      const finalPassword = newPassword || password; // Aceptar ambos nombres de campo
  
      // Validación inicial con códigos de error específicos
      if (!token) {
        logger.warn('Solicitud de reset sin token', { ip: req.ip });
        return res.status(400).json({
          success: false,
          errorCode: 'MISSING_TOKEN',
          message: 'El token de recuperación es requerido'
        });
      }
  
      if (!finalPassword) {
        logger.warn('Solicitud de reset sin nueva contraseña', { 
          tokenFragment: token.substring(0, 10) + '...',
          ip: req.ip,
          bodyKeys: Object.keys(req.body),
          hasPassword: !!password,
          hasNewPassword: !!finalPassword
        });
        return res.status(400).json({
          success: false,
          errorCode: 'MISSING_PASSWORD',
          message: 'La nueva contraseña es requerida'
        });
      }  
      // Verificación del token
      const resetRequest = await PasswordReset.findByToken(token);
      if (!resetRequest) {
        logger.warn('Token de reset inválido o expirado', { 
          tokenFragment: token.substring(0, 10) + '...',
          ip: req.ip
        });
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_TOKEN',
          message: 'El token es inválido o ha expirado'
        });
      }
  
      // Obtener usuario
      const userId = resetRequest.user_id;
      const currentUser = await userModel.findById(userId);
      
      if (!currentUser) {
        logger.error('Usuario no encontrado para token válido', {
          userId,
          tokenFragment: token.substring(0, 10) + '...'
        });
        return res.status(404).json({
          success: false,
          errorCode: 'USER_NOT_FOUND',
          message: 'No se encontró el usuario asociado al token'
        });
      }
  
      logger.debug('Usuario encontrado para reset de contraseña', {
        userId,
        hasPassword: !!currentUser.password,
        passwordLength: currentUser.password ? currentUser.password.length : 0
      });
  
      // Verificar que la nueva contraseña no sea igual a la actual
      if (currentUser.password) {
        try {
          const isSamePassword = await bcrypt.compare(finalPassword, currentUser.password);
          
          if (isSamePassword) {
            logger.warn('Intento de usar la misma contraseña', { userId });
            return res.status(400).json({
              success: false,
              errorCode: 'SAME_PASSWORD',
              message: 'La nueva contraseña no puede ser igual a la actual'
            });
          }
        } catch (compareError) {
          logger.error('Error al comparar contraseñas', {
            userId,
            error: compareError.message,
            passwordLength: currentUser.password ? currentUser.password.length : 0,
            finalPasswordLength: finalPassword.length
          });
          
          // Si hay error, continuamos con el proceso pero lo registramos
        }
      }
  
      // Generar hash de la nueva contraseña
      let hashedPassword;
      try {
        hashedPassword = await bcrypt.hash(finalPassword, 10);
        
        logger.debug('Contraseña hasheada correctamente', {
          userId,
          hashLength: hashedPassword.length
        });
      } catch (hashError) {
        logger.error('Error al hashear la contraseña', {
          userId,
          error: hashError.message,
          finalPasswordLength: finalPassword.length
        });
        
        return res.status(500).json({
          success: false,
          errorCode: 'PASSWORD_HASH_ERROR',
          message: 'Error al procesar la nueva contraseña'
        });
      }
  
      // Actualizar la contraseña en la base de datos
      try {
        await userModel.updatePassword(userId, hashedPassword);
        
        logger.info('Contraseña actualizada exitosamente', { userId });
        
        // Marcar el token como usado
        await PasswordReset.markAsUsed(token);
        
        return res.status(200).json({
          success: true,
          message: 'Contraseña actualizada exitosamente'
        });
      } catch (updateError) {
        logger.error('Error al actualizar contraseña en base de datos', {
          userId,
          error: updateError.message,
          stack: updateError.stack
        });
        
        return res.status(500).json({
          success: false,
          errorCode: 'DATABASE_ERROR',
          message: 'Error al guardar la nueva contraseña'
        });
      }
    } catch (error) {
      logger.error('Error no controlado en reset de contraseña', {
        error: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message: 'Error interno al procesar la solicitud'
      });
    }
  }
  /**
   * MÉTODO TEMPORAL: Cambiar contraseña directamente por email
   * Solo para uso administrativo cuando los correos no llegan
   * @swagger
   * /api/password/admin-reset:
   *   post:
   *     summary: Cambio directo de contraseña (temporal)
   *     description: Permite cambiar la contraseña de un usuario directamente usando solo su email
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               mail:
   *                 type: string
   *                 format: email
   *                 description: Email del usuario
   *               newPassword:
   *                 type: string
   *                 minLength: 8
   *                 description: Nueva contraseña
   *               adminToken:
   *                 type: string
   *                 description: Token temporal de seguridad
   *     responses:
   *       200:
   *         description: Contraseña cambiada exitosamente
   *       400:
   *         description: Datos inválidos
   *       403:
   *         description: No autorizado
   *       500:
   *         description: Error interno del servidor
   */
  async adminResetPassword(req, res) {
    try {
      const { mail, newPassword, adminToken } = req.body;
      
      // Token temporal de seguridad (cambiar por algo más seguro)
      const TEMP_ADMIN_TOKEN = 'ARTESA_ADMIN_TEMP_2025';
      
      if (adminToken !== TEMP_ADMIN_TOKEN) {
        return res.status(403).json({
          success: false,
          message: 'Token de administrador inválido'
        });
      }
      
      logger.info('Iniciando cambio directo de contraseña por admin', { mail });
      
      if (!mail || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Email y nueva contraseña son requeridos'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 8 caracteres'
        });
      }

      // Buscar usuario
      const user = await userModel.findByEmail(mail);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Generar hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Actualizar contraseña
      await userModel.updatePassword(user.user_id, hashedPassword);
      
      logger.info('Contraseña cambiada exitosamente por admin', { 
        mail, 
        userId: user.user_id 
      });
      
      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente',
        data: {
          userId: user.user_id,
          mail: mail,
          updatedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Error en cambio directo de contraseña por admin', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al cambiar la contraseña'
      });
    }
  }
}

module.exports = new PasswordResetController();