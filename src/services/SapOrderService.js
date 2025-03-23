const SapBaseService = require('./SapBaseService');
const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Servicio para integración de órdenes con SAP Business One
 * Extiende el servicio base para proporcionar funcionalidades específicas de órdenes
 */
class SapOrderService extends SapBaseService {
  constructor() {
    super('SapOrderService');
    this.syncSchedule = '0 */3 * * *'; // Cada 3 horas
    this.syncTasks = {};
  }

  /**
   * Inicializa el servicio y programa tareas
   */
  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Inicializar servicio base primero
      await super.initialize();
      
      // Vincularse al servicio de programación de órdenes para sincronizar después de cada actualización
      const orderScheduler = require('../services/OrderScheduler');
      
      // Asegurar que el orderScheduler está inicializado antes de usarlo
      if (!orderScheduler.initialized) {
        await orderScheduler.initialize();
      }
      
      this.logger.info('Registrando callback para sincronización posterior a actualización automática');
      orderScheduler.registerPostUpdateCallback(this.syncOrdersToSAP.bind(this));
      
      // Iniciar sincronización programada de órdenes
      this.scheduleSyncTask();
      
      return this;
    } catch (error) {
      this.logger.error('Error al inicializar servicio de órdenes SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Programa tarea para sincronización periódica de órdenes
   */
  scheduleSyncTask() {
    // Validar formato de programación cron
    if (!cron.validate(this.syncSchedule)) {
      this.logger.error('Formato de programación inválido', {
        schedule: this.syncSchedule
      });
      throw new Error(`Formato de programación cron inválido: ${this.syncSchedule}`);
    }

    this.logger.info('Programando sincronización periódica de órdenes', {
      schedule: this.syncSchedule
    });

    // Programar tarea cron
    this.syncTasks.orderSync = cron.schedule(this.syncSchedule, async () => {
      try {
        this.logger.info('Iniciando sincronización programada de órdenes');
        await this.syncOrdersToSAP();
        this.logger.info('Sincronización programada de órdenes completada exitosamente');
      } catch (error) {
        this.logger.error('Error en sincronización programada de órdenes', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Crea una orden de venta en SAP
   * @param {Object} order - Datos de la orden
   * @returns {Promise<Object>} - Resultado de la creación
   */
  async createOrderInSAP(order) {
    try {
      if (!order.order_id) {
        throw new Error('ID de orden es requerido');
      }
  
      this.logger.debug('Creando orden en SAP B1', {
        orderId: order.order_id
      });
  
      // Consulta para obtener todos los datos necesarios para la orden
      const orderResult = await pool.query(
        `SELECT o.*, cp.cardcode_sap, u.name as user_name
         FROM orders o
         JOIN users u ON o.user_id = u.id
         JOIN client_profiles cp ON u.id = cp.user_id
         WHERE o.order_id = $1`,
        [order.order_id]
      );
  
      if (orderResult.rows.length === 0) {
        throw new Error('Orden no encontrada');
      }
  
      const orderData = orderResult.rows[0];
      
      // Verificar que el cliente tenga código SAP
      if (!orderData.cardcode_sap) {
        throw new Error('Cliente no tiene código SAP asociado');
      }
  
      // Obtener detalles de los productos en la orden
      const orderItemsResult = await pool.query(
        `SELECT od.*, p.sap_code 
         FROM order_details od 
         JOIN products p ON od.product_id = p.product_id
         WHERE od.order_id = $1`,
        [order.order_id]
      );
  
      if (orderItemsResult.rows.length === 0) {
        throw new Error('La orden no tiene productos');
      }
  
      // Verificar que todos los productos tengan código SAP
      const itemsWithoutSapCode = orderItemsResult.rows.filter(item => !item.sap_code);
      if (itemsWithoutSapCode.length > 0) {
        this.logger.warn('Orden tiene productos sin código SAP', {
          orderId: order.order_id,
          productsWithoutSap: itemsWithoutSapCode.map(i => i.product_id)
        });
        throw new Error('Algunos productos no tienen código SAP asociado');
      }
  
      // Formatear fecha en formato YYYY-MM-DD
      const formatDate = (date) => {
        if (!date) return new Date().toISOString().split('T')[0];
        return new Date(date).toISOString().split('T')[0];
      };
  
      // Preparar datos para SAP
      const sapOrder = {
        CardCode: orderData.cardcode_sap,
        DocDate: formatDate(orderData.order_date), 
        DocDueDate: formatDate(orderData.delivery_date),
        Comments: `Orden web #${order.order_id} - Cliente: ${orderData.user_name}`,
        U_WebOrderId: order.order_id.toString(),
        DocumentLines: orderItemsResult.rows.map(item => ({
          ItemCode: item.sap_code,
          Quantity: parseFloat(item.quantity) || 1, // Asegurar que es un número
          Price: parseFloat(item.unit_price) || 0  // Incluir el precio unitario
        }))
      };
  
      // Verificar que el objeto cumpla con la estructura esperada por SAP
      this.logger.debug('Datos de orden preparados para SAP:', {
        CardCode: sapOrder.CardCode,
        DocDate: sapOrder.DocDate,
        DocDueDate: sapOrder.DocDueDate,
        Comments: sapOrder.Comments,
        LineItems: sapOrder.DocumentLines.length
      });
  
      // Enviar la orden a SAP
      const endpoint = 'Orders';
      const result = await this.request('POST', endpoint, sapOrder);
  
      if (result && result.DocEntry) {
        // Actualizar orden en base de datos con el DocEntry de SAP
        await pool.query(
          'UPDATE orders SET sap_doc_entry = $1, sap_synced = true, sap_sync_date = CURRENT_TIMESTAMP WHERE order_id = $2',
          [result.DocEntry, order.order_id]
        );
  
        this.logger.info('Orden creada exitosamente en SAP', {
          orderId: order.order_id,
          sapDocEntry: result.DocEntry,
          docNum: result.DocNum
        });
  
        return {
          success: true,
          sapDocEntry: result.DocEntry,
          sapDocNum: result.DocNum,
          orderId: order.order_id
        };
      } else {
        throw new Error('Respuesta de SAP no contiene DocEntry');
      }
    } catch (error) {
      this.logger.error('Error al crear orden en SAP', {
        orderId: order.order_id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtiene status de una orden desde SAP
   * @param {number} docEntry - DocEntry de la orden en SAP
   * @returns {Promise<Object>} - Estado de la orden en SAP
   */
  async getOrderStatusFromSAP(docEntry) {
    try {
      if (!docEntry) {
        throw new Error('DocEntry es requerido');
      }

      this.logger.debug('Consultando estado de orden en SAP', { docEntry });

      // Construir endpoint para obtener una orden específica
      const endpoint = `Orders(${docEntry})`;
      
      // Realizar petición a SAP
      const data = await this.request('GET', endpoint);
      
      if (!data || !data.DocEntry) {
        throw new Error('Orden no encontrada o formato de respuesta inválido');
      }
      
      return {
        docEntry: data.DocEntry,
        docNum: data.DocNum,
        status: data.DocumentStatus,
        totalAmount: data.DocTotal,
        cardCode: data.CardCode,
        comments: data.Comments
      };
    } catch (error) {
      this.logger.error('Error al obtener estado de orden de SAP', {
        docEntry,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sincroniza órdenes pendientes hacia SAP
   * @returns {Promise<Object>} - Estadísticas de sincronización
   */
  async syncOrdersToSAP() {
    const stats = {
      total: 0,
      created: 0,
      errors: 0,
      skipped: 0
    };
  
    try {
      this.logger.info('Iniciando sincronización de órdenes con SAP B1');
      
      // Registrar inicio de sincronización
      const syncStartTime = new Date();
      
      // Obtener órdenes pendientes de sincronizar
      // Se enfoca en órdenes en estado "En Producción" (3) que aún no han sido sincronizadas
      // o que tienen menos de 3 intentos fallidos
      const query = `
      SELECT o.order_id, COALESCE(o.sap_sync_attempts, 0) as sap_sync_attempts, o.sap_sync_error
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN client_profiles cp ON u.id = cp.user_id
      WHERE (o.sap_synced = false OR o.sap_synced IS NULL)
      AND o.status_id = 3  -- En Producción
      AND cp.cardcode_sap IS NOT NULL
      AND COALESCE(o.sap_sync_attempts, 0) < 3 -- Limitar intentos
      ORDER BY o.created_at ASC
      `;
      
      const { rows } = await pool.query(query);
      stats.total = rows.length;
      
      this.logger.info(`Encontradas ${rows.length} órdenes para sincronizar`);
      
      // Para cada orden, intentar crearla en SAP
      for (const orderRow of rows) {
        try {
          await this.createOrderInSAP({ order_id: orderRow.order_id });
          stats.created++;
          
        } catch (orderError) {
          stats.errors++;
          this.logger.error('Error al sincronizar orden individual', {
            orderId: orderRow.order_id,
            error: orderError.message
          });
          
          // Actualizar el estado de error en la orden
          try {
            await pool.query(
              'UPDATE orders SET sap_sync_error = $1, sap_sync_attempts = COALESCE(sap_sync_attempts, 0) + 1 WHERE order_id = $2',
              [orderError.message.substring(0, 255), orderRow.order_id]
            );
          } catch (updateError) {
            this.logger.error('Error al actualizar estado de error en orden', {
              orderId: orderRow.order_id,
              error: updateError.message
            });
          }
        }
      }
      
      // Actualizar timestamp de última sincronización
      this.lastSyncTime = syncStartTime;
      
      this.logger.info('Sincronización de órdenes completada', {
        total: stats.total,
        created: stats.created,
        errors: stats.errors,
        skipped: stats.skipped
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en sincronización de órdenes con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Actualiza estado de órdenes sincronizadas desde SAP
   * @returns {Promise<Object>} - Estadísticas de actualización
   */
  async updateOrderStatusFromSAP() {
    const stats = {
      total: 0,
      updated: 0,
      errors: 0,
      unchanged: 0
    };

    try {
      this.logger.info('Iniciando actualización de estados de órdenes desde SAP');
      
      // Obtener órdenes sincronizadas con SAP que no estén en estado final
      const query = `
        SELECT order_id, sap_doc_entry, status
        FROM orders
        WHERE sap_synced = true 
        AND sap_doc_entry IS NOT NULL
        AND status NOT IN ('cancelled', 'completed', 'returned')
        ORDER BY updated_at ASC
      `;
      
      const { rows } = await pool.query(query);
      stats.total = rows.length;
      
      this.logger.info(`Encontradas ${rows.length} órdenes para actualizar estado`);
      
      // Para cada orden, consultar su estado en SAP
      for (const order of rows) {
        try {
          const sapStatus = await this.getOrderStatusFromSAP(order.sap_doc_entry);
          
          // Mapear estado de SAP a estado de la WebApp
          let webAppStatus = order.status;
          
          if (sapStatus.status === 'C') { // Closed
            webAppStatus = 'completed';
          } else if (sapStatus.status === 'O') { // Open
            webAppStatus = 'processing';
          } else if (sapStatus.status === 'L') { // Locked
            webAppStatus = 'processing'; // O asignar otro estado según la lógica de negocio
          }
          
          // Si el estado ha cambiado, actualizar en la base de datos
          if (webAppStatus !== order.status) {
            await pool.query(
              'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP, sap_last_sync = CURRENT_TIMESTAMP WHERE order_id = $2',
              [webAppStatus, order.order_id]
            );
            
            stats.updated++;
            this.logger.info('Estado de orden actualizado desde SAP', {
              orderId: order.order_id,
              oldStatus: order.status,
              newStatus: webAppStatus,
              sapStatus: sapStatus.status
            });
          } else {
            stats.unchanged++;
          }
          
        } catch (orderError) {
          stats.errors++;
          this.logger.error('Error al actualizar estado de orden desde SAP', {
            orderId: order.order_id,
            docEntry: order.sap_doc_entry,
            error: orderError.message
          });
        }
      }
      
      this.logger.info('Actualización de estados de órdenes completada', {
        total: stats.total,
        updated: stats.updated,
        errors: stats.errors,
        unchanged: stats.unchanged
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en actualización de estados de órdenes desde SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Exportar instancia única (singleton)
const sapOrderService = new SapOrderService();
module.exports = sapOrderService;