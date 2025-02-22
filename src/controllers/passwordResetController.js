const crypto = require('crypto');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const PasswordReset = require('../models/PasswordReset');
const EmailService = require('../services/EmailService');

class PasswordResetController {
  async requestReset(req, res) {
    try {
      const { mail } = req.body;
      console.log('Mail recibido:', mail);
      
      // Buscar usuario
      const user = await userModel.findByEmail(mail);
      console.log('Usuario encontrado:', user);
      if (!user) {
        return res.status(200).json({ 
          message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña'
        });
      }

      // Verificar explícitamente el user_id
      if (!user.user_id) {
        console.error('No se encontró user_id para el usuario');
        return res.status(400).json({ 
          error: 'No se pudo identificar el usuario' 
        });
      }

      // Generar token único
      const resetToken = crypto.randomBytes(32).toString('hex');
      console.log('Token generado:', resetToken);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      // Guardar token
      const tokenRecord = await PasswordReset.createToken(user.user_id, resetToken, expiresAt);
      console.log('Registro de token:', tokenRecord);

      // En desarrollo, mostrar el token para pruebas
      if (process.env.NODE_ENV === 'development') {
        console.log('Token generado para pruebas:', resetToken);
      }

      // Enviar email
      try {
        console.log('Intentando enviar correo a:', mail);
        await EmailService.sendPasswordResetEmail(mail, resetToken);
        console.log('Correo enviado exitosamente');
      } catch (emailError) {
        console.error('Error completo al enviar email:', emailError);
        // En desarrollo, aún así devolvemos éxito para poder probar con el token
        if (process.env.NODE_ENV === 'development') {
          return res.json({ 
            message: 'Token generado (modo desarrollo)',
            token: resetToken // Solo en desarrollo
          });
        }
      }
  
      res.json({ 
        message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña'
      });
    } catch (error) {
      console.error('Error detallado en recuperación de contraseña:', error);
      res.status(500).json({ 
        error: 'Error al procesar la solicitud de recuperación de contraseña' 
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Verificar token
      const resetRequest = await PasswordReset.findByToken(token);
      if (!resetRequest) {
        return res.status(400).json({ 
          error: 'Token inválido o expirado' 
        });
      }

      console.log('Reset Request:', resetRequest);

      // Hash nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar contraseña
      await userModel.updatePassword(resetRequest.user_id, hashedPassword);

      // Marcar token como usado
      await PasswordReset.markAsUsed(token);

      res.json({ 
        message: 'Contraseña actualizada exitosamente' 
      });
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      res.status(500).json({ 
        error: 'Error al restablecer la contraseña' 
      });
    }
  }
}

module.exports = new PasswordResetController();