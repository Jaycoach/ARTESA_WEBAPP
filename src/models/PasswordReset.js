/**
 * @typedef {Object} PasswordResetToken
 * @property {number} id - ID del registro de reset
 * @property {number} user_id - ID del usuario
 * @property {string} token - Token único de recuperación
 * @property {boolean} used - Indica si el token ya fue utilizado
 * @property {Date} expires_at - Fecha y hora de expiración
 * @property {Date} created_at - Fecha y hora de creación
 */

const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('PasswordResetModel');

/**
 * Clase que maneja la recuperación de contraseñas
 * @class PasswordReset
 */
class PasswordReset {
  /**
   * Crea un nuevo token de recuperación de contraseña
   * @async
   * @param {number} userId - ID del usuario
   * @param {string} token - Token único generado
   * @param {Date} expiresAt - Fecha y hora de expiración
   * @returns {Promise<PasswordResetToken>} - Información del token creado
   * @throws {Error} Si ocurre un error al crear el token
   */
  static async createToken(userId, token, expiresAt) {
    try {
      logger.debug('Iniciando creación de token de recuperación', { userId });
      
      // Primero, desactiva los tokens anteriores para este usuario
      const deactivateQuery = `
        UPDATE password_resets 
        SET used = true 
        WHERE user_id = $1 AND used = false
      `;
      await pool.query(deactivateQuery, [userId]);
      
      logger.debug('Tokens previos desactivados', { userId });
  
      // Luego, inserta el nuevo token
      const query = `
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const values = [userId, token, expiresAt];
      
      const result = await pool.query(query, values);
      
      logger.info('Token de recuperación creado exitosamente', {
        userId,
        tokenId: result.rows[0].id,
        expiresAt
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error al crear token de recuperación', {
        error: error.message,
        userId
      });
      throw new Error('Error al generar token de recuperación: ' + error.message);
    }
  }

  /**
   * Busca un token por su valor
   * @async
   * @param {string} token - Token a buscar
   * @returns {Promise<Object|null>} - Información del token y usuario asociado, o null si no existe
   */
  static async findByToken(token) {
    try {
      const query = `
        SELECT pr.*, u.mail 
        FROM password_resets pr
        JOIN users u ON u.id = pr.user_id
        WHERE pr.token = $1 AND pr.used = false AND pr.expires_at > NOW()
      `;
      const result = await pool.query(query, [token]);
      
      if (result.rows.length === 0) {
        logger.warn('Token no encontrado o expirado', {
          tokenFragment: token.substring(0, 10) + '...'
        });
        return null;
      }
      
      logger.debug('Token válido encontrado', {
        userId: result.rows[0].user_id,
        tokenId: result.rows[0].id
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error al buscar token', {
        error: error.message,
        tokenFragment: token.substring(0, 10) + '...'
      });
      throw error;
    }
  }

  /**
   * Marca un token como utilizado
   * @async
   * @param {string} token - Token a marcar como utilizado
   * @returns {Promise<Object|null>} - Información del token actualizado, o null si no existe
   */
  static async markAsUsed(token) {
    try {
      const query = `
        UPDATE password_resets
        SET used = true
        WHERE token = $1
        RETURNING *
      `;
      const result = await pool.query(query, [token]);
      
      if (result.rows.length === 0) {
        logger.warn('Token no encontrado al marcar como usado', {
          tokenFragment: token.substring(0, 10) + '...'
        });
        return null;
      }
      
      logger.info('Token marcado como usado exitosamente', {
        userId: result.rows[0].user_id,
        tokenId: result.rows[0].id
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error al marcar token como usado', {
        error: error.message,
        tokenFragment: token.substring(0, 10) + '...'
      });
      throw error;
    }
  }
}

module.exports = PasswordReset;