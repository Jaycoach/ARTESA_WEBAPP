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
    this.syncSchedule = null; // Se configurará dinámicamente basado en AdminSettings
    this.orderTimeLimit = null; // Caché de la hora límite
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

      // Configurar sincronización basada en AdminSettings
      await this.configureScheduleFromSettings();
      
      // Vincularse al servicio de programación de órdenes para sincronizar después de cada actualización
      const orderScheduler = require('../services/OrderScheduler');
      
      // Asegurar que el orderScheduler está inicializado antes de usarlo
      if (!orderScheduler.initialized) {
        await orderScheduler.initialize();
      }
      
      this.logger.info('Registrando callback para sincronización posterior a actualización automática');
      orderScheduler.registerPostUpdateCallback(this.syncOrdersToSAP.bind(this));
      
      // Iniciar sincronización programada diaria de órdenes (verifica qué órdenes deben sincronizarse 2 días antes de entrega)
      this.scheduleSyncTask();
      
      // Añadir una segunda tarea programada para consultar órdenes entregadas
      this.scheduleDeliveryCheckTask();

      // Añadir una tercera tarea programada para consultar órdenes facturadas
      this.scheduleInvoiceCheckTask();
      
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
   * Configura la programación de sincronización basada en AdminSettings
   */
  async configureScheduleFromSettings() {
    try {
      const AdminSettings = require('../models/AdminSettings');
      const settings = await AdminSettings.getSettings();
      
      if (settings && settings.orderTimeLimit) {
        this.orderTimeLimit = settings.orderTimeLimit;
        
        // Extraer horas y minutos de la hora límite (ej: "18:00")
        const [hours, minutes] = settings.orderTimeLimit.split(':').map(Number);
        
        // Configurar sincronización 30 minutos después de la hora límite
        const syncMinutes = (minutes + 30) % 60;
        const syncHours = hours + Math.floor((minutes + 30) / 60);
        
        // Crear expresión cron: minutos horas * * * (diariamente)
        this.syncSchedule = `${syncMinutes} ${syncHours} * * *`;
        
        this.logger.info('Programación de sincronización configurada desde AdminSettings', {
          orderTimeLimit: settings.orderTimeLimit,
          syncSchedule: this.syncSchedule,
          syncTime: `${syncHours.toString().padStart(2, '0')}:${syncMinutes.toString().padStart(2, '0')}`
        });
      } else {
        // Fallback por defecto
        this.syncSchedule = '30 18 * * *'; // 6:30 PM por defecto
        this.orderTimeLimit = '18:00';
        
        this.logger.warn('No se pudo obtener orderTimeLimit de AdminSettings, usando valores por defecto', {
          defaultSyncSchedule: this.syncSchedule,
          defaultOrderTimeLimit: this.orderTimeLimit
        });
      }
    } catch (error) {
      this.logger.error('Error al configurar programación desde AdminSettings', {
        error: error.message,
        stack: error.stack
      });
      
      // Usar valores por defecto en caso de error
      this.syncSchedule = '30 18 * * *';
      this.orderTimeLimit = '18:00';
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
   * Programa tarea para verificar órdenes entregadas en SAP
   */
  scheduleDeliveryCheckTask() {
    // Programar verificación tres veces al día: 8AM, 12PM y 4PM
    const deliveryCheckSchedule = '0 8,12,16 * * *';
  
    this.logger.info('Programando verificación periódica de órdenes entregadas y facturadas en SAP', {
      schedule: deliveryCheckSchedule
    });
  
    // Programar tarea cron
    this.syncTasks.deliveryCheck = cron.schedule(deliveryCheckSchedule, async () => {
      try {
        this.logger.info('Iniciando verificación programada de órdenes entregadas y facturadas');
        
        // Verificar órdenes entregadas completamente (método existente)
        await this.checkDeliveredOrdersFromSAP();
        
        // Verificar órdenes con entrega parcial (nuevo método)
        await this.checkPartialDeliveredOrdersFromSAP();
        
        // Verificar órdenes facturadas (nuevo método)
        await this.checkInvoicedOrdersFromSAP();
        
        this.logger.info('Verificación programada de órdenes entregadas y facturadas completada exitosamente');
      } catch (error) {
        this.logger.error('Error en verificación programada de órdenes', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
 * Programa tarea para verificar órdenes facturadas en SAP
 */
scheduleInvoiceCheckTask() {
  // Programar verificación una vez al día: 23:00 hrs
  const invoiceCheckSchedule = '0 23 * * *';  // Todos los días a las 23:00

  this.logger.info('Programando verificación diaria de órdenes facturadas en SAP', {
    schedule: invoiceCheckSchedule
  });

  // Programar tarea cron
  this.syncTasks.invoiceCheck = cron.schedule(invoiceCheckSchedule, async () => {
    try {
      this.logger.info('Iniciando verificación programada de órdenes facturadas');
      
      // Verificar órdenes facturadas
      await this.checkInvoicedOrdersFromSAP();
      
      this.logger.info('Verificación programada de órdenes facturadas completada exitosamente');
    } catch (error) {
      this.logger.error('Error en verificación programada de órdenes facturadas', {
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
  
      // Obtener información de la sucursal si está especificada
      let shipToCode = null;
      if (orderData.branch_id) {
        const branchQuery = 'SELECT ship_to_code FROM client_branches WHERE branch_id = $1';
        const branchResult = await pool.query(branchQuery, [orderData.branch_id]);
        
        if (branchResult.rows.length > 0) {
          shipToCode = branchResult.rows[0].ship_to_code;
          
          this.logger.debug('Sucursal encontrada para orden SAP', {
            orderId: order.order_id,
            branchId: orderData.branch_id,
            shipToCode
          });
        }
      }

      // Preparar datos para SAP
      const sapOrder = {
        CardCode: orderData.cardcode_sap,
        DocDate: formatDate(orderData.order_date), 
        DocDueDate: formatDate(orderData.delivery_date),
        Comments: `Orden web #${order.order_id} - Cliente: ${orderData.user_name}`,
        U_WebOrderId: order.order_id.toString(),
        DocumentLines: orderItemsResult.rows.map(item => ({
          ItemCode: item.sap_code,
          Quantity: parseFloat(item.quantity) || 1,
          Price: parseFloat(item.unit_price) || 0
        }))
      };

      // Validar y actualizar TRM si es necesario
      const trmValidation = await this.validateAndUpdateTRM(orderData.order_date || new Date());
      if (!trmValidation.success) {
        throw new Error(`Error al validar TRM: ${trmValidation.error}`);
      }

      this.logger.info('TRM validada para la orden', {
        orderId: order.order_id,
        orderDate: orderData.order_date,
        trmRate: trmValidation.rate,
        trmDate: trmValidation.date,
        wasUpdated: trmValidation.wasUpdated
      });

      // Añadir ShipToCode si existe
      if (shipToCode) {
        sapOrder.ShipToCode = shipToCode;
        this.logger.debug('ShipToCode añadido a orden SAP', {
          orderId: order.order_id,
          shipToCode
        });
      }
  
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
        // Actualizar orden en base de datos con el DocEntry y DocNum de SAP
        await pool.query(
          'UPDATE orders SET sap_doc_entry = $1, docnum_sap = $2, sap_synced = true, sap_sync_date = CURRENT_TIMESTAMP WHERE order_id = $3',
          [result.DocEntry, result.DocNum, order.order_id]
        );
        
        this.logger.info('Orden creada exitosamente en SAP', {
          orderId: order.order_id,
          sapDocEntry: result.DocEntry,
          sapDocNum: result.DocNum
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
      
      // Obtener órdenes pendientes de sincronizar 48 horas antes de la fecha de entrega
      // Se enfoca en órdenes en estado "En Producción" (3) que aún no han sido sincronizadas
      // y cuya fecha de entrega sea dentro de 2 días (48 horas)
      // La sincronización se ejecuta después de la hora límite configurada en AdminSettings
      const query = `
        SELECT o.order_id, COALESCE(o.sap_sync_attempts, 0) as sap_sync_attempts, o.sap_sync_error, o.delivery_date
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN client_profiles cp ON u.id = cp.user_id
        WHERE (o.sap_synced = false OR o.sap_synced IS NULL)
        AND o.status_id = 3  -- En Producción
        AND cp.cardcode_sap IS NOT NULL
        AND COALESCE(o.sap_sync_attempts, 0) < 3 -- Limitar intentos
        AND o.delivery_date IS NOT NULL  -- Solo órdenes con fecha de entrega definida
        AND DATE(o.delivery_date) = DATE(CURRENT_DATE + INTERVAL '2 days')  -- Solo órdenes que se entregan en 2 días
        ORDER BY o.created_at ASC
      `;
      
      const { rows } = await pool.query(query);
      stats.total = rows.length;
      
      this.logger.info(`Encontradas ${rows.length} órdenes para sincronizar`);

      const targetDeliveryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      this.logger.info(`Encontradas ${rows.length} órdenes para sincronizar`, {
        targetDeliveryDate,
        orderTimeLimit: this.orderTimeLimit,
        syncSchedule: this.syncSchedule
      });

      if (rows.length > 0) {
        this.logger.info('Sincronizando órdenes que se entregan en 2 días', {
          deliveryDate: targetDeliveryDate,
          ordersToSync: rows.map(r => ({
            orderId: r.order_id,
            deliveryDate: r.delivery_date,
            syncAttempts: r.sap_sync_attempts
          }))
        });
      } else {
        this.logger.info('No hay órdenes para sincronizar hoy', {
          targetDeliveryDate,
          note: 'Solo se sincronizan órdenes 2 días antes de su fecha de entrega'
        });
      }
      
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
      SELECT order_id, sap_doc_entry, status_id
      FROM orders
      WHERE sap_synced = true 
      AND sap_doc_entry IS NOT NULL
      AND status_id NOT IN (5, 6) -- 5=Cerrado, 6=Cancelado
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
          let webAppStatusId = order.status_id;
       
          if (sapStatus.status === 'C') { // Closed
            webAppStatusId = 5; // ID para "Cerrado"
          } else if (sapStatus.status === 'O') { // Open
            webAppStatusId = 3; // ID para "En Producción"
          } else if (sapStatus.status === 'L') { // Locked
            webAppStatusId = 3; // ID para "En Producción" u otro estado según la lógica
          }
          
          // Si el estado ha cambiado, actualizar en la base de datos
          if (webAppStatusId !== order.status_id) {
            await pool.query(
              'UPDATE orders SET status_id = $1, updated_at = CURRENT_TIMESTAMP, sap_last_sync = CURRENT_TIMESTAMP WHERE order_id = $2',
              [webAppStatusId, order.order_id]
            );
            
            stats.updated++;
            this.logger.info('Estado de orden actualizado desde SAP', {
              orderId: order.order_id,
              oldStatus: order.status_id,
              newStatus: webAppStatusId,
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

  /**
   * Verifica las órdenes entregadas consultando el estado en SAP
   * @returns {Promise<Object>} - Estadísticas de actualización
   */
  async checkDeliveredOrdersFromSAP() {
    const stats = {
      total: 0,
      updated: 0,
      errors: 0,
      unchanged: 0,
      notFound: 0
    };

    try {
      this.logger.info('Iniciando verificación de órdenes entregadas desde SAP');

      // Asegurar conexión con SAP
      if (!this.sessionId) {
        await this.login();
      }

      this.logger.info('Utilizando consulta directa al Service Layer para verificar órdenes entregadas completamente');

      // Obtener órdenes sincronizadas con SAP que estén en estado "En Producción" (3)
      const query = `
        SELECT order_id, sap_doc_entry, status_id
        FROM orders
        WHERE sap_synced = true 
        AND sap_doc_entry IS NOT NULL
        AND status_id = 3  -- En Producción
        ORDER BY updated_at ASC
        LIMIT 50  -- Procesar en lotes para evitar timeouts
      `;
      
      const { rows } = await pool.query(query);
      
      if (rows.length === 0) {
        this.logger.info('No se encontraron órdenes para verificar entrega');
        return stats;
      }
      
      this.logger.info(`Encontradas ${rows.length} órdenes para verificar entrega`);

      // Procesar cada orden individualmente usando consultas directas al Service Layer
      for (const order of rows) {
        try {
          // Obtener detalles completos de la orden desde SAP
          const orderDetailEndpoint = `Orders(${order.sap_doc_entry})`;
          const orderDetail = await this.request('GET', orderDetailEndpoint);
          
          if (!orderDetail || !orderDetail.DocumentLines || !Array.isArray(orderDetail.DocumentLines)) {
            this.logger.warn('Orden sin líneas válidas en SAP', { 
              orderId: order.order_id,
              sapDocEntry: order.sap_doc_entry 
            });
            continue;
          }

          // Calcular totales de la orden (simular GROUP BY del SQL)
          let totalOrderedQuantity = 0;
          let remainingOpenQuantity = 0;
          
          for (const line of orderDetail.DocumentLines) {
            totalOrderedQuantity += parseFloat(line.Quantity) || 0;
            remainingOpenQuantity += parseFloat(line.RemainingOpenQuantity) || 0;
          }

          // Determinar estado de entrega (simular CASE del SQL)
          let deliveryStatus;
          if (remainingOpenQuantity === 0) {
            deliveryStatus = 'Completa';
          } else if (remainingOpenQuantity < totalOrderedQuantity) {
            deliveryStatus = 'Parcial';
          } else {
            deliveryStatus = 'No Entregada';
          }

          stats.total++;

          // Solo procesar órdenes que estén completamente entregadas
          if (deliveryStatus === 'Completa' && order.status_id !== 4) {
            const deliveredQuantity = totalOrderedQuantity; // Si está completa, todo fue entregado
            
            await pool.query(
              `UPDATE orders 
              SET status_id = 4, 
                  delivered_quantity = $1,
                  total_quantity = $2,
                  status_update = CURRENT_TIMESTAMP, 
                  updated_at = CURRENT_TIMESTAMP, 
                  sap_last_sync = CURRENT_TIMESTAMP 
              WHERE order_id = $3`,
              [deliveredQuantity, totalOrderedQuantity, order.order_id]
            );
            
            stats.updated++;
            this.logger.info('Orden marcada como entregada completamente', {
              orderId: order.order_id,
              sapDocEntry: order.sap_doc_entry,
              deliveredQuantity: deliveredQuantity,
              totalQuantity: totalOrderedQuantity,
              deliveryStatus
            });
          } else {
            stats.unchanged++;
            this.logger.debug('Orden sin cambios de estado', {
              orderId: order.order_id,
              sapDocEntry: order.sap_doc_entry,
              currentStatus: order.status_id,
              deliveryStatus,
              totalOrdered: totalOrderedQuantity,
              remaining: remainingOpenQuantity
            });
          }
          
          // Pausa para evitar sobrecarga del Service Layer
          await new Promise(resolve => setTimeout(resolve, 150));
          
        } catch (orderError) {
          stats.errors++;
          this.logger.error('Error al verificar entrega completa de orden', {
            orderId: order.order_id,
            sapDocEntry: order.sap_doc_entry,
            error: orderError.message
          });
        }
      }
      
      this.logger.info('Verificación de órdenes entregadas completada', {
        total: stats.total,
        updated: stats.updated,
        unchanged: stats.unchanged,
        errors: stats.errors,
        notFound: stats.notFound
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en verificación de órdenes entregadas desde SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Verifica las órdenes con entregas parciales y actualiza su estado
   * @returns {Promise<Object>} - Estadísticas de actualización
   */
  async checkPartialDeliveredOrdersFromSAP() {
    const stats = {
      total: 0,
      updated: 0,
      errors: 0,
      unchanged: 0
    };

    try {
      this.logger.info('Iniciando verificación de órdenes con entregas parciales desde SAP');

      // Asegurar conexión con SAP
      if (!this.sessionId) {
        await this.login();
      }

      this.logger.info('Utilizando consulta directa al Service Layer para simular vista B1_DeliveredOrdersB1SLQuery');

      // Paso 1: Obtener órdenes no canceladas y abiertas desde SAP
      const ordersEndpoint = "Orders?$filter=Cancelled eq 'tNO' and DocumentStatus eq 'bost_Open'&$top=50";
      const ordersResponse = await this.request('GET', ordersEndpoint);

      if (!ordersResponse || !ordersResponse.value || !Array.isArray(ordersResponse.value)) {
        this.logger.warn('No se obtuvieron órdenes válidas desde SAP');
        return stats;
      }

      this.logger.info(`Procesando ${ordersResponse.value.length} órdenes desde SAP`);

      // Paso 2: Para cada orden, obtener detalles completos y calcular estado de entrega
      for (const orderSummary of ordersResponse.value) {
        try {
          // Obtener detalles completos de la orden incluyendo líneas
          const orderDetailEndpoint = `Orders(${orderSummary.DocEntry})`;
          const orderDetail = await this.request('GET', orderDetailEndpoint);
          
          if (!orderDetail || !orderDetail.DocumentLines || !Array.isArray(orderDetail.DocumentLines)) {
            this.logger.warn('Orden sin líneas válidas', { docEntry: orderSummary.DocEntry });
            continue;
          }

          // Calcular totales de la orden (simular GROUP BY del SQL)
          let totalOrderedQuantity = 0;
          let remainingOpenQuantity = 0;
          
          for (const line of orderDetail.DocumentLines) {
            totalOrderedQuantity += parseFloat(line.Quantity) || 0;
            remainingOpenQuantity += parseFloat(line.RemainingOpenQuantity) || 0;
          }

          // Determinar estado de entrega (simular CASE del SQL)
          let deliveryStatus;
          if (remainingOpenQuantity === 0) {
            deliveryStatus = 'Completa';
          } else if (remainingOpenQuantity < totalOrderedQuantity) {
            deliveryStatus = 'Parcial';
          } else {
            deliveryStatus = 'No Entregada';
          }

          // Solo procesar órdenes con alguna entrega (simular HAVING del SQL)
          if (remainingOpenQuantity >= totalOrderedQuantity) {
            // Sin entregas, omitir
            continue;
          }

          this.logger.debug('Orden con entrega detectada', {
            docEntry: orderDetail.DocEntry,
            docNum: orderDetail.DocNum,
            totalOrdered: totalOrderedQuantity,
            remaining: remainingOpenQuantity,
            deliveryStatus
          });

          stats.total++;

          // Buscar orden en base de datos local
          const { rows } = await pool.query(
            'SELECT order_id, status_id, delivered_quantity, total_quantity FROM orders WHERE sap_doc_entry = $1',
            [orderDetail.DocEntry]
          );

          if (rows.length === 0) {
            this.logger.warn('Orden no encontrada en base de datos local', { 
              sapDocEntry: orderDetail.DocEntry, 
              sapDocNum: orderDetail.DocNum 
            });
            continue;
          }

          const order = rows[0];
          const currentStatus = order.status_id;
          
          // Determinar nuevo estado basado en el DeliveryStatus
          let newStatusId;
          if (deliveryStatus === 'Completa') {
            newStatusId = 4; // Entregado completo
          } else if (deliveryStatus === 'Parcial') {
            newStatusId = 7; // Entregado parcial
          } else {
            newStatusId = currentStatus; // No cambiar
          }

          const deliveredQuantity = totalOrderedQuantity - remainingOpenQuantity;

          // Actualizar si hay cambios
          if (newStatusId !== currentStatus || 
              Math.abs(parseFloat(order.delivered_quantity || 0) - deliveredQuantity) > 0.01) {
            
            await pool.query(
              `UPDATE orders 
              SET status_id = $1, 
                  delivered_quantity = $2,
                  total_quantity = $3,
                  status_update = CURRENT_TIMESTAMP, 
                  updated_at = CURRENT_TIMESTAMP, 
                  sap_last_sync = CURRENT_TIMESTAMP 
              WHERE order_id = $4`,
              [newStatusId, deliveredQuantity, totalOrderedQuantity, order.order_id]
            );
            
            stats.updated++;
            this.logger.info('Orden actualizada con estado de entrega', {
              orderId: order.order_id,
              sapDocEntry: orderDetail.DocEntry,
              oldStatus: currentStatus,
              newStatus: newStatusId,
              deliveredQuantity,
              totalQuantity: totalOrderedQuantity,
              deliveryStatus
            });
          } else {
            stats.unchanged++;
          }

          // Pausa para evitar sobrecarga del Service Layer
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (orderError) {
          stats.errors++;
          this.logger.error('Error al procesar orden individual', {
            docEntry: orderSummary.DocEntry,
            error: orderError.message,
            stack: orderError.stack
          });
        }
      }

      this.logger.info('Verificación de órdenes con entregas parciales completada', {
        total: stats.total,
        updated: stats.updated,
        unchanged: stats.unchanged,
        errors: stats.errors
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en verificación de órdenes con entregas parciales desde SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Verifica las órdenes facturadas y actualiza su estado
   * @returns {Promise<Object>} - Estadísticas de actualización
   */
  async checkInvoicedOrdersFromSAP() {
    const stats = {
      total: 0,
      updated: 0,
      errors: 0,
      unchanged: 0
    };

    try {
      this.logger.info('Iniciando verificación de órdenes facturadas desde SAP');

      // Asegurar conexión con SAP
      if (!this.sessionId) {
        await this.login();
      }

      // Paso 1: Obtener órdenes locales que podrían estar facturadas
      const ordersQuery = `
        SELECT order_id, sap_doc_entry, status_id, invoice_doc_entry, user_id
        FROM orders
        WHERE sap_synced = true 
        AND sap_doc_entry IS NOT NULL
        AND status_id IN (3, 4, 7)  -- En Producción, Entregado completo, Entregado parcial
        ORDER BY updated_at DESC
        LIMIT 100
      `;
      
      const { rows: localOrders } = await pool.query(ordersQuery);
      
      if (localOrders.length === 0) {
        this.logger.info('No se encontraron órdenes para verificar facturación');
        return stats;
      }

      this.logger.info(`Encontradas ${localOrders.length} órdenes locales para verificar facturación`);
      stats.total = localOrders.length;

      // Paso 2: Crear un mapa de DocEntry a orden local
      const orderMap = new Map();
      const sapDocEntries = [];
      
      for (const order of localOrders) {
        orderMap.set(order.sap_doc_entry, order);
        sapDocEntries.push(order.sap_doc_entry);
      }

      // Paso 3: Obtener órdenes desde SAP para obtener CardCode
      const ordersEndpoint = `Orders?$select=DocEntry,CardCode,DocDate,DocTotal&$top=200`;
      const sapOrdersResponse = await this.request('GET', ordersEndpoint);
      
      if (!sapOrdersResponse || !sapOrdersResponse.value) {
        this.logger.warn('No se pudieron obtener órdenes desde SAP');
        return stats;
      }

      // Crear mapa de DocEntry a CardCode
      const orderCardCodeMap = new Map();
      for (const sapOrder of sapOrdersResponse.value) {
        orderCardCodeMap.set(sapOrder.DocEntry, {
          cardCode: sapOrder.CardCode,
          docDate: sapOrder.DocDate,
          docTotal: sapOrder.DocTotal
        });
      }

      // Paso 4: Obtener todas las facturas recientes
      const invoicesEndpoint = `Invoices?$filter=Cancelled eq 'tNO'&$select=DocEntry,DocNum,DocDate,DocTotal,CardCode&$orderby=DocDate desc&$top=500`;
      const invoicesResponse = await this.request('GET', invoicesEndpoint);
      
      if (!invoicesResponse || !invoicesResponse.value) {
        this.logger.warn('No se pudieron obtener facturas desde SAP');
        return stats;
      }

      // Crear mapa de CardCode a facturas
      const invoicesByCardCode = new Map();
      for (const invoice of invoicesResponse.value) {
        if (!invoicesByCardCode.has(invoice.CardCode)) {
          invoicesByCardCode.set(invoice.CardCode, []);
        }
        invoicesByCardCode.get(invoice.CardCode).push({
          DocEntry: invoice.DocEntry,
          DocNum: invoice.DocNum,
          DocDate: new Date(invoice.DocDate),
          DocTotal: invoice.DocTotal,
          CardCode: invoice.CardCode
        });
      }

      this.logger.info(`Procesadas ${invoicesResponse.value.length} facturas desde SAP`);

      // Paso 5: Procesar cada orden local
      for (const localOrder of localOrders) {
        try {
          const sapOrderInfo = orderCardCodeMap.get(localOrder.sap_doc_entry);
          
          if (!sapOrderInfo) {
            this.logger.warn(`Orden SAP ${localOrder.sap_doc_entry} no encontrada en SAP`);
            stats.unchanged++;
            continue;
          }

          const orderDate = new Date(sapOrderInfo.docDate);
          const clientInvoices = invoicesByCardCode.get(sapOrderInfo.cardCode) || [];
          
          // Buscar facturas del mismo cliente posteriores a la orden
          const matchingInvoices = clientInvoices.filter(invoice => {
            const invoiceDate = invoice.DocDate;
            const timeDiffDays = (invoiceDate - orderDate) / (1000 * 60 * 60 * 24);
            
            // Facturas hasta 30 días después de la orden
            return timeDiffDays >= 0 && timeDiffDays <= 30;
          });

          if (matchingInvoices.length === 0) {
            // No hay facturas para este cliente después de la orden
            stats.unchanged++;
            continue;
          }

          // Buscar la factura más probable (misma cantidad o fecha más cercana)
          let bestMatch = null;
          let bestScore = 0;

          for (const invoice of matchingInvoices) {
            let score = 0;
            
            // Puntaje por coincidencia de monto (exacto = 100, similar = 50)
            const totalDiff = Math.abs(invoice.DocTotal - sapOrderInfo.docTotal);
            if (totalDiff === 0) {
              score += 100;
            } else if (totalDiff <= sapOrderInfo.docTotal * 0.1) {
              score += 50;
            }
            
            // Puntaje por proximidad de fecha (más cercana = más puntos)
            const timeDiffDays = (invoice.DocDate - orderDate) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 30 - timeDiffDays);
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = invoice;
            }
          }

          // Solo actualizar si hay un buen match (score >= 50)
          if (bestMatch && bestScore >= 50) {
            // Verificar si ya tenemos esta factura registrada
            if (localOrder.invoice_doc_entry === bestMatch.DocEntry) {
              stats.unchanged++;
              continue;
            }

            // Actualizar orden con información de factura
            const updateResult = await pool.query(
              `UPDATE orders 
               SET status_id = 5,  -- Estado "Facturado"
                   invoice_doc_entry = $1,
                   invoice_doc_num = $2,
                   invoice_date = $3,
                   invoice_total = $4,
                   updated_at = CURRENT_TIMESTAMP
               WHERE order_id = $5`,
              [
                bestMatch.DocEntry,
                bestMatch.DocNum,
                bestMatch.DocDate,
                bestMatch.DocTotal,
                localOrder.order_id
              ]
            );

            if (updateResult.rowCount > 0) {
              stats.updated++;
              this.logger.info('Orden actualizada con factura correlacionada', {
                orderId: localOrder.order_id,
                sapDocEntry: localOrder.sap_doc_entry,
                invoiceDocEntry: bestMatch.DocEntry,
                invoiceDocNum: bestMatch.DocNum,
                matchScore: bestScore,
                clientCode: sapOrderInfo.cardCode
              });
            } else {
              stats.unchanged++;
            }
          } else {
            // No hay suficiente correlación
            stats.unchanged++;
            this.logger.debug('No se encontró correlación suficiente para factura', {
              orderId: localOrder.order_id,
              sapDocEntry: localOrder.sap_doc_entry,
              clientCode: sapOrderInfo.cardCode,
              invoicesFound: matchingInvoices.length,
              bestScore: bestScore
            });
          }

        } catch (orderError) {
          stats.errors++;
          this.logger.error('Error al procesar orden para verificar facturación', {
            orderId: localOrder.order_id,
            sapDocEntry: localOrder.sap_doc_entry,
            error: orderError.message
          });
        }
      }

      this.logger.info('Verificación de órdenes facturadas completada', {
        total: stats.total,
        updated: stats.updated,
        errors: stats.errors,
        unchanged: stats.unchanged
      });

      return stats;

    } catch (error) {
      this.logger.error('Error en verificación de órdenes facturadas desde SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Reconfigura la programación cuando cambian los settings
   * @param {Object} newSettings - Nuevos settings de admin
   */
  async reconfigureSchedule(newSettings) {
    try {
      if (newSettings && newSettings.orderTimeLimit && newSettings.orderTimeLimit !== this.orderTimeLimit) {
        this.logger.info('Reconfigurando programación de sincronización por cambio en AdminSettings', {
          oldOrderTimeLimit: this.orderTimeLimit,
          newOrderTimeLimit: newSettings.orderTimeLimit,
          oldSchedule: this.syncSchedule
        });
        
        // Detener tareas existentes
        if (this.syncTasks.orderSync) {
          this.syncTasks.orderSync.stop();
          this.syncTasks.orderSync = null;
        }
        
        // Reconfigurar con nuevos settings
        await this.configureScheduleFromSettings();
        
        // Reiniciar programación
        this.scheduleSyncTask();
        
        this.logger.info('Programación de sincronización reconfigurada exitosamente', {
          newOrderTimeLimit: this.orderTimeLimit,
          newSchedule: this.syncSchedule
        });
      }
    } catch (error) {
      this.logger.error('Error al reconfigurar programación de sincronización', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  /**
   * Valida y actualiza la TRM (Tasa Representativa del Mercado) si es necesario
   * @param {Date} orderDate - Fecha de la orden
   * @returns {Promise<Object>} - Resultado de la validación
   */
  async validateAndUpdateTRM(orderDate) {
    try {
      const checkDate = new Date(orderDate);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      this.logger.debug('Verificando TRM para fecha de sincronización', {
        date: dateStr,
        dayOfWeek: checkDate.getDay()
      });

      let currentTRM = null;
      let wasUpdated = false;
      
      try {
        // Usar SBOBobService_GetCurrencyRate que funciona correctamente
        const rateResponse = await this.request('POST', 'SBOBobService_GetCurrencyRate', {
          Currency: 'USD',
          Date: dateStr
        });
        
        // SAP retorna el valor directamente como número
        if (rateResponse && rateResponse > 0) {
          currentTRM = {
            Rate: rateResponse,
            Date: dateStr
          };
          this.logger.debug('TRM encontrada para la fecha', {
            date: dateStr,
            rate: rateResponse
          });
          return {
            success: true,
            rate: currentTRM.Rate,
            date: currentTRM.Date,
            wasUpdated: false
          };
        }
      } catch (rateError) {
        // Si no hay tasa para la fecha actual (común en fines de semana)
        this.logger.info('TRM no encontrada para la fecha actual, buscando TRM anterior', {
          date: dateStr,
          error: rateError.message || 'Sin TRM para esta fecha'
        });
        
        // Buscar TRM de días anteriores (hasta 7 días atrás)
        let foundRate = false;
        let lastValidRate = null;
        
        for (let i = 1; i <= 7; i++) {
          const previousDate = new Date(checkDate);
          previousDate.setDate(previousDate.getDate() - i);
          const prevDateStr = previousDate.toISOString().split('T')[0];
          
          try {
            const prevRateResponse = await this.request('POST', 'SBOBobService_GetCurrencyRate', {
              Currency: 'USD',
              Date: prevDateStr
            });
            
            if (prevRateResponse && prevRateResponse > 0) {
              lastValidRate = {
                Rate: prevRateResponse,
                Date: prevDateStr
              };
              
              this.logger.info('TRM encontrada en fecha anterior', {
                originalDate: dateStr,
                trmDate: prevDateStr,
                rate: prevRateResponse,
                daysBack: i
              });
              
              // Intentar actualizar la TRM para la fecha actual usando SetCurrencyRate
              try {
                await this.request('POST', 'SBOBobService_SetCurrencyRate', {
                  Currency: 'USD',
                  Rate: prevRateResponse,
                  RateDate: dateStr
                });
                
                wasUpdated = true;
                currentTRM = {
                  Rate: prevRateResponse,
                  Date: dateStr
                };
                
                this.logger.info('TRM actualizada exitosamente para la fecha actual', {
                  date: dateStr,
                  rate: prevRateResponse,
                  basedOnDate: prevDateStr
                });
              } catch (updateError) {
                // Si no se puede actualizar, usar la tasa encontrada
                this.logger.warn('No se pudo actualizar TRM en SAP, usando tasa anterior', {
                  error: updateError.message,
                  usingDate: prevDateStr,
                  rate: prevRateResponse
                });
                currentTRM = lastValidRate;
              }
              
              foundRate = true;
              break;
            }
          } catch (prevError) {
            this.logger.debug(`No hay TRM para ${prevDateStr}, continuando búsqueda`);
            continue;
          }
        }
        
        if (!foundRate) {
          // Si no encontramos ninguna tasa en los últimos 7 días, error crítico
          this.logger.error('No se encontró TRM en los últimos 7 días');
          throw new Error('No se encontró TRM válida en los últimos 7 días');
        }
      }
      
      return {
        success: true,
        rate: currentTRM.Rate,
        date: currentTRM.Date,
        wasUpdated: wasUpdated
      };
      
    } catch (error) {
      this.logger.error('Error al validar/actualizar TRM', {
        error: error.message,
        stack: error.stack
      });
      
      // En caso de error crítico, no interrumpir el flujo pero registrar
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Exportar instancia única (singleton)
const sapOrderService = new SapOrderService();
module.exports = sapOrderService;