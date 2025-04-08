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
  // Comprobar si la validación de reCAPTCHA está habilitada
  if (process.env.RECAPTCHA_ENABLED !== 'true') {
    logger.info('reCAPTCHA deshabilitado en configuración, omitiendo validación');
    return true;
  }
  
  // Si estamos en desarrollo y el token parece un token de prueba específico
  if (process.env.NODE_ENV === 'development' && token === 'development-test-token') {
    logger.info('Usando token de prueba para desarrollo', {
      ip: req.ip
    });
    return true;
  }

  // Si no es desarrollo, verificar configuración explícita de bypass
  if (process.env.RECAPTCHA_BYPASS === 'true') {
    logger.info('Bypass de reCAPTCHA habilitado por configuración', {
      ip: req.ip
    });
    return true;
  }
  
  // Verificar que la clave secreta exista
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    logger.warn('RECAPTCHA_SECRET_KEY no configurada pero reCAPTCHA está habilitado');
    // En producción, podrías querer rechazar la solicitud si falta la clave
    return process.env.NODE_ENV !== 'production';
  }
  
  if (!token) {
    logger.warn('Token reCAPTCHA no proporcionado');
    return false;
  }
  
  try {
    logger.debug('Enviando solicitud de verificación a Google reCAPTCHA', {
      tokenFragment: token.substring(0, 10) + '...',
      ip: req.ip
    });
    
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: req.ip
      }
    });
    
    // Log detallado de la respuesta
    logger.debug('Respuesta de verificación reCAPTCHA', {
      success: response.data.success,
      score: response.data.score,
      action: response.data.action,
      errorCodes: response.data['error-codes'],
      hostname: response.data.hostname
    });
    
    // Para reCAPTCHA v3, verificar el score
    if (response.data.success && response.data.score !== undefined) {
      const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
      const isValid = response.data.score >= minScore;
      
      logger.info('Verificación reCAPTCHA v3 completada', {
        success: isValid,
        score: response.data.score,
        minScore: minScore,
        action: response.data.action
      });
      
      return isValid;
    }
    
    // Para reCAPTCHA v2, solo verificar success
    logger.info('Verificación reCAPTCHA v2 completada', {
      success: response.data.success,
      errorCodes: response.data['error-codes']
    });
    
    return response.data.success;
  } catch (error) {
    logger.error('Error al validar token reCAPTCHA', {
      error: error.message,
      stack: error.stack,
      config: error.config ? {
        url: error.config.url,
        params: error.config.params
      } : 'No disponible'
    });
    
    // Permitir bypass de reCAPTCHA SOLO en desarrollo
    if (process.env.NODE_ENV === 'development') {
      logger.info('Bypass de reCAPTCHA para entorno de desarrollo', {
        host: req.headers?.host,
        ip: req.ip
      });
      return true;
    }

    // Permitir un token específico para pruebas en desarrollo
    if (process.env.NODE_ENV === 'development' && token === 'development-test-token') {
      logger.info('Usando token de prueba específico para desarrollo', {
        ip: req.ip
      });
      return true;
    }

    // En producción, siempre verificar el token
    if (process.env.NODE_ENV === 'production' && (!token || token.length < 20)) {
      logger.warn('Token reCAPTCHA inválido o demasiado corto en producción', {
        tokenLength: token ? token.length : 0,
        ip: req.ip
      });
      return false;
    }
  }
}

module.exports = { validateRecaptcha };