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
          municipality_code,
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
          municipality_code,
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
          municipality_code,
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
  /**
   * Obtiene el price_list_code del cliente principal de una sucursal
   * @param {number} branchId - ID de la sucursal
   * @returns {Promise<Object|null>} Información del price_list_code o null si no existe
   */
  static async getClientPriceListCode(branchId) {
    try {
      logger.debug('Obteniendo price_list_code del cliente principal para sucursal', { branchId });    
    
      const query = `
        SELECT 
            cp.price_list_code,
            cp.price_list,
            cp.company_name,
            cp.client_id,
            cb.branch_name
        FROM client_branches cb
        JOIN client_profiles cp ON cb.client_id = cp.client_id
        WHERE cb.branch_id = $1
      `;
        
      const { rows } = await pool.query(query, [branchId]);
        
      if (rows.length === 0) {
        return null;
      }

      // Priorizar price_list, si no existe usar price_list_code, si no existe usar '1'
      const finalPriceListCode = rows[0].price_list ? rows[0].price_list.toString() : 
                                (rows[0].price_list_code || '1');

      logger.debug('Price list code determinado en modelo', {
          branchId,
          rawPriceList: rows[0].price_list,
          rawPriceListCode: rows[0].price_list_code,
          finalPriceListCode,
          source: rows[0].price_list ? 'price_list' : 
                (rows[0].price_list_code ? 'price_list_code' : 'default')
      });

      return {
          price_list_code: finalPriceListCode,
          price_list_source: rows[0].price_list ? 'price_list' : 
                            (rows[0].price_list_code ? 'price_list_code' : 'default'),
          raw_values: {
              price_list: rows[0].price_list,
              price_list_code: rows[0].price_list_code
          },
          company_name: rows[0].company_name,
          client_id: rows[0].client_id,
          branch_name: rows[0].branch_name
      };

    } catch (error) {
      logger.error('Error al obtener price_list_code del cliente principal', {
        error: error.message,
        branchId,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = ClientBranch;