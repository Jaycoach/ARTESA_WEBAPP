const nodemailer = require('nodemailer');
const logger = require('../config/logger'); 

class EmailService {
  constructor() {
    console.log('Puerto SMTP:', process.env.SMTP_PORT);
    console.log('Puerto SMTP (parseado):', parseInt(process.env.SMTP_PORT));

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false, // Para Mailtrap en otro servidor de correo cambiar a true o para otros puertos != 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      debug: true, // Habilitar debugging
      logger: false  // Log de las operaciones SMTP
    });
    // Verificar la conexión al iniciar
    this.verifyConnection();
  }
  
  async verifyConnection() {
    try {
        await this.transporter.verify();
        logger.info('Conexión SMTP verificada exitosamente');
    } catch (error) {
        logger.error('Error al verificar conexión SMTP:', error);
        throw error;
    }
  }

  async sendPasswordResetEmail(userEmail, resetToken) {
    try {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        logger.info('Intentando enviar correo de recuperación', {
            to: userEmail,
            resetUrl: resetUrl
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
        logger.error('Error al enviar correo:', error);
        throw new Error(`Error al enviar el correo: ${error.message}`);
    }
  }
}

module.exports = new EmailService();