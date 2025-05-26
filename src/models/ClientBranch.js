const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ClientBranchModel');

/**
 * Clase que representa las sucursales de un cliente
 * @class ClientBranch
 */
class ClientBranch {
  /**
   * Obtiene todas las sucursales de un cliente
   * @param {number} clientId - ID del cliente
   * @returns {Promise<Array>} Lista de sucursales
   */
  static async getByClientId(clientId) {
    try {
      logger.debug('Obteniendo sucursales para cliente', { clientId });
      
      const query = `
        SELECT 
          branch_id,
          client_id,
          ship_to_code,
          branch_name,
          address,
          city,
          state,
          country,
          zip_code,
          phone,
          contact_person,
          is_default,
          created_at,
          updated_at
        FROM client_branches
        WHERE client_id = $1
        ORDER BY is_default DESC, branch_name
      `;
      
      const { rows } = await pool.query(query, [clientId]);
      
      logger.debug(`Se encontraron ${rows.length} sucursales para el cliente ${clientId}`);
      return rows;
    } catch (error) {
      logger.error('Error al obtener sucursales del cliente', {
        error: error.message,
        clientId,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Obtiene todas las sucursales de un cliente por su ID de usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array>} Lista de sucursales
   */
  static async getByUserId(userId) {
    try {
      logger.debug('Obteniendo sucursales para usuario', { userId });
      
      const query = `
        SELECT 
          cb.branch_id,
          cb.client_id,
          cb.ship_to_code,
          cb.branch_name,
          cb.address,
          cb.city,
          cb.state,
          cb.country,
          cb.zip_code,
          cb.phone,
          cb.contact_person,
          cb.is_default,
          cb.created_at,
          cb.updated_at
        FROM client_branches cb
        JOIN client_profiles cp ON cb.client_id = cp.client_id
        WHERE cp.user_id = $1
        ORDER BY cb.is_default DESC, cb.branch_name
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      logger.debug(`Se encontraron ${rows.length} sucursales para el usuario ${userId}`);
      return rows;
    } catch (error) {
      logger.error('Error al obtener sucursales por ID de usuario', {
        error: error.message,
        userId,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Obtiene una sucursal específica por su ID
   * @param {number} branchId - ID de la sucursal
   * @returns {Promise<Object|null>} Sucursal o null si no existe
   */
  static async getById(branchId) {
    try {
      logger.debug('Obteniendo sucursal por ID', { branchId });
      
      const query = `
        SELECT 
          branch_id,
          client_id,
          ship_to_code,
          branch_name,
          address,
          city,
          state,
          country,
          zip_code,
          phone,
          contact_person,
          is_default,
          created_at,
          updated_at
        FROM client_branches
        WHERE branch_id = $1
      `;
      
      const { rows } = await pool.query(query, [branchId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    } catch (error) {
      logger.error('Error al obtener sucursal por ID', {
        error: error.message,
        branchId,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = ClientBranch;