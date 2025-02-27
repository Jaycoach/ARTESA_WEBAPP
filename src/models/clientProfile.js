// src/models/ClientProfile.js
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ClientProfileModel');

/**
 * Clase que representa el modelo de perfiles de cliente
 * @class ClientProfile
 */
class ClientProfile {
  /**
   * Obtiene un perfil de cliente por su ID
   * @async
   * @param {number} clientId - ID del perfil de cliente
   * @returns {Promise<Object|null>} - Perfil de cliente encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getById(clientId) {
    try {
      logger.debug('Buscando perfil de cliente por ID', { clientId });
      
      const query = `
        SELECT cp.*, u.name as user_name, u.mail as user_email 
        FROM client_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.client_id = $1;
      `;
      
      const { rows } = await pool.query(query, [clientId]);
      
      if (rows.length === 0) {
        logger.debug('Perfil de cliente no encontrado', { clientId });
        return null;
      }
      
      logger.debug('Perfil de cliente encontrado', { clientId });
      return rows[0];
    } catch (error) {
      logger.error('Error al buscar perfil de cliente por ID', { 
        error: error.message,
        clientId
      });
      throw error;
    }
  }
  
  /**
   * Obtiene un perfil de cliente por ID de usuario
   * @async
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object|null>} - Perfil de cliente encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getByUserId(userId) {
    try {
      logger.debug('Buscando perfil de cliente por ID de usuario', { userId });
      
      const query = `
        SELECT cp.*, u.name as user_name, u.mail as user_email 
        FROM client_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1;
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        logger.debug('Perfil de cliente no encontrado por ID de usuario', { userId });
        return null;
      }
      
      logger.debug('Perfil de cliente encontrado por ID de usuario', { userId });
      return rows[0];
    } catch (error) {
      logger.error('Error al buscar perfil de cliente por ID de usuario', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Obtiene todos los perfiles de clientes
   * @async
   * @returns {Promise<Array<Object>>} - Lista de perfiles de clientes
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getAll() {
    try {
      logger.debug('Obteniendo todos los perfiles de clientes');
      
      const query = `
        SELECT cp.*, u.name as user_name, u.mail as user_email 
        FROM client_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        ORDER BY cp.company_name;
      `;
      
      const { rows } = await pool.query(query);
      
      logger.debug('Perfiles de clientes obtenidos', { count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error al obtener todos los perfiles de clientes', { 
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Crea un nuevo perfil de cliente
   * @async
   * @param {Object} clientData - Datos del perfil de cliente
   * @returns {Promise<Object>} - Perfil de cliente creado
   * @throws {Error} Si ocurre un error en la inserción
   */
  static async create(clientData) {
    try {
      logger.debug('Creando nuevo perfil de cliente', { 
        userId: clientData.user_id,
        companyName: clientData.company_name
      });
      
      const {
        user_id,
        company_name,
        contact_name,
        contact_phone,
        contact_email,
        address,
        city,
        country,
        tax_id,
        price_list,
        notes,
        fotocopia_cedula,
        fotocopia_rut,
        anexos_adicionales
      } = clientData;
      
      const query = `
        INSERT INTO client_profiles
        (user_id, company_name, contact_name, contact_phone, contact_email, 
         address, city, country, tax_id, price_list, notes,
         fotocopia_cedula, fotocopia_rut, anexos_adicionales)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
      `;
      
      const values = [
        user_id,
        company_name,
        contact_name,
        contact_phone,
        contact_email,
        address,
        city,
        country,
        tax_id,
        price_list,
        notes,
        fotocopia_cedula,
        fotocopia_rut,
        anexos_adicionales
      ];
      
      const { rows } = await pool.query(query, values);
      
      logger.info('Perfil de cliente creado exitosamente', { 
        clientId: rows[0].client_id,
        companyName: company_name
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al crear perfil de cliente', { 
        error: error.message,
        companyName: clientData.company_name
      });
      throw error;
    }
  }
  
  /**
   * Actualiza un perfil de cliente existente
   * @async
   * @param {number} clientId - ID del perfil de cliente
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object|null>} - Perfil actualizado o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async update(clientId, updateData) {
    try {
      logger.debug('Actualizando perfil de cliente', { 
        clientId,
        fields: Object.keys(updateData)
      });
      
      // Construir la consulta dinámicamente
      const allowedFields = [
        'user_id', 'company_name', 'contact_name', 'contact_phone',
        'contact_email', 'address', 'city', 'country', 'tax_id',
        'price_list', 'notes', 'fotocopia_cedula', 'fotocopia_rut',
        'anexos_adicionales'
      ];
      
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      Object.entries(updateData).forEach(([key, value]) => {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });
      
      if (updates.length === 0) {
        logger.warn('No se proporcionaron campos válidos para actualizar', { clientId });
        return null;
      }
      
      values.push(clientId);
      
      const query = `
        UPDATE client_profiles
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE client_id = $${paramCount}
        RETURNING *;
      `;
      
      const { rows } = await pool.query(query, values);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al actualizar', { clientId });
        return null;
      }
      
      logger.info('Perfil de cliente actualizado exitosamente', { 
        clientId,
        companyName: rows[0].company_name
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al actualizar perfil de cliente', { 
        error: error.message,
        clientId
      });
      throw error;
    }
  }
  
  /**
   * Elimina un perfil de cliente
   * @async
   * @param {number} clientId - ID del perfil de cliente
   * @returns {Promise<Object|null>} - Perfil eliminado o null si no existe
   * @throws {Error} Si ocurre un error en la eliminación
   */
  static async delete(clientId) {
    try {
      logger.debug('Eliminando perfil de cliente', { clientId });
      
      const query = 'DELETE FROM client_profiles WHERE client_id = $1 RETURNING *;';
      
      const { rows } = await pool.query(query, [clientId]);
      
      if (rows.length === 0) {
        logger.warn('Perfil de cliente no encontrado al eliminar', { clientId });
        return null;
      }
      
      logger.info('Perfil de cliente eliminado exitosamente', { 
        clientId,
        companyName: rows[0].company_name
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al eliminar perfil de cliente', { 
        error: error.message,
        clientId
      });
      throw error;
    }
  }
  
  /**
   * Verifica si un usuario ya tiene un perfil
   * @async
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} - true si el usuario ya tiene un perfil, false en caso contrario
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async userHasProfile(userId) {
    try {
      logger.debug('Verificando si el usuario ya tiene un perfil', { userId });
      
      const query = 'SELECT client_id FROM client_profiles WHERE user_id = $1 LIMIT 1;';
      
      const { rows } = await pool.query(query, [userId]);
      
      const hasProfile = rows.length > 0;
      
      logger.debug('Resultado de verificación de perfil de usuario', {
        userId,
        hasProfile
      });
      
      return hasProfile;
    } catch (error) {
      logger.error('Error al verificar si el usuario tiene perfil', { 
        error: error.message,
        userId
      });
      throw error;
    }
  }
}

module.exports = ClientProfile;