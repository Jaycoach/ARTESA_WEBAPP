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
      
      // Construir endpoint OData para Items optimizado
      let endpoint = 'Items?';
      const params = [];

      // Filtrar por grupo si se especifica
      if (groupCode) {
        params.push(`$filter=ItemsGroupCode eq ${groupCode} and SalesItem eq 'tYES'`);
      } else {
        params.push(`$filter=SalesItem eq 'tYES'`);
      }

      // Seleccionar solo campos necesarios para optimizar transferencia
      params.push('$select=ItemCode,ItemName,ForeignName,ItemsGroupCode,BarCode,QuantityOnStock,SalesItem,Frozen,SalesVATGroup');

      // Paginación
      params.push(`$skip=${skip}`);
      params.push('$top=20');

      endpoint += params.join('&');

      this.logger.debug('Endpoint OData construido', {
        endpoint,
        groupCode,
        skip
      });
      const result = await this.request('GET', endpoint);

      if (!result || !result.value) {
        throw new Error('Formato de respuesta inválido en consulta OData');
      }

      // Los datos ya vienen en formato correcto de SAP B1 Service Layer
      const mappedItems = result.value;

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
      if (value === null || value === undefined || value === '') return defaultValue;
      const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    // Determinar si está activo (debe ser SalesItem y no estar congelado)
    const isActive = sapProduct.SalesItem === 'tYES' && sapProduct.Frozen === 'tNO';

    // Usar ForeignName si está disponible, sino ItemName
    const description = sapProduct.ForeignName || sapProduct.ItemName || 'Sin descripción';

    // Mapear el código de impuestos de SAP
    const taxCodeAr = sapProduct.SalesVATGroup || null;

    // Log para verificar el valor del campo de impuestos
    this.logger.debug('Mapeando código de impuestos', {
      sapCode: sapProduct.ItemCode,
      salesVATGroup: sapProduct.SalesVATGroup,
      taxCodeAr: taxCodeAr
    });

    return {
      name: sapProduct.ItemName || 'Sin nombre',
      description: description,
      priceList1: 0, // Los precios se manejarán por separado
      priceList2: 0,
      priceList3: 0,
      stock: parseInt(parseNumberSafely(sapProduct.QuantityOnStock), 10),
      barcode: sapProduct.BarCode || null,
      imageUrl: null,
      sapCode: sapProduct.ItemCode,
      sapGroup: parseInt(parseNumberSafely(sapProduct.ItemsGroupCode), 10),
      tax_code_ar: taxCodeAr,
      isActive: isActive,
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
      const MAX_ITERATIONS = 30; // Aumentar para manejar más productos
      let iterations = 0;
      let prevTotalItems = 0;
      
      while (hasMore && iterations < MAX_ITERATIONS) {
        iterations++;
        
        try {
          // Obtener lote de productos de SAP
          const productData = await this.getProductsFromSAP({
            skip
          });
          
          const items = productData.value || [];
          hasMore = items.length >= 20; // Continuar mientras obtengamos 20 o más items

          // Si obtuvimos menos de 20 items, probablemente llegamos al final
          if (items.length < 20) {
            hasMore = false;
          }

          // Incrementar skip basado en el número de items procesados
          skip += items.length;
          
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
              const existingProduct = await Product.findBySapCode(sapProduct.ItemCode, client);
              
              if (existingProduct) {
                // Si existe, actualizar
                await Product.update(existingProduct.product_id, webAppProduct, client, false);
                stats.updated++;
                this.logger.debug('Producto actualizado', {
                  sapCode: sapProduct.ItemCode,
                  name: sapProduct.ItemName,
                  price_list1: webAppProduct.price_list1
                });
              } else {
                // Si no existe, crear
                await Product.create(webAppProduct, client);
                stats.created++;
                this.logger.debug('Producto creado', {
                  sapCode: sapProduct.ItemCode,
                  name: sapProduct.ItemName,
                  price_list1: webAppProduct.price_list1
                });
              }
              
              await client.query('COMMIT');
            } catch (productError) {
              await client.query('ROLLBACK');
              stats.errors++;
              this.logger.error('Error al procesar producto individual', {
                sapCode: sapProduct.ItemCode,
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
      const MAX_ITERATIONS = 30;
      let iterations = 0;
      
      while (hasMore && iterations < MAX_ITERATIONS) {
        iterations++;
        
        try {
          // Obtener lote de productos de SAP filtrados por grupo
          const productData = await this.getProductsFromSAP({ 
            skip, 
            groupCode 
          });
          
          const items = productData.value || [];
          // Los productos ya vienen filtrados por grupo desde SAP
          const filteredItems = items;
          
          // Determinar si hay más productos
          hasMore = items.length >= 20;
          if (items.length < 20) {
            hasMore = false;
          }

          // Incrementar skip basado en el número de items procesados
          skip += items.length;
          
          // Verificar progreso para evitar bucles infinitos
          if (items.length === 0) {
            this.logger.warn('No se obtuvieron productos en esta iteración, finalizando sincronización', {
              iteration: iterations,
              skip: skip,
              groupCode: groupCode || 'todos'
            });
            hasMore = false;
            continue;
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
              
              // Buscar si el producto ya existe por su código SAP
              const existingProduct = await Product.findBySapCode(sapProduct.ItemCode, client);
              
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
                sapCode: sapProduct.ItemCode,
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
      const endpoint = `Items('${itemCode}')?$select=ItemCode,ItemName,ForeignName,ItemsGroupCode,BarCode,QuantityOnStock,SalesItem,Frozen`;
      
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

  /**
   * Actualiza códigos de impuestos de productos por grupo
   * @param {number} groupCode - Código del grupo de artículos
   * @returns {Promise<Object>} Estadísticas de actualización
   */
  async updateTaxCodesByGroup(groupCode) {
    const stats = {
      total: 0,
      updated: 0,
      errors: 0
    };

    try {
      // Obtener productos del grupo desde SAP
      const sapProducts = await this.getProductsFromSAP({
        groupCode,
        select: 'ItemCode,SalesVATGroup'
      });

      for (const sapProduct of sapProducts.value) {
        try {
          await pool.query(
            'UPDATE products SET tax_code_ar = $1, updated_at = CURRENT_TIMESTAMP WHERE sap_code = $2',
            [sapProduct.SalesVATGroup, sapProduct.ItemCode]
          );
          stats.updated++;
        } catch (error) {
          stats.errors++;
          this.logger.error('Error actualizando código de impuesto', {
            sapCode: sapProduct.ItemCode,
            error: error.message
          });
        }
        stats.total++;
      }

      return stats;
    } catch (error) {
      this.logger.error('Error en actualización de códigos de impuesto', {
        error: error.message,
        groupCode
      });
      throw error;
    }
  }
}

// Exportar instancia única (singleton)
const sapProductService = new SapProductService();
module.exports = sapProductService;