const crypto = require('crypto');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const PasswordReset = require('../models/PasswordReset');
const logger = require('../config/logger');
const EmailService = require('../services/EmailService');

class PasswordResetController {
  async requestReset(req, res) {
    try {
      const { mail } = req.body;
      logger.debug('Mail recibido:', mail);
      
      // Buscar usuario
      const user = await userModel.findByEmail(mail);
      logger.debug('Usuario encontrado:', user);
      
      if (!user) {
        return res.status(200).json({ 
          message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña'
        });
      }

      // Verificar explícitamente el user_id
      if (!user.user_id) {
        logger.error('No se encontró user_id para el usuario');
        return res.status(400).json({ 
          error: 'No se pudo identificar el usuario' 
        });
      }

      // Generar token único
      const resetToken = crypto.randomBytes(32).toString('hex');
      logger.debug('Token generado:', resetToken);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      // Guardar token
      await PasswordReset.createToken(user.user_id, resetToken, expiresAt);

      // Enviar correo con el token
      try {
        await EmailService.sendPasswordResetEmail(mail, resetToken);
        logger.info('Correo de recuperación enviado', { mail });
      } catch (emailError) {
        logger.error('Error al enviar correo de recuperación', { 
          error: emailError.message,
          mail 
        });
        // No retornamos el error al cliente por seguridad
      }

      // En desarrollo, mostrar el token para pruebas
      if (process.env.NODE_ENV === 'development') {
        logger.info('Token generado para pruebas:', resetToken);
        return res.json({ 
          message: 'Token generado (modo desarrollo)',
          token: resetToken
        });
      }

      res.json({ 
        message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña'
      });
    } catch (error) {
      logger.error('Error detallado en recuperación de contraseña:', error);
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
        logger.warn('Token inválido o expirado', { token: token.substring(0, 10) });
        return res.status(400).json({ 
          error: 'Token inválido o expirado' 
        });
      }

      // 1.5 Obtener usuario y verificar contraseña actual
      const currentUser = await userModel.findById(resetRequest.user_id);
      if (!currentUser) {
        logger.error('Usuario no encontrado para el token de reset');
        return res.status(400).json({
          error: 'Error al procesar la solicitud'
        });
      }

      // Verificar que la nueva contraseña no sea igual a la actual
      const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);
      if (isSamePassword) {
        logger.warn('Intento de usar la misma contraseña', {
          userId: resetRequest.user_id
        });
        return res.status(400).json({
          error: 'La nueva contraseña no puede ser igual a la actual'
        });
      }

      // 2. Generar nuevo hash
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Debug: Verificar el hash generado
      logger.debug('Verificación de hash generado', {
        passwordLength: newPassword.length,
        hashLength: hashedPassword.length,
        hashStart: hashedPassword.substring(0, 7)
      });

      // 3. Verificar que el hash es válido antes de guardarlo
      try {
        const verificationTest = await bcrypt.compare(newPassword, hashedPassword);
        if (!verificationTest) {
          throw new Error('Hash verification failed');
        }
        logger.debug('Verificación de hash exitosa');
      } catch (verifyError) {
        logger.error('Error en verificación de hash', verifyError);
        throw verifyError;
      }

      // 4. Actualizar la contraseña
      await userModel.updatePassword(resetRequest.user_id, hashedPassword);

      // 5. Marcar token como usado
      await PasswordReset.markAsUsed(token);

      // 6. Hacer una verificación final
      const user = await userModel.findById(resetRequest.user_id);
      const finalCheck = await bcrypt.compare(newPassword, user.password);
      
      logger.info('Reset de contraseña completado', {
        userId: resetRequest.user_id,
        verificationSuccess: finalCheck
      });

      return res.json({ 
        success: true,
        message: 'Contraseña actualizada exitosamente',
        verified: finalCheck
      });
    } catch (error) {
      logger.error('Error en reset de contraseña', {
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