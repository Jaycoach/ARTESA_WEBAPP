const axios = require('axios');
const { createContextLogger } = require('../config/logger');
const pool = require('../config/db');
const Product = require('../models/Product');
const { promisify } = require('util');
const cron = require('node-cron');

// Crear una instancia del logger con contexto
const logger = createContextLogger('SapIntegrationService');

/**
 * Servicio para la integración con SAP Business One Service Layer
 */
class SapIntegrationService {
  constructor() {
    this.sessionId = null;
    this.baseUrl = process.env.SAP_SERVICE_LAYER_URL;
    this.username = process.env.SAP_USERNAME;
    this.password = process.env.SAP_PASSWORD;
    this.companyDB = process.env.SAP_COMPANY_DB;
    this.syncSchedule = process.env.SAP_SYNC_SCHEDULE || '0 0 * * *'; // Por defecto: cada día a medianoche
    this.initialized = false;
    this.lastSyncTime = null;
  }

  /**
   * Inicializa el servicio y programa tareas
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('Inicializando servicio de integración con SAP B1');
      
      // Verificar configuración
      if (!this.baseUrl || !this.username || !this.password || !this.companyDB) {
        throw new Error('Configuración incompleta para la integración con SAP B1');
      }

      // Iniciar sincronización programada
      this.scheduleSyncTask();
      
      // Marcar como inicializado
      this.initialized = true;
      logger.info('Servicio de integración con SAP B1 inicializado correctamente');
      
      // Devolver instancia para encadenamiento de métodos
      return this;
    } catch (error) {
      logger.error('Error al inicializar servicio de integración con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Programa tarea para sincronización periódica
   */
  scheduleSyncTask() {
    // Validar formato de programación cron
    if (!cron.validate(this.syncSchedule)) {
      logger.error('Formato de programación inválido', {
        schedule: this.syncSchedule
      });
      throw new Error(`Formato de programación cron inválido: ${this.syncSchedule}`);
    }

    logger.info('Programando sincronización periódica de productos', {
      schedule: this.syncSchedule
    });

    // Programar tarea cron
    cron.schedule(this.syncSchedule, async () => {
      try {
        logger.info('Iniciando sincronización programada de productos');
        await this.syncProductsFromSAP();
        logger.info('Sincronización programada completada exitosamente');
      } catch (error) {
        logger.error('Error en sincronización programada', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Autenticación con SAP Service Layer
   * @returns {Promise<string>} Session ID
   */
  async login() {
    try {
      logger.debug('Iniciando autenticación con SAP B1 Service Layer');
      
      const response = await axios.post(`${this.baseUrl}/Login`, {
        CompanyDB: this.companyDB,
        UserName: this.username,
        Password: this.password
      });

      if (response.status === 200) {
        // Extraer sessionId de las cookies
        const cookies = response.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
          // Formato típico: B1SESSION=1234567890; path=/; HttpOnly
          const sessionCookie = cookies.find(cookie => cookie.startsWith('B1SESSION='));
          if (sessionCookie) {
            this.sessionId = sessionCookie.split(';')[0].split('=')[1];
            logger.info('Autenticación exitosa con SAP B1', {
              sessionId: this.sessionId ? `${this.sessionId.substring(0, 5)}...` : undefined
            });
            return this.sessionId;
          }
        }
        throw new Error('No se pudo extraer la sesión de la respuesta');
      } else {
        throw new Error(`Error de autenticación: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error en autenticación con SAP B1', {
        error: error.message,
        stack: error.stack,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      throw new Error(`Error de autenticación con SAP B1: ${error.message}`);
    }
  }

  /**
   * Realiza petición a SAP Service Layer con manejo de sesión
   * @param {string} method - Método HTTP (GET, POST, PUT, PATCH, DELETE)
   * @param {string} endpoint - Endpoint relativo (sin baseUrl)
   * @param {Object} data - Datos para POST, PUT, PATCH
   * @returns {Promise<any>} Respuesta de SAP
   */
  async request(method, endpoint, data = null) {
    try {
      // Asegurar que tenemos una sesión válida
      if (!this.sessionId) {
        await this.login();
      }

      // Preparar config para Axios
      const config = {
        method: method.toLowerCase(),
        url: `${this.baseUrl}/${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `B1SESSION=${this.sessionId}`
        }
      };

      if (data && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
        config.data = data;
      }

      // Realizar petición
      const response = await axios(config);
      return response.data;
    } catch (error) {
      // Si el error es por sesión expirada (401), intentar reautenticar una vez
      if (error.response && error.response.status === 401) {
        logger.warn('Sesión expirada, intentando reautenticación', {
          endpoint
        });
        
        // Reiniciar sesión
        this.sessionId = null;
        await this.login();
        
        // Reintentar petición
        return this.request(method, endpoint, data);
      }
      
      logger.error('Error en petición a SAP B1', {
        method,
        endpoint,
        error: error.message,
        statusCode: error.response?.status,
        responseData: error.response?.data
      });
      
      throw error;
    }
  }

  /**
   * Obtiene productos de SAP B1
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de productos
   */
  async getProductsFromSAP(options = {}) {
    try {
      const { limit = 1000, skip = 0, filter = '' } = options;
      
      let endpoint = `Items?$select=ItemCode,ItemName,ItemsGroupCode,QuantityOnStock,U_Web_Published,U_Web_Description,PictureName&$filter=U_Web_Published eq 'Y'`;
      
      if (filter) {
        endpoint += ` and ${filter}`;
      }
      
      endpoint += `&$skip=${skip}&$top=${limit}`;
      
      logger.debug('Obteniendo productos de SAP B1', { endpoint });
      
      const data = await this.request('GET', endpoint);
      
      if (!data || !data.value) {
        throw new Error('Formato de respuesta inválido');
      }
      
      logger.info('Productos obtenidos de SAP B1', {
        count: data.value.length,
        hasMore: data['odata.nextLink'] ? true : false
      });
      
      return {
        items: data.value,
        hasMore: !!data['odata.nextLink'],
        nextLink: data['odata.nextLink']
      };
    } catch (error) {
      logger.error('Error al obtener productos de SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtiene un producto específico de SAP B1
   * @param {string} itemCode - Código del producto en SAP
   * @returns {Promise<Object>} Datos del producto
   */
  async getProductByCode(itemCode) {
    try {
      const endpoint = `Items('${itemCode}')?$select=ItemCode,ItemName,ItemsGroupCode,QuantityOnStock,U_Web_Published,U_Web_Description,PictureName`;
      
      logger.debug('Obteniendo producto específico de SAP B1', { itemCode });
      
      const data = await this.request('GET', endpoint);
      
      if (!data || !data.ItemCode) {
        throw new Error('Producto no encontrado o formato de respuesta inválido');
      }
      
      return data;
    } catch (error) {
      logger.error('Error al obtener producto de SAP B1', {
        itemCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Actualiza un producto en SAP B1
   * @param {string} itemCode - Código del producto en SAP
   * @param {Object} updateData - Datos a actualizar (solo se admiten ciertos campos)
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateProductInSAP(itemCode, updateData) {
    try {
      // Campos permitidos para actualización desde la WebApp
      const allowedFields = ['U_Web_Description'];
      
      // Filtrar solo campos permitidos
      const filteredData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});
      
      // Verificar que hay datos válidos para actualizar
      if (Object.keys(filteredData).length === 0) {
        throw new Error('No hay datos válidos para actualizar');
      }
      
      logger.debug('Actualizando producto en SAP B1', {
        itemCode,
        updateFields: Object.keys(filteredData)
      });
      
      // PATCH permite actualización parcial
      const endpoint = `Items('${itemCode}')`;
      const result = await this.request('PATCH', endpoint, filteredData);
      
      logger.info('Producto actualizado exitosamente en SAP B1', {
        itemCode,
        fields: Object.keys(filteredData)
      });
      
      return result;
    } catch (error) {
      logger.error('Error al actualizar producto en SAP B1', {
        itemCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Mapea un producto de SAP B1 al formato de la WebApp
   * @param {Object} sapProduct - Producto en formato SAP B1
   * @returns {Object} Producto en formato WebApp
   */
  mapSapProductToWebApp(sapProduct) {
    return {
      barcode: sapProduct.ItemCode,
      name: sapProduct.ItemName,
      description: sapProduct.U_Web_Description || sapProduct.ItemName,
      price_list1: 0, // Estos precios se obtendrían de otra consulta en SAP
      price_list2: 0,
      price_list3: 0,
      stock: sapProduct.QuantityOnStock || 0,
      image_url: sapProduct.PictureName ? `${process.env.SAP_IMAGES_BASE_URL}/${sapProduct.PictureName}` : null,
      sap_code: sapProduct.ItemCode,
      sap_group: sapProduct.ItemsGroupCode,
      sap_last_sync: new Date().toISOString()
    };
  }

  /**
   * Sincroniza todos los productos desde SAP B1 a la WebApp
   * @param {boolean} fullSync - Indica si es una sincronización completa o incremental
   * @returns {Promise<Object>} Estadísticas de sincronización
   */
  async syncProductsFromSAP(fullSync = false) {
    const stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };

    try {
      logger.info('Iniciando sincronización de productos desde SAP B1', {
        mode: fullSync ? 'completa' : 'incremental'
      });

      // Registrar inicio de sincronización para uso en sincronización incremental
      const syncStartTime = new Date();
      
      let hasMore = true;
      let skip = 0;
      const limit = 100; // Procesar en lotes para no sobrecargar la memoria
      
      // Filtro adicional para sincronización incremental
      let filter = '';
      if (!fullSync && this.lastSyncTime) {
        const lastSyncIso = this.lastSyncTime.toISOString();
        filter = `UpdateDate ge '${lastSyncIso}'`;
        logger.debug('Aplicando filtro para sincronización incremental', { filter });
      }
      
      // Comenzar transacción para toda la sincronización
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        while (hasMore) {
          // Obtener lote de productos de SAP
          const { items, hasMore: moreItems } = await this.getProductsFromSAP({
            limit,
            skip,
            filter
          });
          
          hasMore = moreItems;
          skip += limit;
          stats.total += items.length;
          
          // Procesar cada producto del lote
          for (const sapProduct of items) {
            try {
              // Buscar si el producto ya existe en la WebApp
              const existingProduct = await Product.findByBarcode(sapProduct.ItemCode, client);
              
              // Mapear producto de SAP al formato de la WebApp
              const webAppProduct = this.mapSapProductToWebApp(sapProduct);
              
              if (existingProduct) {
                // Si existe, actualizar
                await Product.update(existingProduct.product_id, webAppProduct, client);
                stats.updated++;
                logger.debug('Producto actualizado', {
                  barcode: sapProduct.ItemCode,
                  name: sapProduct.ItemName
                });
              } else {
                // Si no existe, crear
                await Product.create(webAppProduct, client);
                stats.created++;
                logger.debug('Producto creado', {
                  barcode: sapProduct.ItemCode,
                  name: sapProduct.ItemName
                });
              }
            } catch (productError) {
              stats.errors++;
              logger.error('Error al procesar producto individual', {
                itemCode: sapProduct.ItemCode,
                error: productError.message
              });
              // Continuar con el siguiente producto
            }
          }
        }
        
        // Actualizar productos que ya no están publicados en SAP
        if (fullSync) {
          const result = await client.query(
            'UPDATE products SET is_active = false WHERE sap_last_sync < $1 AND sap_code IS NOT NULL',
            [syncStartTime]
          );
          
          logger.info('Productos marcados como inactivos', {
            count: result.rowCount
          });
        }
        
        // Commit de la transacción
        await client.query('COMMIT');
        
        // Actualizar timestamp de última sincronización exitosa
        this.lastSyncTime = syncStartTime;
        
        logger.info('Sincronización completada exitosamente', {
          stats,
          syncTime: new Date().toISOString()
        });
        
        return stats;
      } catch (error) {
        // Rollback en caso de error
        await client.query('ROLLBACK');
        throw error;
      } finally {
        // Liberar el cliente
        client.release();
      }
    } catch (error) {
      logger.error('Error en sincronización con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sincroniza cambios de un producto específico hacia SAP B1
   * @param {number} productId - ID del producto en la WebApp
   * @returns {Promise<boolean>} Resultado de la sincronización
   */
  async syncProductToSAP(productId) {
    try {
      // Obtener producto de la WebApp
      const product = await Product.findById(productId);
      
      if (!product) {
        throw new Error('Producto no encontrado');
      }
      
      // Verificar que tiene código SAP
      if (!product.sap_code) {
        logger.warn('Producto sin código SAP, no se puede sincronizar', {
          productId
        });
        return false;
      }
      
      logger.debug('Preparando actualización de producto hacia SAP B1', {
        productId,
        sapCode: product.sap_code
      });
      
      // Preparar datos para actualización
      const updateData = {
        U_Web_Description: product.description
      };
      
      // Actualizar en SAP
      await this.updateProductInSAP(product.sap_code, updateData);
      
      // Actualizar timestamp de sincronización
      await Product.update(productId, {
        sap_last_sync: new Date().toISOString()
      });
      
      logger.info('Producto sincronizado hacia SAP B1 exitosamente', {
        productId,
        sapCode: product.sap_code
      });
      
      return true;
    } catch (error) {
      logger.error('Error al sincronizar producto hacia SAP B1', {
        productId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Cierra la sesión con SAP B1
   */
  async logout() {
    if (!this.sessionId) return;
    
    try {
      await axios.post(`${this.baseUrl}/Logout`, {}, {
        headers: {
          'Cookie': `B1SESSION=${this.sessionId}`
        }
      });
      
      logger.info('Sesión cerrada exitosamente con SAP B1');
      this.sessionId = null;
    } catch (error) {
      logger.error('Error al cerrar sesión con SAP B1', {
        error: error.message
      });
      this.sessionId = null;
    }
  }
}

// Exportar instancia única (singleton)
const sapIntegrationService = new SapIntegrationService();

module.exports = sapIntegrationService;