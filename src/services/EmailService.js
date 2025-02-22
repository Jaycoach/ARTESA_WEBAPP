const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // Para Mailtrap en otro servidor de correo cambiar a true
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendPasswordResetEmail(mail, resetToken) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      
      console.log('Enviando correo a:', mail);
      console.log('Token de reset:', resetToken);
      console.log('URL de reset:', resetUrl);
      
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: mail,
        subject: 'Recuperación de Contraseña - La Artesa',
        html: `
          <h1>Recuperación de Contraseña</h1>
          <p>Has solicitado restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <a href="${resetUrl}">${resetUrl}</a>
          <p>Este enlace expirará en 1 hora.</p>
          <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
        `
      };
  
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Correo enviado exitosamente:', info);
      return info;
    } catch (error) {
      console.error('Error detallado al enviar correo:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();