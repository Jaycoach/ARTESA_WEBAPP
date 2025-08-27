// test-smtp-simple.js
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSMTP() {
    console.log('🔍 Probando configuración SMTP básica...\n');
    
    const transporter = nodemailer.createTransport({ // ✅ Cambio: createTransport (sin "er")
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        debug: true,
        logger: true
    });

    try {
        // Verificar conexión
        console.log('📡 Verificando conexión...');
        await transporter.verify();
        console.log('✅ Conexión SMTP verificada\n');

        // Enviar correo de prueba
        console.log('📧 Enviando correo de prueba...');
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: 'lukopay@gmail.com', // Cambiar por tu email
            subject: 'Prueba SMTP - La Artesa',
            html: `
                <h2>Prueba de SMTP</h2>
                <p>Este es un correo de prueba enviado el ${new Date()}</p>
                <p>Si recibes este correo, la configuración SMTP está funcionando correctamente.</p>
            `
        });

        console.log('✅ Correo enviado exitosamente');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        
    } catch (error) {
        console.log('❌ Error:', error.message);
        console.log('Stack:', error.stack);
    }
}

testSMTP();