const { Pool } = require('pg');
const pool = require('../config/db');

class PasswordReset {
  static async createToken(userId, token, expiresAt) {
    try {
      const query = `
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const values = [userId, token, expiresAt];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error al crear token:', error);
      throw new Error('Error al generar token de recuperación');
    }
  }

  static async findByToken(token) {
    const query = `
      SELECT pr.*, u.email 
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
