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
const crypto = require('crypto');
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
      // Bug corregido (6i): antes se ignoraba el expiresAt recibido y se sombreaba con un
      // valor fijo de 24h. Único llamador real (passwordResetController.js:119,122) ya pasaba
      // 1 hora -- ahora se respeta, coincidiendo con el mensaje del correo ("expira en 1 hora").
      const now = new Date();

      const query = `
        INSERT INTO password_resets (user_id, token, expires_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING *
      `;
      const values = [userId, token, expiresAt, now];
      
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
   * Crea un token de recuperación DENTRO de una transacción externa.
   * Reutiliza la misma invalidación de tokens previos y el mismo esquema de
   * inserción que createToken() (ver paridad verificada en el checkpoint de
   * Fase 2, archivo 6b), pero participa en la transacción del llamador y
   * respeta el expiresAt recibido (createToken() lo ignora, ver Fase 2/6i).
   * @async
   * @param {import('pg').PoolClient} dbClient - Cliente de una transacción ya iniciada (BEGIN)
   * @param {number} userId - ID del usuario
   * @param {Date} expiresAt - Fecha y hora de expiración exacta a respetar (debe ser futura)
   * @returns {Promise<PasswordResetToken>} - Fila insertada (incluye .token)
   * @throws {Error} Si expiresAt/dbClient son inválidos, o si ocurre un error de BD
   *   (preserva error.code: 40P01, 55P03, 23505, etc. para que el llamador lo traduzca)
   */
  static async createTokenWithClient(dbClient, userId, expiresAt) {
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new Error('createTokenWithClient: expiresAt debe ser una fecha válida y futura');
    }
    if (!dbClient || typeof dbClient.query !== 'function') {
      throw new Error('createTokenWithClient: dbClient debe ser un cliente de transacción con método query() (no el pool)');
    }

    try {
      logger.debug('Iniciando creación de token de recuperación (transaccional)', { userId });

      // Misma invalidación que createToken(), con el dbClient de la transacción
      await dbClient.query(
        `UPDATE password_resets
        SET used = true
        WHERE user_id = $1 AND used = false`,
        [userId]
      );

      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      const query = `
        INSERT INTO password_resets (user_id, token, expires_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING *
      `;
      const { rows } = await dbClient.query(query, [userId, token, expiresAt, now]);

      logger.info('Token de recuperación creado exitosamente (transaccional)', {
        userId,
        tokenId: rows[0].id,
        expiresAt
      });

      return rows[0];
    } catch (error) {
      logger.error('Error al crear token de recuperación (transaccional)', {
        error: error.message,
        code: error.code,
        userId
      });
      throw error;
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