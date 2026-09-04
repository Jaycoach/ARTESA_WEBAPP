#!/usr/bin/env node
// Envia la alerta de expiracion de certificado SSL reutilizando el EmailService
// (SES via SMTP) ya existente en el proyecto. Pensado para invocarse via
// `docker exec` desde scripts/production/ssl-expiry-check-cron.sh, dentro del
// contenedor de la app (mismas env vars / mismo transporte que el resto del
// sistema de correo).
//
// Uso: node scripts/production/ssl-expiry-mailer.js <dominio>
// El cuerpo del correo (salida de check-ssl-cert.sh) se recibe por stdin.

'use strict';

const EmailService = require('../../src/services/EmailService');

async function main() {
  const domain = process.argv[2];
  if (!domain) {
    console.error('MAIL_SEND_FAILED Uso: ssl-expiry-mailer.js <dominio> (body por stdin)');
    process.exit(1);
  }

  const to = process.env.SSL_ALERT_EMAIL_TO;
  if (!to) {
    console.error('MAIL_SEND_FAILED SSL_ALERT_EMAIL_TO no esta configurado');
    process.exit(1);
  }

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const checkOutput = Buffer.concat(chunks).toString('utf8') || '(sin salida del script de verificacion)';

  try {
    const info = await EmailService.sendMailWithLimits({
      from: { name: 'La Artesa - Monitoreo SSL', address: process.env.SMTP_FROM },
      to,
      subject: `[ALERTA SSL] ${domain} — certificado por vencer o vencido`,
      text: `El chequeo de expiracion de certificado para ${domain} no paso el umbral configurado.\n\nSalida de scripts/tests/check-ssl-cert.sh:\n\n${checkOutput}`,
    });
    console.log('MAIL_SENT_OK', info && info.messageId ? info.messageId : '');
    process.exit(0);
  } catch (error) {
    console.error('MAIL_SEND_FAILED', error.message);
    process.exit(1);
  }
}

main();
