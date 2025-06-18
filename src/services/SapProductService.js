const SapBaseService = require('./SapBaseService');
const cron = require('node-cron');
const pool = require('../config/db');
const Product = require('../models/Product');

/**
 * Servicio para integración de productos con SAP Business One
 * Extiende el servicio base para proporcionar funcionalidades específicas de productos
 */
class SapProductService extends SapBaseService {
  constructor() {
    super('SapProductService');
    this.syncSchedule = process.env.SAP_SYNC_SCHEDULE || '0 0 * * *'; // Por defecto: cada día a medianoche
    this.groupSyncTasks = {}; // Almacena las tareas cron por grupo
    this.lastGroupSyncTime = {}; // Almacena la última sincronización por grupo
  }

  /**
   * Inicializa el servicio y programa tareas
   */
  async initialize() {
    if (this.initialized) return this;

    try {
      // Inicializar servicio base primero
      await super.initialize();
      
      // Iniciar sincronización programada general
      this.scheduleSyncTask();
      
      // Iniciar sincronización programada para el grupo específico si está configurado
      if (process.env.SAP_GROUP_CODE) {
        const groupCode = process.env.SAP_GROUP_CODE || 127; // Por defecto grupo 127
        const groupSyncSchedule = process.env.SAP_GROUP_SYNC_SCHEDULE || '0 */6 * * *'; // Por defecto cada 6 horas
        
        this.logger.info('Configurando sincronización de grupo específico', {
          groupCode,
          schedule: groupSyncSchedule
        });
        
        this.scheduleGroupSyncTask(groupCode, groupSyncSchedule);
      }
      
      return this;
    } catch (error) {
      this.logger.error('Error al inicializar servicio de productos SAP', {
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
      this.logger.error('Formato de programación inválido', {
        schedule: this.syncSchedule
      });
      throw new Error(`Formato de programación cron inválido: ${this.syncSchedule}`);
    }

    this.logger.info('Programando sincronización periódica de productos', {
      schedule: this.syncSchedule
    });

    // Programar tarea cron
    cron.schedule(this.syncSchedule, async () => {
      try {
        this.logger.info('Iniciando sincronización programada de productos');
        await this.syncProductsFromSAP();
        this.logger.info('Sincronización programada completada exitosamente');
      } catch (error) {
        this.logger.error('Error en sincronización programada', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Programa tarea para sincronización periódica por grupo de artículos
   * @param {number} groupCode - Código del grupo de artículos a sincronizar (ej: 127)
   * @param {string} schedule - Formato cron para la programación (ej: "0 * /6 * * *" para cada 6 horas)
   */
  scheduleGroupSyncTask(groupCode, schedule) {
    // Validar formato de programación cron
    if (!cron.validate(schedule)) {
      this.logger.error('Formato de programación inválido para sincronización de grupo', {
        groupCode,
        schedule
      });
      throw new Error(`Formato de programación cron inválido: ${schedule}`);
    }

    this.logger.info('Programando sincronización periódica de productos por grupo', {
      groupCode,
      schedule
    });

    // Almacenar la tarea en una propiedad del objeto para poder cancelarla si es necesario
    if (!this.groupSyncTasks) {
      this.groupSyncTasks = {};
    }

    // Cancelar tarea anterior si existe
    if (this.groupSyncTasks[groupCode]) {
      this.groupSyncTasks[groupCode].stop();
    }

    // Programar nueva tarea cron
    this.groupSyncTasks[groupCode] = cron.schedule(schedule, async () => {
      try {
        this.logger.info('Iniciando sincronización programada de productos del grupo', {
          groupCode
        });
        await this.syncProductsByGroupCode(groupCode);
        this.logger.info('Sincronización programada del grupo completada exitosamente', {
          groupCode
        });
      } catch (error) {
        this.logger.error('Error en sincronización programada del grupo', {
          groupCode,
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Obtiene productos de SAP B1 usando consulta SQL directa
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de productos
   */
  async getProductsFromSAP(options = {}) {
    try {
      const { skip = 0, groupCode = null } = options;
      
      // Construir la consulta SQL que simula la vista B1_ProductsB1SLQuery
      let sqlQuery = `
        SELECT DISTINCT 
            T0.[ItemName], 
            COALESCE(T1.[Price], 0) as price_list1, 
            0 as price_list2, 
            0 as price_list3, 
            COALESCE(T0.[OnHand], 0) as Stock, 
            T0.CodeBars, 
            T0.[ItemCode] as 'Sap_Code', 
            COALESCE(T0.ItmsGrpCod, 0) as 'Sap_Group', 
            CASE WHEN frozenFor = 'N' THEN 'true' else 'false' END as is_active
        FROM OITM T0  
        INNER JOIN ITM1 T1 ON T0.ItemCode = T1.ItemCode 
        INNER JOIN OITW T2 ON T0.ItemCode = T2.ItemCode
        WHERE T1.PriceList = 1 AND T0.SellItem = 'Y'
      `;
      
      // Agregar filtro por grupo si se especifica
      if (groupCode) {
        sqlQuery += ` AND T0.ItmsGrpCod = ${parseInt(groupCode, 10)}`;
      }
      
      // Agregar paginación si se especifica
      if (skip > 0) {
        sqlQuery += ` ORDER BY T0.ItemCode OFFSET ${skip} ROWS`;
      } else {
        sqlQuery += ` ORDER BY T0.ItemCode`;
      }
      
      this.logger.debug('Ejecutando consulta SQL directa para productos', { 
        sqlQuery: sqlQuery.replace(/\s+/g, ' ').trim(),
        skip,
        groupCode
      });
      
      // Ejecutar la consulta SQL usando el endpoint de SqlQueries
      const endpoint = `SQLQueries('sql01')/List`;
      const data = await this.request('POST', endpoint, {
        QueryPath: sqlQuery
      });
      
      if (!data || !data.value) {
        throw new Error('Formato de respuesta inválido en consulta SQL');
      }

      // Mapear los datos correctamente asegurando valores numéricos válidos
      const mappedItems = data.value.map(item => {
        // Función auxiliar para parseo seguro
        const safeParseFloat = (val) => {
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const cleaned = val.replace(/[^\d.-]/g, '');
            const result = parseFloat(cleaned);
            return isNaN(result) ? 0 : result;
          }
          return 0;
        };

        const safeParseInt = (val) => {
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return Math.round(val);
          if (typeof val === 'string') {
            const cleaned = val.replace(/[^\d.-]/g, '');
            const result = parseInt(cleaned, 10);
            return isNaN(result) ? 0 : result;
          }
          return 0;
        };

        const safeParseBool = (val) => {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'string') return val.toLowerCase() === 'true';
          return true; // Por defecto activo
        };

        return {
          ItemName: item.ItemName || '',
          price_list1: safeParseFloat(item.price_list1),
          price_list2: safeParseFloat(item.price_list2),
          price_list3: safeParseFloat(item.price_list3),
          Stock: safeParseInt(item.Stock),
          CodeBars: item.CodeBars || '',
          Sap_Code: item.Sap_Code || '',
          Sap_Group: safeParseInt(item.Sap_Group),
          is_active: safeParseBool(item.is_active)
        };
      });

      this.logger.debug('Productos obtenidos de SAP B1 via SQL directa', { 
        count: mappedItems.length,
        skip,
        groupCode
      });

      return { value: mappedItems };
    } catch (error) {
      this.logger.error('Error al obtener productos de SAP B1 via SQL directa', {
        error: error.message,
        stack: error.stack,
        options
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
    const parseNumberSafely = (value, defaultValue = 0) => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleanValue = value.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleanValue);
        return isNaN(parsed) ? defaultValue : parsed;
      }
      return defaultValue;
    };
  
    return {
      name: sapProduct.ItemName || 'Sin nombre',
      description: sapProduct.ItemName || 'Sin descripción',
      priceList1: parseNumberSafely(sapProduct.price_list1),
      priceList2: parseNumberSafely(sapProduct.price_list2),
      priceList3: parseNumberSafely(sapProduct.price_list3),
      stock: parseInt(parseNumberSafely(sapProduct.Stock), 10),
      barcode: sapProduct.CodeBars || null,
      imageUrl: null,
      sapCode: sapProduct.Sap_Code,
      sapGroup: parseInt(parseNumberSafely(sapProduct.Sap_Group), 10),
      isActive: sapProduct.is_active === "true" || sapProduct.is_active === true || true,
      sapLastSync: new Date().toISOString(),
      sapSyncPending: false
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
      errors: 0
    };
  
    try {
      this.logger.info('Iniciando sincronización de productos desde SAP B1', {
        mode: fullSync ? 'completa' : 'incremental'
      });
  
      // Registrar inicio de sincronización
      const syncStartTime = new Date();
      
      // Si es sincronización completa, reiniciar secuencia desde el ID adecuado
      if (fullSync) {
        try {
          const maxIdResult = await pool.query('SELECT COALESCE(MAX(product_id), 0) as max_id FROM products');
          const startId = Math.max(4, parseInt(maxIdResult.rows[0].max_id) + 1);
          
          // Reiniciar la secuencia a partir del ID correcto
          await pool.query(`ALTER SEQUENCE products_product_id_seq RESTART WITH ${startId}`);
          
          this.logger.info('Secuencia de productos reiniciada', { startId });
        } catch (seqError) {
          this.logger.error('Error al reiniciar secuencia de productos', {
            error: seqError.message
          });
          // Continuar con la sincronización a pesar del error
        }
      }
      
      let hasMore = true;
      let skip = 0;
      const MAX_ITERATIONS = 20; // Aumentar para manejar más productos
      let iterations = 0;
      let prevTotalItems = 0;
      
      while (hasMore && iterations < MAX_ITERATIONS) {
        iterations++;
        
        try {
          // Obtener lote de productos de SAP
          const { items, hasMore: moreItems, nextLink } = await this.getProductsFromSAP({
            skip
          });
          
          // Actualizar la bandera hasMore y calcular el siguiente skip
          hasMore = moreItems;
          
          // Extraer el valor de skip del nextLink o incrementar basado en el número de items
          if (nextLink) {
            // Extraer el valor de skip del nextLink si existe
            const skipMatch = nextLink.match(/\$skip=(\d+)/);
            if (skipMatch && skipMatch[1]) {
              skip = parseInt(skipMatch[1]);
            } else {
              skip += items.length;
            }
          } else {
            skip += items.length;
          }
          
          stats.total += items.length;
  
          // Verificar si recibimos nuevos items
          if (items.length === 0) {
            this.logger.warn('No se obtuvieron productos en esta iteración, finalizando sincronización', {
              iteration: iterations,
              skip: skip
            });
            hasMore = false;
            continue;
          }
          
          // Verificar si el total está avanzando para evitar bucles infinitos
          if (stats.total <= prevTotalItems) {
            this.logger.warn('No se están agregando nuevos productos, posible bucle, finalizando sincronización', {
              iteration: iterations,
              prevTotal: prevTotalItems,
              currentTotal: stats.total
            });
            hasMore = false;
            continue;
          }
          
          prevTotalItems = stats.total;
  
          this.logger.info(`Procesando lote de ${items.length} productos (total procesado: ${stats.total})`);
          
          // Procesar cada producto del lote individualmente
          for (const sapProduct of items) {
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              
              // Mapear producto de SAP al formato de la WebApp
              const webAppProduct = this.mapSapProductToWebApp(sapProduct);
              
              // Buscar si el producto ya existe por su código SAP
              const existingProduct = await Product.findBySapCode(sapProduct.Sap_Code, client);
              
              if (existingProduct) {
                // Si existe, actualizar
                await Product.update(existingProduct.product_id, webAppProduct, client, false);
                stats.updated++;
                this.logger.debug('Producto actualizado', {
                  sapCode: sapProduct.Sap_Code,
                  name: sapProduct.ItemName,
                  price_list1: webAppProduct.price_list1
                });
              } else {
                // Si no existe, crear
                await Product.create(webAppProduct, client);
                stats.created++;
                this.logger.debug('Producto creado', {
                  sapCode: sapProduct.Sap_Code,
                  name: sapProduct.ItemName,
                  price_list1: webAppProduct.price_list1
                });
              }
              
              await client.query('COMMIT');
            } catch (productError) {
              await client.query('ROLLBACK');
              stats.errors++;
              this.logger.error('Error al procesar producto individual', {
                sapCode: sapProduct.Sap_Code,
                name: sapProduct.ItemName,
                price_list1: sapProduct.price_list1,
                error: productError.message,
                stack: productError.stack?.split('\n').slice(0, 3).join('\n')
              });
            } finally {
              client.release();
            }
          }
        } catch (batchError) {
          this.logger.error('Error al procesar lote de productos', {
            error: batchError.message,
            stack: batchError.stack,
            skip
          });
          // Incrementar skip para intentar continuar con el siguiente lote
          skip += 20; // Asumir que hubo 20 productos que causaron el error
          stats.errors++;
        }
      }
  
      if (iterations >= MAX_ITERATIONS && hasMore) {
        this.logger.warn('Se alcanzó el límite máximo de iteraciones en la sincronización', {
          maxIterations: MAX_ITERATIONS,
          totalProcessed: stats.total
        });
      }
      
      // Actualizar timestamp de última sincronización exitosa
      this.lastSyncTime = syncStartTime;
      
      this.logger.info('Sincronización completada exitosamente', {
        stats,
        syncTime: new Date().toISOString()
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en sincronización con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sincroniza productos desde SAP B1 filtrados por grupo de artículos
   * @param {number} groupCode - Código del grupo de artículos a sincronizar (ej: 127)
   * @returns {Promise<Object>} Estadísticas de sincronización
   */
  async syncProductsByGroupCode(groupCode) {
    const stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };
  
    try {
      this.logger.info('Iniciando sincronización de productos por grupo', {
        groupCode
      });
  
      // Registrar inicio de sincronización
      const syncStartTime = new Date();
      
      let hasMore = true;
      let skip = 0;
      const MAX_ITERATIONS = 20;
      let iterations = 0;
      
      while (hasMore && iterations < MAX_ITERATIONS) {
        iterations++;
        
        try {
          // Obtener lote de productos de SAP filtrados por grupo
          const productData = await this.getProductsFromSAP({ 
            skip, 
            groupCode 
          });
          
          // Filtrar manualmente los productos por grupo
          const filteredItems = items.filter(item => 
            parseInt(item.Sap_Group) === parseInt(groupCode)
          );
          
          hasMore = moreItems;
          
          // Actualizar skip basado en nextLink o incrementando por la cantidad de items
          if (nextLink) {
            const skipMatch = nextLink.match(/\$skip=(\d+)/);
            if (skipMatch && skipMatch[1]) {
              skip = parseInt(skipMatch[1]);
            } else {
              skip += items.length;
            }
          } else {
            skip += items.length;
          }
          
          stats.total += filteredItems.length;
          
          if (filteredItems.length === 0 && items.length === 0) {
            this.logger.warn('No se obtuvieron productos, finalizando sincronización', {
              iteration: iterations,
              groupCode,
              skip
            });
            hasMore = false;
            continue;
          }
  
          // Procesar solo los productos del grupo especificado
          for (const sapProduct of filteredItems) {
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              
              // Mapear producto de SAP al formato de la WebApp
              const webAppProduct = this.mapSapProductToWebApp(sapProduct);
              
              // Asegurar valores numéricos válidos
              webAppProduct.price_list1 = parseFloat(sapProduct.price_list1) || 0;
              webAppProduct.price_list2 = parseFloat(sapProduct.price_list2) || 0;
              webAppProduct.price_list3 = parseFloat(sapProduct.price_list3) || 0;
              webAppProduct.stock = parseInt(sapProduct.Stock) || 0;
              
              // Buscar si el producto ya existe por su código SAP
              const existingProduct = await Product.findBySapCode(sapProduct.Sap_Code, client);
              
              if (existingProduct) {
                // Si existe, actualizar
                await Product.update(existingProduct.product_id, webAppProduct, client, false);
                stats.updated++;
              } else {
                // Si no existe, crear
                await Product.create(webAppProduct, client);
                stats.created++;
              }
              
              await client.query('COMMIT');
            } catch (productError) {
              await client.query('ROLLBACK');
              stats.errors++;
              this.logger.error('Error al procesar producto individual del grupo', {
                sapCode: sapProduct.Sap_Code,
                groupCode,
                error: productError.message
              });
            } finally {
              client.release();
            }
          }
        } catch (batchError) {
          this.logger.error('Error al procesar lote de productos por grupo', {
            error: batchError.message,
            stack: batchError.stack,
            groupCode,
            skip
          });
          skip += 20; // Incrementar para intentar continuar con el siguiente lote
          stats.errors++;
        }
      }
      
      // Actualizar timestamp de última sincronización
      this.lastSyncTime = syncStartTime;
      this.lastGroupSyncTime = {
        ...(this.lastGroupSyncTime || {}),
        [groupCode]: syncStartTime
      };
      
      this.logger.info('Sincronización por grupo completada exitosamente', {
        stats,
        groupCode,
        syncTime: new Date().toISOString()
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en sincronización de productos por grupo', {
        error: error.message,
        stack: error.stack,
        groupCode
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
      
      this.logger.debug('Obteniendo producto específico de SAP B1', { itemCode });
      
      const data = await this.request('GET', endpoint);
      
      if (!data || !data.ItemCode) {
        throw new Error('Producto no encontrado o formato de respuesta inválido');
      }
      
      return data;
    } catch (error) {
      this.logger.error('Error al obtener producto de SAP B1', {
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
      
      this.logger.debug('Actualizando producto en SAP B1', {
        itemCode,
        updateFields: Object.keys(filteredData)
      });
      
      // PATCH permite actualización parcial
      const endpoint = `Items('${itemCode}')`;
      const result = await this.request('PATCH', endpoint, filteredData);
      
      this.logger.info('Producto actualizado exitosamente en SAP B1', {
        itemCode,
        fields: Object.keys(filteredData)
      });
      
      return result;
    } catch (error) {
      this.logger.error('Error al actualizar producto en SAP B1', {
        itemCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Actualiza la descripción de un producto en SAP B1 (campo FrgnName)
   * @param {string} itemCode - Código del producto en SAP (sap_code)
   * @param {string} description - Nueva descripción
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateProductDescriptionInSAP(itemCode, description) {
    try {
      // Validar parámetros
      if (!itemCode || !description) {
        throw new Error('Código SAP y descripción son requeridos');
      }
      
      this.logger.debug('Actualizando descripción de producto en SAP B1', {
        itemCode,
        descriptionLength: description.length
      });
      
      // Crear objeto de actualización con el campo FrgnName
      const updateData = {
        ForeignName: description
      };
      
      // Hacer la petición a SAP B1
      const endpoint = `Items('${itemCode}')`;
      const result = await this.request('PATCH', endpoint, updateData);
      
      this.logger.info('Descripción de producto actualizada exitosamente en SAP B1', {
        itemCode,
        success: true
      });
      
      return result;
    } catch (error) {
      this.logger.error('Error al actualizar descripción en SAP B1', {
        itemCode,
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
        this.logger.warn('Producto sin código SAP, no se puede sincronizar', {
          productId
        });
        return false;
      }
      
      this.logger.debug('Preparando actualización de producto hacia SAP B1', {
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
      
      this.logger.info('Producto sincronizado hacia SAP B1 exitosamente', {
        productId,
        sapCode: product.sap_code
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error al sincronizar producto hacia SAP B1', {
        productId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Exportar instancia única (singleton)
const sapProductService = new SapProductService();
module.exports = sapProductService;