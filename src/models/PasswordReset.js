const { Pool } = require('pg');
const pool = require('../config/db');

class PasswordReset {
  static async createToken(userId, token, expiresAt) {
    try {
      // Primero, desactiva los tokens anteriores para este usuario
      const deactivateQuery = `
        UPDATE password_resets 
        SET used = true 
        WHERE user_id = $1 AND used = false
      `;
      await pool.query(deactivateQuery, [userId]);
  
      // Luego, inserta el nuevo token
      const query = `
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const values = [userId, token, expiresAt];
      
      const result = await pool.query(query, values);
      
      console.log('Resultado de creación de token:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error detallado al crear token:', error);
      throw new Error('Error al generar token de recuperación: ' + error.message);
    }
  }

  static async findByToken(token) {
    const query = `
      SELECT pr.*, u.mail 
      FROM password_resets pr
      JOIN users u ON u.id = pr.user_id
      WHERE pr.token = $1 AND pr.used = false AND pr.expires_at > NOW()
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0];
  }

  static async markAsUsed(token) {
    const query = `
      UPDATE password_resets
      SET used = true
      WHERE token = $1
      RETURNING *
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0];
  }
}

module.exports = PasswordReset;
