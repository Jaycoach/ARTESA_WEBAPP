const axios = require('axios');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('RecaptchaValidator');

/**
 * Valida un token de reCAPTCHA
 * @param {string} token - Token de reCAPTCHA generado en el frontend
 * @param {object} req - Objeto request de Express
 * @returns {Promise<boolean>} - true si es válido, false si no
 */
async function validateRecaptcha(token, req) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    logger.warn('RECAPTCHA_SECRET_KEY no configurada, omitiendo validación');
    return true; // Omitir validación si no está configurada
  }
  
  // Permitir bypass de reCAPTCHA en desarrollo cuando se usa ngrok
  if (process.env.NODE_ENV === 'development' && 
      (req.headers?.host?.includes('ngrok') || req.ip?.includes('ngrok'))) {
    logger.warn('Bypass de reCAPTCHA para entorno de desarrollo con ngrok', {
      host: req.headers?.host,
      ip: req.ip
    });
    return true;
  }
  
  if (!token) {
    logger.warn('Token reCAPTCHA no proporcionado');
    return false;
  }
  
  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: req.ip
      }
    });
    
    logger.debug('Respuesta de verificación reCAPTCHA', {
      success: response.data.success,
      score: response.data.score,
      action: response.data.action
    });
    
    // Verificar si la respuesta es exitosa y el score es aceptable (para reCAPTCHA v3)
    if (response.data.success && response.data.score) {
      const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
      return response.data.score >= minScore;
    }
    
    return response.data.success;
  } catch (error) {
    logger.error('Error al validar token reCAPTCHA', {
      error: error.message,
      stack: error.stack
    });
    
    // En caso de error, permitir continuar en desarrollo
    return process.env.NODE_ENV === 'development';
  }
}

module.exports = { validateRecaptcha };