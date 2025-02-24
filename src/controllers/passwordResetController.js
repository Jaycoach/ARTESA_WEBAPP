const crypto = require('crypto');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const PasswordReset = require('../models/PasswordReset');
const { createContextLogger } = require('../config/logger');
const EmailService = require('../services/EmailService');

// Crear una instancia del logger con contexto
const logger = createContextLogger('PasswordResetController');

class PasswordResetController {
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