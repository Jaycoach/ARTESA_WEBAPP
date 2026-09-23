const nodemailer = require('nodemailer');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('EmailService');

// Escapa caracteres HTML especiales antes de interpolar valores de usuario en un template.
// No existía ningún helper equivalente en el proyecto (verificado con git grep).
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class EmailService {
  constructor() {
    logger.debug('Inicializando EmailService con AWS SES (Capa Gratuita)', {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT),
      dailyLimit: process.env.SES_DAILY_LIMIT,
      rateLimit: process.env.SES_RATE_LIMIT
    });

    this.transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // false para puerto 587
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    // Configuración para capa gratuita
    pool: true,
    maxConnections: 1,
    maxMessages: 14, // Límite de rate
    rateDelta: 1000, // 1 segundo
    rateLimit: 14, // 14 por segundo máximo
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  });
    
    // Verificar la conexión al iniciar
    this.verifyConnection();
  }
  
  async verifyConnection() {
    try {
        await this.transporter.verify();
        logger.info('Conexión SMTP verificada exitosamente');
    } catch (error) {
        logger.error('Error al verificar conexión SMTP:', { error: error.message });
        throw error;
    }
  }

  /**
   * Verifica si se pueden enviar más correos (límite diario)
   */
  async checkDailyLimit() {
    // En producción, aquí implementarías un contador en Redis o base de datos
    // Por ahora, solo logueamos
    logger.debug('Verificando límite diario de SES', {
      dailyLimit: process.env.SES_DAILY_LIMIT,
      currentDate: new Date().toDateString()
    });
    return true;
  }

  /**
   * Envía correo con validaciones de capa gratuita
   */
  async sendMailWithLimits(mailOptions) {
    try {
      // Verificar límite diario
      const canSend = await this.checkDailyLimit();
      if (!canSend) {
        throw new Error('Límite diario de correos alcanzado (200/día)');
      }

      logger.info('Enviando correo con AWS SES', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        from: mailOptions.from
      });

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Correo enviado exitosamente con SES', {
        messageId: info.messageId,
        response: info.response
      });

      return info;
    } catch (error) {
      logger.error('Error al enviar correo con SES:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async sendPasswordResetEmail(userEmail, resetToken) {
    try {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        logger.info('Intentando enviar correo de recuperación', {
            to: userEmail
        });

        const mailOptions = {
            from: {
                name: 'La Artesa',
                address: process.env.SMTP_FROM
            },
            to: userEmail,
            subject: 'Recuperación de Contraseña - La Artesa',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333;">Recuperación de Contraseña</h1>
                    <p>Has solicitado restablecer tu contraseña.</p>
                    <p>Utiliza el siguiente token para restablecer tu contraseña:</p>
                    <div style="background-color: #f5f5f5; padding: 10px; margin: 20px 0; word-break: break-all;">
                        <code>${resetToken}</code>
                    </div>
                    <p>O haz clic en el siguiente enlace:</p>
                    <a href="${resetUrl}" 
                       style="display: inline-block; padding: 10px 20px; 
                              background-color: #007bff; color: white; 
                              text-decoration: none; border-radius: 5px;">
                        Restablecer Contraseña
                    </a>
                    <p>Este enlace expirará en 1 hora.</p>
                    <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">
                        Este es un correo automático, por favor no respondas a este mensaje.
                    </p>
                </div>
            `
        };

        const info = await this.transporter.sendMail(mailOptions);
        logger.info('Correo enviado exitosamente', {
            messageId: info.messageId,
            response: info.response
        });

        return info;
    } catch (error) {
        logger.error('Error al enviar correo:', {
            error: error.message,
            stack: error.stack
        });
        throw new Error(`Error al enviar el correo: ${error.message}`);
    }
  }

  async sendVerificationEmail(userEmail, verificationToken, verificationUrl) {
    try {
      logger.info('Intentando enviar correo de verificación', {
        to: userEmail
      });
  
      const mailOptions = {
        from: {
          name: 'La Artesa',
          address: process.env.SMTP_FROM
        },
        to: userEmail,
        subject: 'Verificación de Correo Electrónico - La Artesa',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Verificación de Correo Electrónico</h1>
            <p>Gracias por registrarte en La Artesa. Por favor, verifica tu dirección de correo electrónico para activar tu cuenta.</p>
            <p>Utiliza el siguiente token para verificar tu correo:</p>
            <div style="background-color: #f5f5f5; padding: 10px; margin: 20px 0; word-break: break-all;">
              <code>${verificationToken}</code>
            </div>
            <p>O haz clic en el siguiente enlace:</p>
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 10px 20px; 
                      background-color: #007bff; color: white; 
                      text-decoration: none; border-radius: 5px;">
              Verificar Correo Electrónico
            </a>
            <p>Este enlace expirará en 24 horas.</p>
            <p>Si no solicitaste este registro, puedes ignorar este correo.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        `
      };
  
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Correo de verificación enviado exitosamente', {
        messageId: info.messageId,
        response: info.response
      });
  
      return info;
    } catch (error) {
      logger.error('Error al enviar correo de verificación:', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Error al enviar el correo de verificación: ${error.message}`);
    }
  }
  async sendVerificationConfirmationEmail(userEmail, userName) {
    try {
      logger.info('Intentando enviar correo de confirmación de verificación', {
        to: userEmail,
        userName: userName || 'No proporcionado'
      });

      const displayName = userName || 'Estimado Usuario';

      const mailOptions = {
        from: {
          name: 'La Artesa',
          address: process.env.SMTP_FROM
        },
        to: userEmail,
        subject: 'Bienvenido a La Artesa - Correo Verificado',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">¡Gracias por verificar tu correo!</h1>
            <p>Hola ${displayName},</p>
            <p>Tu correo electrónico ha sido verificado exitosamente. Ahora puedes disfrutar de todos los beneficios de nuestra plataforma.</p>
            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff;">
              <p style="margin: 0;">Tu cuenta está activa y puedes iniciar sesión cuando lo desees.</p>
            </div>
            <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
            <p>Saludos cordiales,<br>El equipo de La Artesa</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        `
      };
  
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Correo de confirmación de verificación enviado exitosamente', {
        messageId: info.messageId,
        response: info.response
      });
  
      return info;
    } catch (error) {
      logger.error('Error al enviar correo de confirmación de verificación:', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Error al enviar el correo de confirmación de verificación: ${error.message}`);
    }
  }
  /**
   * Enviar email de verificación para sucursal
   */
  async sendBranchVerificationEmail(email, token, branchName) {
      try {
          // ✅ CORRECCIÓN: URL correcta para verificación de sucursal
          const verificationUrl = `${process.env.FRONTEND_URL}/branch-verify-email/${token}`;
          
          const mailOptions = {
              from: {
                  name: 'La Artesa',
                  address: process.env.SMTP_FROM
              },
              to: email,
              subject: `Verificar email de sucursal - ${branchName}`,
              html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2>Verificación de Email - Sucursal ${branchName}</h2>
                      <p>Para completar el acceso a tu sucursal, verifica tu dirección de email haciendo clic en el siguiente enlace:</p>
                      <p style="text-align: center; margin: 30px 0;">
                          <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">
                              Verificar Email
                          </a>
                      </p>
                      <p>Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
                      <p style="word-break: break-all;">${verificationUrl}</p>
                      <p><strong>Importante:</strong> Después de verificar tu email, deberás completar la configuración de tu contraseña si es la primera vez que accedes.</p>
                      <p>Este enlace expirará en 24 horas.</p>
                      <hr>
                      <p style="color: #666; font-size: 12px;">
                          Este es un correo automático de La Artesa. No respondas a este mensaje.
                      </p>
                  </div>
              `
          };

          const info = await this.sendMailWithLimits(mailOptions);
          logger.info('Correo de verificación de sucursal enviado exitosamente', {
              messageId: info.messageId,
              response: info.response,
              to: email,
              branchName
          });

          return info;
      } catch (error) {
          logger.error('Error al enviar correo de verificación para sucursal:', {
              error: error.message,
              stack: error.stack,
              email,
              branchName
          });
          throw new Error(`Error al enviar el correo de verificación: ${error.message}`);
      }
  }

  /**
   * Enviar email de reset de contraseña para sucursal
   */
  async sendBranchPasswordResetEmail(email, token, branchName, companyName) {
      try {
          const resetUrl = `${process.env.FRONTEND_URL}/branch-reset-password?token=${token}`;
          
          const mailOptions = {
              from: {
                  name: 'La Artesa',
                  address: process.env.SMTP_FROM
              },
              to: email,
              subject: `Restablecer contraseña - Sucursal ${branchName}`,
              html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2>Restablecimiento de Contraseña</h2>
                      <p><strong>Sucursal:</strong> ${branchName}</p>
                      <p><strong>Cliente:</strong> ${companyName}</p>
                      <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
                      <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">
                          Restablecer Contraseña
                      </a>
                      <p>Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
                      <p>${resetUrl}</p>
                      <p>Este enlace expirará en 1 hora.</p>
                      <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                  </div>
              `
          };

          const info = await this.transporter.sendMail(mailOptions);
          logger.info('Correo de reset de contraseña para sucursal enviado exitosamente', {
              messageId: info.messageId,
              response: info.response
          });

          return info;
      } catch (error) {
          logger.error('Error al enviar correo de reset para sucursal:', {
              error: error.message,
              stack: error.stack
          });
          throw new Error(`Error al enviar el correo de reset: ${error.message}`);
      }
  }

  /**
   * Envía la invitación de un usuario de plataforma nuevo (ADMIN/FUNCTIONAL_ADMIN) para
   * definir su contraseña. Reutiliza la misma ruta de finalización que sendPasswordResetEmail
   * (/reset-password/:token) — el token vive en password_resets, no hace falta pantalla nueva.
   * NUNCA loguea el token ni la URL de invitación (el token permite definir una contraseña
   * de ADMIN); los logs solo llevan { to, type: 'platform_user_invitation' }.
   * @param {string} userEmail
   * @param {string} userName
   * @param {string} invitationToken
   * @param {string} roleName
   * @param {number} expiryHours - horas de expiración a mostrar en el correo (ver
   *   src/constants/backofficeCore.js INVITATION_EXPIRY_HOURS, fuente única de verdad)
   */
  async sendPlatformUserInvitationEmail(userEmail, userName, invitationToken, roleName, expiryHours) {
    try {
      const invitationUrl = `${process.env.FRONTEND_URL}/reset-password/${invitationToken}`;

      logger.info('Intentando enviar correo de invitación de usuario de plataforma', {
        to: userEmail,
        type: 'platform_user_invitation'
      });

      const safeUserName = escapeHtml(userName);
      const safeRoleName = escapeHtml(roleName);

      const mailOptions = {
        from: {
          name: 'La Artesa',
          address: process.env.SMTP_FROM
        },
        to: userEmail,
        subject: 'Invitación al BackOffice - La Artesa',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Bienvenido al BackOffice de La Artesa</h1>
            <p>Hola ${safeUserName},</p>
            <p>Se creó una cuenta para ti en el BackOffice de La Artesa con el rol <strong>${safeRoleName}</strong>.</p>
            <p>Para activarla, define tu contraseña con el siguiente enlace:</p>
            <a href="${invitationUrl}"
               style="display: inline-block; padding: 10px 20px;
                      background-color: #007bff; color: white;
                      text-decoration: none; border-radius: 5px;">
              Definir mi contraseña
            </a>
            <p>Este enlace expirará en ${expiryHours} horas.</p>
            <p>Si no esperabas esta invitación, puedes ignorar este correo.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Correo de invitación de usuario de plataforma enviado exitosamente', {
        messageId: info.messageId,
        response: info.response,
        to: userEmail,
        type: 'platform_user_invitation'
      });

      return info;
    } catch (error) {
      logger.error('Error al enviar correo de invitación de usuario de plataforma:', {
        error: error.message,
        stack: error.stack,
        type: 'platform_user_invitation'
      });
      throw new Error(`Error al enviar el correo de invitación: ${error.message}`);
    }
  }
}


module.exports = new EmailService();