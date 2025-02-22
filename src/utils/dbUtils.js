const { Pool } = require('pg');
const pool = require('../config/db');

class DatabaseUtils {
  // Método para ejecutar consultas parametrizadas
  static async query(text, params) {
    const client = await pool.connect();
    try {
      const start = Date.now();
      const res = await client.query(text, params);
      const duration = Date.now() - start;
      
      console.log('Executed query', {
        text,
        duration,
        rows: res.rowCount
      });
      
      return res;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  // Método para transacciones
  static async executeTransaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Método para construir consultas WHERE de forma segura
  static buildWhereClause(filters) {
    const conditions = [];
    const values = [];
    let paramCount = 1;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    return {
      whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    };
  }

  // Método para construir consultas UPDATE de forma segura
  static buildUpdateQuery(table, data, whereCondition) {
    const setClauses = [];
    const values = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        setClauses.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    const whereValues = Object.values(whereCondition);
    const whereClauses = Object.keys(whereCondition)
      .map(key => `${key} = $${paramCount++}`)
      .join(' AND ');

    const query = `
      UPDATE ${table}
      SET ${setClauses.join(', ')}
      WHERE ${whereClauses}
      RETURNING *
    `;

    return {
      query,
      values: [...values, ...whereValues]
    };
  }

  // Método para validar y sanitizar nombres de tablas y columnas
  static validateIdentifier(identifier) {
    // Solo permitir letras, números y guiones bajos
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }
}

module.exports = DatabaseUtils;