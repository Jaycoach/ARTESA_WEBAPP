const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('TokenRevocation');

/**
 * Clase para manejar la revocación de tokens
 */
class TokenRevocation {
  /**
   * Verifica si un token está revocado
   * @param {string} token - Token JWT a verificar
   * @returns {Promise<boolean>} - true si el token está revocado, false si es válido
   */
  static async isTokenRevoked(token) {
    try {
      // Crear hash del token para almacenamiento eficiente
      const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
      
      const query = 'SELECT 1 FROM revoked_tokens WHERE token_hash = $1 AND expires_at > NOW()';
      const result = await pool.query(query, [tokenHash]);
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error al verificar revocación de token', {
        error: error.message,
        stack: error.stack
      });
      // En caso de error, asumimos que el token es válido para evitar bloqueos no deseados
      return false;
    }
  }

  /**
   * Revoca un token específico
   * @param {string} token - Token JWT a revocar
   * @param {number} userId - ID del usuario asociado al token
   * @param {Date} expiresAt - Fecha de expiración del token
   * @returns {Promise<boolean>} - true si se revocó exitosamente
   */
  static async revokeToken(token, userId, expiresAt) {
    try {
      // Crear hash del token para almacenamiento eficiente
      const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
      
      const query = `
        INSERT INTO revoked_tokens (token_hash, user_id, revoked_at, expires_at, revocation_reason)
        VALUES ($1, $2, NOW(), $3, 'user_logout')
        ON CONFLICT (token_hash) DO NOTHING
      `;
      
      await pool.query(query, [tokenHash, userId, expiresAt]);
      
      logger.info('Token revocado exitosamente', { userId });
      return true;
    } catch (error) {
      logger.error('Error al revocar token', {
        error: error.message,
        userId,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Revoca todos los tokens de un usuario
   * @param {number} userId - ID del usuario
   * @param {string} reason - Razón de la revocación
   * @returns {Promise<boolean>} - true si se revocaron exitosamente
   */
  static async revokeAllUserTokens(userId, reason = 'security_measure') {
    try {
      // ✅ CAMBIO CRÍTICO: Usar timestamp más preciso y con margen de seguridad
      const revokeBeforeTime = new Date(); // Tiempo actual exacto
      
      const query = `
        INSERT INTO revoked_tokens (token_hash, user_id, revoked_at, expires_at, revocation_reason, revoke_all_before)
        VALUES ('all_tokens_' || $1 || '_' || extract(epoch from now()), $1, NOW(), NOW() + INTERVAL '30 days', $2, $3)
        ON CONFLICT (token_hash) 
        DO UPDATE SET 
          revoked_at = NOW(),
          expires_at = NOW() + INTERVAL '30 days',
          revocation_reason = $2,
          revoke_all_before = $3
      `;
      
      await pool.query(query, [userId, reason, revokeBeforeTime]);
      
      logger.info('Todos los tokens del usuario revocados', { 
        userId,
        reason,
        revokeBeforeTime
      });
      
      return true;
    } catch (error) {
      logger.error('Error al revocar todos los tokens del usuario', {
        error: error.message,
        userId,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Limpia tokens revocados expirados
   * @returns {Promise<number>} - Cantidad de registros eliminados
   */
  static async cleanupExpiredTokens() {
    try {
      const query = 'DELETE FROM revoked_tokens WHERE expires_at < NOW()';
      const result = await pool.query(query);
      
      const deletedCount = result.rowCount;
      
      if (deletedCount > 0) {
        logger.info('Tokens revocados expirados eliminados', {
          count: deletedCount
        });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Error al limpiar tokens revocados expirados', {
        error: error.message,
        stack: error.stack
      });
      return 0;
    }
  }

  /**
   * Registra un token activo en la base de datos
   * @param {string} token - Token JWT
   * @param {number} userId - ID del usuario
   * @param {Date} expiresAt - Fecha de expiración del token
   * @returns {Promise<boolean>} - true si se registró exitosamente
   */
  static async registerActiveToken(token, userId, expiresAt) {
    try {
      // Crear hash del token para almacenamiento eficiente
      const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
      
      const query = `
        INSERT INTO active_tokens (token_hash, user_id, issued_at, expires_at)
        VALUES ($1, $2, NOW(), $3)
        ON CONFLICT (token_hash) DO NOTHING
      `;
      
      await pool.query(query, [tokenHash, userId, expiresAt]);
      
      return true;
    } catch (error) {
      logger.error('Error al registrar token activo', {
        error: error.message,
        userId,
        stack: error.stack
      });
      return false;
    }
  }
}

/**
 * Middleware para verificar si un token está revocado
 */
const checkTokenRevocation = async (req, res, next) => {
  try {
    // Skip this middleware if no authorization header is present
    // (the actual auth middleware will handle this case)
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
      return next();
    }

    const token = req.headers.authorization.split(' ')[1];
    
    // Verificar si el token está revocado
    const isRevoked = await TokenRevocation.isTokenRevoked(token);
    
    if (isRevoked) {
      logger.warn('Intento de uso de token revocado', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'La sesión ha expirado o ha sido revocada. Por favor, inicie sesión nuevamente.',
        code: 'TOKEN_REVOKED'
      });
    }

    // Si el token no está revocado, continuar con la solicitud
    next();
  } catch (error) {
    logger.error('Error en middleware de revocación de tokens', {
      error: error.message,
      stack: error.stack
    });
    next();
  }
};

// Exportar el middleware y la clase de utilidad
module.exports = {
  checkTokenRevocation,
  TokenRevocation
};