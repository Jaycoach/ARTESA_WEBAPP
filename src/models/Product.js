/**
 * @typedef {Object} Product
 * @property {number} product_id - ID único del producto
 * @property {string} name - Nombre del producto
 * @property {string} [description] - Descripción del producto
 * @property {number} price_list1 - Precio en la lista 1
 * @property {number} [price_list2] - Precio en la lista 2
 * @property {number} [price_list3] - Precio en la lista 3
 * @property {number} stock - Cantidad en inventario
 * @property {string} [barcode] - Código de barras único
 * @property {string} [image_url] - URL de la imagen del producto
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de última actualización
 */

/**
 * @typedef {Object} ProductInput
 * @property {string} name - Nombre del producto
 * @property {string} [description] - Descripción del producto
 * @property {number} priceList1 - Precio en la lista 1
 * @property {number} [priceList2] - Precio en la lista 2
 * @property {number} [priceList3] - Precio en la lista 3
 * @property {number} stock - Cantidad en inventario
 * @property {string} [barcode] - Código de barras único
 * @property {string} [imageUrl] - URL de la imagen del producto
 */

const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ProductModel');

/**
 * Clase que representa el modelo de Productos
 * @class Product
 */
class Product {
  /**
   * Crea un nuevo producto
   * @async
   * @param {ProductInput} product - Datos del producto a crear
   * @returns {Promise<Product>} - Producto creado
   * @throws {Error} Si ocurre un error al crear el producto
   */
  static async create(product) {
    const { name, description, priceList1, priceList2, priceList3, stock, barcode, imageUrl } = product;
    const query = `
      INSERT INTO products (name, description, price_list1, price_list2, price_list3, stock, barcode, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [name, description, priceList1, priceList2, priceList3, stock, barcode, imageUrl];
    
    try {
      const { rows } = await pool.query(query, values);
      logger.info('Producto creado exitosamente', { productId: rows[0].product_id });
      return rows[0];
    } catch (error) {
      logger.error('Error al crear producto', { 
        error: error.message,
        product: { name, barcode }
      });
      throw error;
    }
  }

  /**
   * Busca un producto por su ID
   * @async
   * @param {number} productId - ID del producto
   * @returns {Promise<Product|null>} - Producto encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async findById(productId) {
    const query = 'SELECT * FROM products WHERE product_id = $1;';
    
    try {
      const { rows } = await pool.query(query, [productId]);
      if (rows.length === 0) {
        logger.warn('Producto no encontrado', { productId });
        return null;
      }
      logger.debug('Producto encontrado', { productId });
      return rows[0];
    } catch (error) {
      logger.error('Error al buscar producto por ID', { 
        error: error.message,
        productId 
      });
      throw error;
    }
  }

  /**
   * Actualiza la imagen de un producto
   * @async
   * @param {number} productId - ID del producto
   * @param {string} imageUrl - URL de la nueva imagen
   * @returns {Promise<Product|null>} - Producto actualizado o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async updateImage(productId, imageUrl) {
    const query = 'UPDATE products SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 RETURNING *;';
    
    try {
      logger.debug('Actualizando imagen de producto', { 
        productId, 
        imageUrl 
      });
      
      const { rows } = await pool.query(query, [imageUrl, productId]);
      
      if (rows.length === 0) {
        logger.warn('Producto no encontrado al actualizar imagen', { productId });
        return null;
      }
      
      logger.info('Imagen de producto actualizada exitosamente', { 
        productId,
        success: true
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al actualizar imagen de producto', { 
        error: error.message,
        productId,
        imageUrl
      });
      throw error;
    }
  }

  /**
   * Obtiene todos los productos
   * @async
   * @returns {Promise<Array<Product>>} - Lista de todos los productos
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getAll() {
    const query = 'SELECT * FROM products ORDER BY name;';
    
    try {
      const { rows } = await pool.query(query);
      logger.debug('Obtenidos todos los productos', { count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error al obtener todos los productos', { 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Actualiza un producto
   * @async
   * @param {number} productId - ID del producto a actualizar
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Product|null>} - Producto actualizado o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async update(productId, updateData) {
    // Filtrar solo los campos permitidos
    const allowedFields = [
      'name', 'description', 'price_list1', 'price_list2', 'price_list3', 
      'stock', 'barcode', 'image_url'
    ];
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });
    
    if (updates.length === 0) {
      logger.warn('Intento de actualización sin campos válidos', { productId });
      return null;
    }
    
    values.push(productId);
    
    const query = `
      UPDATE products 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $${paramCount}
      RETURNING *;
    `;
    
    try {
      logger.debug('Actualizando producto', { productId, fields: Object.keys(updateData) });
      const { rows } = await pool.query(query, values);
      
      if (rows.length === 0) {
        logger.warn('Producto no encontrado al actualizar', { productId });
        return null;
      }
      
      logger.info('Producto actualizado exitosamente', { productId });
      return rows[0];
    } catch (error) {
      logger.error('Error al actualizar producto', { 
        error: error.message,
        productId
      });
      throw error;
    }
  }
  
  /**
   * Elimina un producto
   * @async
   * @param {number} productId - ID del producto a eliminar
   * @returns {Promise<Product|null>} - Producto eliminado o null si no existe
   * @throws {Error} Si ocurre un error en la eliminación
   */
  static async delete(productId) {
    const query = 'DELETE FROM products WHERE product_id = $1 RETURNING *;';
    
    try {
      logger.debug('Eliminando producto', { productId });
      const { rows } = await pool.query(query, [productId]);
      
      if (rows.length === 0) {
        logger.warn('Producto no encontrado al eliminar', { productId });
        return null;
      }
      
      logger.info('Producto eliminado exitosamente', { productId });
      return rows[0];
    } catch (error) {
      logger.error('Error al eliminar producto', { 
        error: error.message,
        productId
      });
      throw error;
    }
  }
  
  /**
   * Busca productos por nombre o código de barras
   * @async
   * @param {string} searchTerm - Término de búsqueda
   * @returns {Promise<Array<Product>>} - Lista de productos encontrados
   * @throws {Error} Si ocurre un error en la búsqueda
   */
  static async search(searchTerm) {
    const query = `
      SELECT * FROM products 
      WHERE 
        name ILIKE $1 OR 
        barcode ILIKE $1 
      ORDER BY name
    `;
    
    const searchPattern = `%${searchTerm}%`;
    
    try {
      logger.debug('Buscando productos', { searchTerm });
      const { rows } = await pool.query(query, [searchPattern]);
      logger.info('Búsqueda de productos completada', { count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error al buscar productos', { 
        error: error.message,
        searchTerm
      });
      throw error;
    }
  }
}

module.exports = Product;