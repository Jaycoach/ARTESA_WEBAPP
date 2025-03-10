const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('ProductImageModel');

class ProductImage {
  static async getByProductCode(sapCode, client) {
    try {
      const query = 'SELECT * FROM product_images WHERE sap_code = $1';
      const dbClient = client || pool;
      
      const { rows } = await dbClient.query(query, [sapCode]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error al obtener imagen de producto', {
        sapCode,
        error: error.message
      });
      throw error;
    }
  }
  
  static async createOrUpdate(sapCode, imageUrl, client) {
    try {
      const dbClient = client || pool;
      
      const query = `
        INSERT INTO product_images (sap_code, image_url, last_updated)
        VALUES ($1, $2, $3)
        ON CONFLICT (sap_code) 
        DO UPDATE SET image_url = $2, last_updated = $3
        RETURNING *
      `;
      
      const { rows } = await dbClient.query(query, [sapCode, imageUrl, new Date()]);
      return rows[0];
    } catch (error) {
      logger.error('Error al crear/actualizar imagen de producto', {
        sapCode,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = ProductImage;