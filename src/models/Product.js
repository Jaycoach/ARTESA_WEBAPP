// src/models/Product.js (versión actualizada)
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
 * @property {string} [sap_code] - Código del producto en SAP B1
 * @property {number} [sap_group] - Código del grupo del producto en SAP B1
 * @property {Date} [sap_last_sync] - Fecha de última sincronización con SAP B1
 * @property {boolean} [sap_sync_pending] - Indica si hay cambios pendientes de sincronizar
 * @property {boolean} [is_active] - Indica si el producto está activo
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
 * @property {string} [sapCode] - Código del producto en SAP B1
 * @property {number} [sapGroup] - Código del grupo del producto en SAP B1
 * @property {string} [sapLastSync] - Fecha de última sincronización con SAP B1
 * @property {boolean} [sapSyncPending] - Indica si hay cambios pendientes de sincronizar
 * @property {boolean} [isActive] - Indica si el producto está activo
 */

const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const sapServiceManager = require('../services/SapServiceManager');

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
   * @param {Object} [client] - Cliente de base de datos para transacciones
   * @returns {Promise<Product>} - Producto creado
   * @throws {Error} Si ocurre un error al crear el producto
   */
  static async create(product, client) {
    const {
      name, 
      description, 
      priceList1 = 0, 
      priceList2 = 0, 
      priceList3 = 0,
      stock = 0,
      barcode, 
      imageUrl, 
      sapCode, 
      sapGroup, 
      sapLastSync,
      sapSyncPending = false, 
      isActive = true
    } = product;
  
    // Asegurar que todos los valores numéricos son números válidos
    const sanitizedPriceList1 = parseFloat(priceList1) || 0;
    const sanitizedPriceList2 = parseFloat(priceList2) || 0;
    const sanitizedPriceList3 = parseFloat(priceList3) || 0;
    const sanitizedStock = parseInt(stock, 10) || 0;
    const sanitizedSapGroup = sapGroup ? parseInt(sapGroup, 10) : null;
  
    const query = `
      INSERT INTO products (
        name, description, price_list1, price_list2, price_list3,
        stock, barcode, image_url, sap_code, sap_group, sap_last_sync,
        sap_sync_pending, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    
    try {
      // Determinar si usamos el cliente proporcionado o pool
      const dbClient = client || pool;
      
      const values = [
        name, 
        description, 
        sanitizedPriceList1,
        sanitizedPriceList2,
        sanitizedPriceList3,
        sanitizedStock,
        barcode, 
        imageUrl, 
        sapCode, 
        sanitizedSapGroup, 
        sapLastSync,
        sapSyncPending, 
        isActive
      ];
      
      // Ahora el log puede acceder a 'values' porque ya está definido
      logger.debug('Valores para inserción de producto', { 
        values: values.map(v => typeof v === 'object' ? JSON.stringify(v) : v)
      });
      
      const { rows } = await dbClient.query(query, values);
      
      logger.info('Producto creado exitosamente', {
        productId: rows[0].product_id,
        name,
        barcode,
        sapCode
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al crear producto', { 
        error: error.message,
        product: { name, barcode, sapCode }
      });
      throw error;
    }
  }

  /**
   * Busca un producto por su ID
   * @async
   * @param {number} productId - ID del producto
   * @param {Object} [client] - Cliente de base de datos para transacciones
   * @returns {Promise<Product|null>} - Producto encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async findById(productId, client) {
    const query = 'SELECT * FROM products WHERE product_id = $1;';
    
    try {
        // Determinar si usamos el cliente proporcionado o pool
        const dbClient = client || pool;
        
        const { rows } = await dbClient.query(query, [productId]);
        
        if (rows.length === 0) {
            logger.warn('Producto no encontrado', { productId });
            return null;
        }
        
        // AÑADIR ESTE BLOQUE: Obtener imagen de product_images si el producto tiene sap_code
        if (rows[0].sap_code) {
            try {
                const imageQuery = 'SELECT image_url FROM product_images WHERE sap_code = $1';
                const imageResult = await dbClient.query(imageQuery, [rows[0].sap_code]);
                
                if (imageResult.rows.length > 0 && imageResult.rows[0].image_url) {
                    rows[0].image_url = imageResult.rows[0].image_url;
                    // Convertir URL de S3 a URL proxy si es necesario
                    if (rows[0].image_url && rows[0].image_url.includes('s3.')) {
                        const key = rows[0].image_url.split('/').slice(-2).join('/'); // Extraer carpeta/archivo
                        rows[0].image_url = `/api/images/proxy/${key}`;
                    }
                }
            } catch (imageError) {
                logger.warn('Error al obtener imagen del producto', {
                    productId,
                    sapCode: rows[0].sap_code,
                    error: imageError.message
                });
                // Continuar sin la imagen
            }
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
   * Busca un producto por su código de barras
   * @async
   * @param {string} barcode - Código de barras a buscar
   * @param {Object} [client] - Cliente de base de datos para transacciones
   * @returns {Promise<Product|null>} - Producto encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async findByBarcode(barcode, client) {
    const query = 'SELECT * FROM products WHERE barcode = $1;';
    
    try {
      // Determinar si usamos el cliente proporcionado o pool
      const dbClient = client || pool;
      
      const { rows } = await dbClient.query(query, [barcode]);
      
      if (rows.length === 0) {
        logger.debug('Producto no encontrado por código de barras', { barcode });
        return null;
      }
      
      logger.debug('Producto encontrado por código de barras', { 
        barcode,
        productId: rows[0].product_id 
      });
      
      return rows[0];
    } catch (error) {
      logger.error('Error al buscar producto por código de barras', { 
        error: error.message,
        barcode 
      });
      throw error;
    }
  }

  /**
   * Busca un producto por su código SAP
   * @async
   * @param {string} sapCode - Código SAP a buscar
   * @param {Object} [client] - Cliente de base de datos para transacciones
   * @returns {Promise<Product|null>} - Producto encontrado o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async findBySapCode(sapCode, client) {
    const query = 'SELECT * FROM products WHERE sap_code = $1;';
    
    try {
        // Determinar si usamos el cliente proporcionado o pool
        const dbClient = client || pool;
        
        const { rows } = await dbClient.query(query, [sapCode]);
        
        if (rows.length === 0) {
            logger.debug('Producto no encontrado por código SAP', { sapCode });
            return null;
        }
        
        // AÑADIR ESTE BLOQUE: Obtener imagen de product_images
        try {
            const imageQuery = 'SELECT image_url FROM product_images WHERE sap_code = $1';
            const imageResult = await dbClient.query(imageQuery, [sapCode]);
            
            if (imageResult.rows.length > 0 && imageResult.rows[0].image_url) {
                rows[0].image_url = imageResult.rows[0].image_url;
            }
        } catch (imageError) {
            logger.warn('Error al obtener imagen del producto', {
                sapCode,
                error: imageError.message
            });
            // Continuar sin la imagen
        }
        
        logger.debug('Producto encontrado por código SAP', { 
            sapCode,
            productId: rows[0].product_id
        });
        
        return rows[0];
    } catch (error) {
        logger.error('Error al buscar producto por código SAP', { 
            error: error.message,
            sapCode
        });
        throw error;
    }
}

  /**
   * Actualiza la imagen de un producto
   * @async
   * @param {number} productId - ID del producto
   * @param {string} imageUrl - URL de la nueva imagen
   * @param {Object} [client] - Cliente de base de datos para transacciones
   * @returns {Promise<Product|null>} - Producto actualizado o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async updateImage(productId, imageUrl, client) {
    try {
        logger.debug('Actualizando imagen de producto', { 
            productId, 
            imageUrl 
        });
        
        // Determinar si usamos el cliente proporcionado o pool
        const dbClient = client || pool;
        
        // Primero actualizamos en la tabla products
        const { rows } = await dbClient.query(
            'UPDATE products SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 RETURNING *;',
            [imageUrl, productId]
        );

        // Decodificar la URL si está codificada con entidades HTML
        if (rows.length > 0 && rows[0].image_url) {
            rows[0].image_url = rows[0].image_url
                .replace(/&amp;amp;#x2F;/g, '/')
                .replace(/&amp;#x2F;/g, '/')
                .replace(/&#x2F;/g, '/');
        }
        
        if (rows.length === 0) {
            logger.warn('Producto no encontrado al actualizar imagen', { productId });
            return null;
        }
        
        // AÑADIR ESTE BLOQUE: Actualizar también en product_images si tiene sap_code
        if (rows[0].sap_code) {
            try {
                await dbClient.query(
                    'INSERT INTO product_images(sap_code, image_url, last_updated) VALUES($1, $2, CURRENT_TIMESTAMP) ' +
                    'ON CONFLICT (sap_code) DO UPDATE SET image_url = $2, last_updated = CURRENT_TIMESTAMP',
                    [rows[0].sap_code, imageUrl]
                );
                
                logger.debug('Imagen actualizada también en product_images', {
                    productId,
                    sapCode: rows[0].sap_code
                });
            } catch (imageError) {
                logger.warn('Error al actualizar imagen en product_images', {
                    productId,
                    sapCode: rows[0].sap_code,
                    error: imageError.message
                });
                // Continuar aunque falle la actualización en product_images
            }
        }
        
        logger.info('Imagen de producto actualizada exitosamente', { 
            productId,
            success: true
        });

        // AGREGAR ESTE LOGGING:
        logger.debug('URL final de imagen', {
          productId,
          finalImageUrl: rows[0]?.image_url,
          urlLength: rows[0]?.image_url?.length
        });
        
        // Asegurar que la URL del producto esté decodificada
        if (rows[0] && rows[0].image_url) {
            rows[0].image_url = rows[0].image_url
                .replace(/&amp;amp;#x2F;/g, '/')
                .replace(/&amp;#x2F;/g, '/')
                .replace(/&#x2F;/g, '/');
        }

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
   * @param {Object} [options] - Opciones de filtrado
   * @param {boolean} [options.active] - Filtrar solo productos activos
   * @param {boolean} [options.syncPending] - Filtrar productos con cambios pendientes de sincronizar
   * @returns {Promise<Array<Product>>} - Lista de todos los productos
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getAll(options = {}) {
    try {
        let query;
        let queryParams = [];
        
        // SOLO manejar productos con lista de precios específica
        if (options.userPriceListCode) {
            query = `
                SELECT DISTINCT 
                    p.product_id,
                    p.name,
                    p.description,
                    p.price_list1,
                    p.price_list2,
                    p.price_list3,
                    p.stock,
                    p.barcode,
                    p.image_url,
                    p.sap_code,
                    p.sap_group,
                    p.created_at,
                    p.updated_at,
                    p.sap_last_sync,
                    p.sap_sync_pending,
                    p.is_active,
                    pl.price as custom_price,
                    pl.price_list_code,
                    pl.price_list_name,
                    CASE 
                        WHEN pl.price IS NOT NULL AND pl.price > 0 THEN pl.price
                        ELSE p.price_list1
                    END as effective_price
                FROM products p
                LEFT JOIN price_lists pl ON p.sap_code = pl.product_code 
                    AND pl.price_list_code = $1
                    AND pl.is_active = true
                WHERE p.is_active = true 
                    AND (
                        (pl.price IS NOT NULL AND pl.price > 0) 
                        OR 
                        (pl.price IS NULL AND p.price_list1 > 0)
                    )
                ORDER BY p.name;
            `;
            
            // Asegurar que se envíe como string
            queryParams = [String(options.userPriceListCode)];
            
            console.log('🔍 DEBUG: Query SQL construida:', {
                userPriceListCode: options.userPriceListCode,
                userPriceListCodeType: typeof options.userPriceListCode,
                queryParams,
                queryParamsTypes: queryParams.map(p => typeof p)
            });
        } else {
            // Si no hay userPriceListCode válido - esto es un error
            logger.error('Product.getAll llamado sin userPriceListCode válido');
            throw new Error('Se requiere código de lista de precios válido');
        }
        
        const { rows } = await pool.query(query, queryParams);
        
        // Enriquecimiento con imágenes existente...
        if (rows.length > 0) {
            // Extraer los códigos SAP de los productos
            const sapCodes = rows.filter(p => p.sap_code).map(p => p.sap_code);
            
            if (sapCodes.length > 0) {
                // Formato de la cláusula IN para consulta paramétrica
                const placeholders = sapCodes.map((_, i) => `$${i + 1}`).join(',');
                const imageQuery = `SELECT sap_code, image_url FROM product_images WHERE sap_code IN (${placeholders})`;
                
                const imageResult = await pool.query(imageQuery, sapCodes);
                
                // Crear un mapa para rápido acceso: { sapCode -> imageUrl }
                const imageMap = {};
                imageResult.rows.forEach(img => {
                    imageMap[img.sap_code] = img.image_url;
                });
                
                // Actualizar las imágenes de los productos
                rows.forEach(product => {
                    if (product.sap_code && imageMap[product.sap_code]) {
                        product.image_url = imageMap[product.sap_code];
                    }
                });
            }
        }
        
        logger.debug('Productos obtenidos con lista de precios', {
            count: rows.length,
            userPriceListCode: options.userPriceListCode
        });
        
        return rows;
    } catch (error) {
        logger.error('Error al obtener productos con lista de precios', { 
            error: error.message,
            options,
            stack: error.stack
        });
        throw error;
    }
}
  
  /**
   * Actualiza un producto
   * @async
   * @param {number} productId - ID del producto a actualizar
   * @param {Object} updateData - Datos a actualizar
   * @param {Object} [client] - Cliente de base de datos para transacciones
   * @param {boolean} [autoSync=true] - Indica si se debe marcar para sincronización automática
   * @returns {Promise<Product|null>} - Producto actualizado o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async update(productId, updateData, client, autoSync = true) {

    const validateNumber = (value, defaultValue = 0) => {
      if (value === undefined || value === null) return defaultValue;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
        return isNaN(parsed) ? defaultValue : parsed;
      }
      return defaultValue;
    };

    // Filtrar solo los campos permitidos y mapear nombres camelCase a snake_case
    const fieldMappings = {
      'name': 'name',
      'description': 'description',
      'priceList1': 'price_list1',
      'priceList2': 'price_list2',
      'priceList3': 'price_list3',
      'stock': 'stock',
      'barcode': 'barcode',
      'imageUrl': 'image_url',
      'sapCode': 'sap_code',
      'sapGroup': 'sap_group',
      'sapLastSync': 'sap_last_sync',
      'sapSyncPending': 'sap_sync_pending',
      'isActive': 'is_active'
    };

    const updates = [];
    const values = [];
    let paramCount = 1;
    
    // Determinar si hay cambios que requieren sincronización con SAP
    let needsSapSync = false;
    const sapSyncFields = ['description'];
    
    try {
      // Obtener producto actual para compararlos
      const currentProduct = await this.findById(productId, client);
      if (!currentProduct) {
        logger.warn('Producto no encontrado al intentar actualizar', { productId });
        return null;
      }
      
      // Flag para verificar si este producto viene de SAP
      const isSapProduct = !!currentProduct.sap_code;

      if (isSapProduct) {
        // Evitar sobrescribir ciertas propiedades que solo se deben actualizar desde SAP
        if (currentProduct.sap_code) {
          delete updateData.sap_code; // No permitir cambiar el código SAP
        }
        
        // Si actualizamos por sincronización SAP, marcar que ya no está pendiente
        if (updateData.sap_last_sync) {
          updates.push(`sap_sync_pending = $${paramCount}`);
          values.push(false);
          paramCount++;
        }
      }
      
      // Procesar cada campo de la actualización
      Object.keys(updateData).forEach(key => {
        // Verificar si es un campo válido
        const dbField = fieldMappings[key];
        if (dbField && updateData[key] !== undefined) {
          updates.push(`${dbField} = $${paramCount}`);
          
          // Luego aplicar esta función a los campos numéricos en los updates
          if (dbField === 'price_list1' || dbField === 'price_list2' || dbField === 'price_list3') {
            values.push(validateNumber(updateData[key], 0));
          } else if (dbField === 'stock' || dbField === 'sap_group') {
            values.push(parseInt(validateNumber(updateData[key], 0)));
          } else {
            values.push(updateData[key]);
          }
          paramCount++;
          
          // Verificar si este campo requiere sincronización con SAP
          if (isSapProduct && sapSyncFields.includes(dbField) && 
              updateData[key] !== currentProduct[dbField]) {
            needsSapSync = true;
            logger.debug('Detectado cambio que requiere sincronización con SAP', {
              productId,
              field: dbField,
              oldValue: currentProduct[dbField],
              newValue: updateData[key]
            });
          }
        }
      });
      
      // Si no hay actualizaciones, retornar el producto actual
      if (updates.length === 0) {
        logger.debug('No hay campos para actualizar', { productId });
        return currentProduct;
      }
      
      // Si hay campos que requieren sincronización con SAP, marcar como pendiente
      if (needsSapSync && autoSync && isSapProduct) {
        updates.push(`sap_sync_pending = $${paramCount}`);
        values.push(true);
        paramCount++;
      }
      
      // Actualizar timestamp
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      
      // Agregar ID al final de los valores
      values.push(productId);
      
      const query = `
        UPDATE products 
        SET ${updates.join(', ')}
        WHERE product_id = $${paramCount}
        RETURNING *;
      `;
      
      // Determinar si usamos el cliente proporcionado o pool
      const dbClient = client || pool;
      
      const { rows } = await dbClient.query(query, values);
      
      if (rows.length === 0) {
        logger.warn('Producto no encontrado durante actualización', { productId });
        return null;
      }
      
      const updatedProduct = rows[0];
      
      logger.info('Producto actualizado exitosamente', { 
        productId,
        fields: Object.keys(updateData).length,
        needsSapSync,
        isSapProduct
      });
      
      return updatedProduct;
    } catch (error) {
      logger.error('Error al actualizar producto', { 
        error: error.message,
        productId,
        stack: error.stack
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
    try {
      logger.debug('Eliminando producto', { productId });
      
      const { rows } = await pool.query(
        'DELETE FROM products WHERE product_id = $1 RETURNING *;',
        [productId]
      );
      
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
   * Busca productos por nombre o código de barras o código SAP
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
        barcode ILIKE $1 OR
        sap_code ILIKE $1
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

  /**
   * Obtiene todos los productos pendientes de sincronizar con SAP
   * @async
   * @returns {Promise<Array<Product>>} - Lista de productos pendientes
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getPendingSyncProducts() {
    const query = `
      SELECT * FROM products 
      WHERE sap_sync_pending = true 
        AND sap_code IS NOT NULL
      ORDER BY updated_at
    `;
    
    try {
      logger.debug('Obteniendo productos pendientes de sincronizar');
      const { rows } = await pool.query(query);
      logger.info('Productos pendientes de sincronizar obtenidos', { count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error al obtener productos pendientes de sincronizar', { 
        error: error.message
      });
      throw error;
    }
  }

  /**
 * Sincroniza la imagen de un producto con la tabla product_images
 * @async
 * @param {string} sapCode - Código SAP del producto
 * @param {string} imageUrl - URL de la imagen
 * @param {Object} [client] - Cliente de base de datos para transacciones
 * @returns {Promise<boolean>} - true si se sincronizó correctamente
 */
  static async syncImageWithSap(sapCode, imageUrl, client) {
    try {
        const dbClient = client || pool;
        
        // Insertar o actualizar en product_images
        await dbClient.query(
            'INSERT INTO product_images(sap_code, image_url, last_updated) VALUES($1, $2, CURRENT_TIMESTAMP) ' +
            'ON CONFLICT (sap_code) DO UPDATE SET image_url = $2, last_updated = CURRENT_TIMESTAMP',
            [sapCode, imageUrl]
        );
        
        // Actualizar también en la tabla products si existe el producto
        const productQuery = 'UPDATE products SET image_url = $1 WHERE sap_code = $2';
        await dbClient.query(productQuery, [imageUrl, sapCode]);
        
        logger.info('Imagen sincronizada con SAP', { sapCode });
        return true;
    } catch (error) {
        logger.error('Error al sincronizar imagen con SAP', {
            error: error.message,
            sapCode
        });
        return false;
    }
  }
}

module.exports = Product;