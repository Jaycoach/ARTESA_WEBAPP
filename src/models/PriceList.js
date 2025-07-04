// src/models/PriceList.js
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('PriceListModel');

/**
 * Modelo para manejo de listas de precios sincronizadas desde SAP
 */
class PriceList {
  /**
   * Crear o actualizar entrada de lista de precios
   * @param {Object} priceListData - Datos de la lista de precios
   * @returns {Promise<Object>} - Entrada de lista de precios creada/actualizada
   */
  static async upsert(priceListData) {
    try {
      const query = `
        INSERT INTO price_lists (
          price_list_code,
          price_list_name,
          product_code,
          product_name,
          price,
          currency,
          additional_price1,
          additional_price2,
          factor,
          base_price_list,
          sap_price_list_no,
          sap_last_sync,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (price_list_code, product_code) 
        DO UPDATE SET
          price_list_name = EXCLUDED.price_list_name,
          product_name = EXCLUDED.product_name,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          additional_price1 = EXCLUDED.additional_price1,
          additional_price2 = EXCLUDED.additional_price2,
          factor = EXCLUDED.factor,
          base_price_list = EXCLUDED.base_price_list,
          sap_price_list_no = EXCLUDED.sap_price_list_no,
          sap_last_sync = EXCLUDED.sap_last_sync,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      
      const values = [
        priceListData.priceListCode,
        priceListData.priceListName,
        priceListData.productCode,
        priceListData.productName,
        priceListData.price || 0,
        priceListData.currency || 'COP',
        priceListData.additionalPrice1 || 0,
        priceListData.additionalPrice2 || 0,
        priceListData.factor || 1,
        priceListData.basePriceList,
        priceListData.sapPriceListNo,
        new Date(),
        priceListData.isActive !== undefined ? priceListData.isActive : true
      ];
      
      const { rows } = await pool.query(query, values);
      logger.debug('Price list entry upserted', { 
        priceListCode: priceListData.priceListCode, 
        productCode: priceListData.productCode 
      });
      return rows[0];
    } catch (error) {
      logger.error('Error upserting price list entry', { 
        error: error.message,
        data: priceListData
      });
      throw error;
    }
  }

  /**
   * Obtener todas las listas de precios disponibles
   * @returns {Promise<Array>} - Array de listas de precios
   */
  static async getAllPriceLists() {
    try {
      const query = `
        SELECT DISTINCT 
          price_list_code,
          price_list_name,
          sap_price_list_no,
          COUNT(*) as product_count,
          MAX(sap_last_sync) as last_sync
        FROM price_lists
        WHERE is_active = true
        GROUP BY price_list_code, price_list_name, sap_price_list_no
        ORDER BY sap_price_list_no;
      `;
      
      const { rows } = await pool.query(query);
      logger.debug('Price lists retrieved', { count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error getting all price lists', { error: error.message });
      throw error;
    }
  }

  /**
   * Obtener productos de una lista de precios específica
   * @param {string} priceListCode - Código de la lista de precios
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Object>} - Productos con precios y metadatos de paginación
   */
  static async getByPriceListCode(priceListCode, options = {}) {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        search = null,
        orderBy = 'product_code',
        orderDirection = 'ASC'
      } = options;

      let whereClause = 'WHERE pl.price_list_code = $1 AND pl.is_active = true';
      let queryParams = [priceListCode];
      let paramIndex = 2;

      if (search) {
        whereClause += ` AND (pl.product_code ILIKE $${paramIndex} OR pl.product_name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const countQuery = `
        SELECT COUNT(*) 
        FROM price_lists pl 
        ${whereClause};
      `;

      const dataQuery = `
        SELECT 
          pl.price_list_id,
          pl.price_list_code,
          pl.price_list_name,
          pl.product_code,
          pl.product_name,
          pl.price,
          pl.currency,
          pl.additional_price1,
          pl.additional_price2,
          pl.factor,
          pl.base_price_list,
          pl.sap_price_list_no,
          pl.sap_last_sync,
          pl.created_at,
          pl.updated_at,
          p.name as local_product_name,
          p.description as local_product_description
        FROM price_lists pl
        LEFT JOIN products p ON pl.product_code = p.code
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
      `;

      queryParams.push(limit, offset);

      const [countResult, dataResult] = await Promise.all([
        pool.query(countQuery, queryParams.slice(0, -2)),
        pool.query(dataQuery, queryParams)
      ]);

      const totalCount = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      logger.debug('Price list products retrieved', { 
        priceListCode, 
        count: dataResult.rows.length,
        totalCount 
      });

      return {
        data: dataResult.rows,
        pagination: {
          currentPage,
          totalPages,
          totalCount,
          limit,
          offset,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1
        }
      };
    } catch (error) {
      logger.error('Error getting price list by code', { 
        error: error.message, 
        priceListCode 
      });
      throw error;
    }
  }

  /**
   * Obtener precio específico de un producto en una lista
   * @param {string} priceListCode - Código de la lista de precios
   * @param {string} productCode - Código del producto
   * @returns {Promise<Object|null>} - Precio del producto o null si no existe
   */
  static async getProductPrice(priceListCode, productCode) {
    const normalizedPriceListCode = String(priceListCode);
    try {
      const query = `
        SELECT 
          pl.*,
          p.name as local_product_name,
          p.description as local_product_description
        FROM price_lists pl
        LEFT JOIN products p ON pl.product_code = p.code
        WHERE pl.price_list_code = $1 
          AND pl.product_code = $2 
          AND pl.is_active = true
        ORDER BY pl.updated_at DESC
        LIMIT 1;
      `;
      
      const { rows } = await pool.query(query, [normalizedPriceListCode, productCode]);
      
      if (rows.length === 0) {
        logger.debug('Product price not found', { priceListCode, productCode });
        return null;
      }

      logger.debug('Product price retrieved', { 
        priceListCode, 
        productCode, 
        price: rows[0].price 
      });
      return rows[0];
    } catch (error) {
      logger.error('Error getting product price', { 
        error: error.message, 
        priceListCode, 
        productCode 
      });
      throw error;
    }
  }

  /**
   * Obtener precios de múltiples productos para una lista específica
   * @param {string} priceListCode - Código de la lista de precios
   * @param {Array<string>} productCodes - Array de códigos de productos
   * @returns {Promise<Array>} - Array de precios de productos
   */
  static async getMultipleProductPrices(priceListCode, productCodes) {
    try {
      if (!productCodes || productCodes.length === 0) {
        return [];
      }

      const placeholders = productCodes.map((_, index) => `$${index + 2}`).join(',');
      
      const query = `
        SELECT 
          pl.*,
          p.name as local_product_name,
          p.description as local_product_description
        FROM price_lists pl
        LEFT JOIN products p ON pl.product_code = p.code
        WHERE pl.price_list_code = $1 
          AND pl.product_code IN (${placeholders})
          AND pl.is_active = true
        ORDER BY pl.product_code;
      `;
      
      const { rows } = await pool.query(query, [priceListCode, ...productCodes]);
      
      logger.debug('Multiple product prices retrieved', { 
        priceListCode, 
        requestedCount: productCodes.length,
        foundCount: rows.length 
      });
      return rows;
    } catch (error) {
      logger.error('Error getting multiple product prices', { 
        error: error.message, 
        priceListCode, 
        productCount: productCodes?.length 
      });
      throw error;
    }
  }

  /**
   * Eliminar precios de productos que ya no existen en SAP
   * @param {string} priceListCode - Código de la lista de precios
   * @param {Array<string>} validProductCodes - Códigos de productos válidos de SAP
   * @returns {Promise<number>} - Número de registros eliminados
   */
  static async cleanupInvalidProducts(priceListCode, validProductCodes) {
    try {
      if (!validProductCodes || validProductCodes.length === 0) {
        logger.warn('No valid product codes provided for cleanup', { priceListCode });
        return 0;
      }

      const placeholders = validProductCodes.map((_, index) => `$${index + 2}`).join(',');
      
      const query = `
        UPDATE price_lists 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE price_list_code = $1 
          AND product_code NOT IN (${placeholders})
          AND is_active = true
        RETURNING price_list_id;
      `;
      
      const { rows } = await pool.query(query, [priceListCode, ...validProductCodes]);
      
      logger.info('Invalid products cleaned up', { 
        priceListCode, 
        deactivatedCount: rows.length 
      });
      return rows.length;
    } catch (error) {
      logger.error('Error cleaning up invalid products', { 
        error: error.message, 
        priceListCode 
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de una lista de precios
   * @param {string} priceListCode - Código de la lista de precios
   * @returns {Promise<Object>} - Estadísticas de la lista de precios
   */
  static async getStatistics(priceListCode) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN price > 0 THEN 1 END) as products_with_price,
          AVG(CASE WHEN price > 0 THEN price END) as average_price,
          MIN(CASE WHEN price > 0 THEN price END) as min_price,
          MAX(price) as max_price,
          MAX(sap_last_sync) as last_sync,
          MIN(created_at) as oldest_entry,
          MAX(updated_at) as newest_update
        FROM price_lists
        WHERE price_list_code = $1 AND is_active = true;
      `;
      
      const { rows } = await pool.query(query, [priceListCode]);
      
      logger.debug('Price list statistics retrieved', { priceListCode });
      return rows[0];
    } catch (error) {
      logger.error('Error getting price list statistics', { 
        error: error.message, 
        priceListCode 
      });
      throw error;
    }
  }
}

module.exports = PriceList;