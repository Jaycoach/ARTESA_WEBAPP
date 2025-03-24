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
            await client.query(
              'UPDATE orders SET status_id = $1, updated_at = CURRENT_TIMESTAMP, sap_last_sync = CURRENT_TIMESTAMP WHERE order_id = $2',
              [webAppStatusId, order.order_id]
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
  
      // Obtener órdenes sincronizadas con SAP que estén en estado "En Producción" (3)
      const query = `
        SELECT order_id, sap_doc_entry, status_id
        FROM orders
        WHERE sap_synced = true 
        AND sap_doc_entry IS NOT NULL
        AND status_id = 3  -- En Producción
        ORDER BY updated_at ASC
      `;
      
      const { rows } = await pool.query(query);
      stats.total = rows.length;
      
      if (rows.length === 0) {
        this.logger.info('No se encontraron órdenes para verificar entrega');
        return stats;
      }
      
      this.logger.info(`Encontradas ${rows.length} órdenes para verificar entrega`);
      
      // Consultar la vista de órdenes entregadas en SAP
      const viewEndpoint = 'view.svc/B1_DeliveredOrdersB1SLQuery';
      
      try {
        const deliveredOrdersData = await this.request('GET', viewEndpoint);
        
        this.logger.debug('Respuesta de vista de órdenes entregadas', {
          endpoint: viewEndpoint,
          responseSize: deliveredOrdersData ? 
            (deliveredOrdersData.value ? deliveredOrdersData.value.length : 'sin valor') : 
            'respuesta vacía'
        });
        
        if (!deliveredOrdersData || !deliveredOrdersData.value) {
          this.logger.warn('Respuesta inesperada de la vista de órdenes entregadas', {
            hasData: !!deliveredOrdersData,
            hasValue: deliveredOrdersData ? !!deliveredOrdersData.value : false
          });
          return {
            ...stats,
            error: 'Respuesta inesperada de SAP'
          };
        }
        
        // Crear un conjunto con los DocEntry de las órdenes entregadas en SAP
        const deliveredDocEntries = new Set();
        deliveredOrdersData.value.forEach(order => {
          if (order.DocEntry && order.Entregado === 1) {
            deliveredDocEntries.add(parseInt(order.DocEntry));
          }
        });
        
        this.logger.info(`Se encontraron ${deliveredDocEntries.size} órdenes entregadas en SAP`);
        
        // Verificar cada orden de nuestra BD contra el conjunto de órdenes entregadas
        for (const order of rows) {
          try {
            const sapDocEntry = parseInt(order.sap_doc_entry);
            
            if (deliveredDocEntries.has(sapDocEntry)) {
              // Actualizar estado a "Entregado" (4)
              await pool.query(
                `UPDATE orders 
                SET status_id = 4, 
                    last_status_update = CURRENT_TIMESTAMP, 
                    updated_at = CURRENT_TIMESTAMP, 
                    sap_last_sync = CURRENT_TIMESTAMP 
                WHERE order_id = $1`,
                [order.order_id]
              );
              
              stats.updated++;
              this.logger.info('Orden marcada como entregada desde SAP', {
                orderId: order.order_id,
                docEntry: order.sap_doc_entry
              });
            } else {
              stats.unchanged++;
              this.logger.debug('Orden no encontrada en lista de entregadas', {
                orderId: order.order_id,
                docEntry: order.sap_doc_entry
              });
            }
          } catch (orderError) {
            stats.errors++;
            this.logger.error('Error al procesar orden para verificar entrega', {
              orderId: order.order_id,
              docEntry: order.sap_doc_entry,
              error: orderError.message
            });
          }
        }
      } catch (viewError) {
        this.logger.error('Error al consultar vista de órdenes entregadas en SAP', {
          endpoint: viewEndpoint,
          error: viewError.message,
          stack: viewError.stack
        });
        throw viewError;
      }
      
      this.logger.info('Verificación de órdenes entregadas completada', {
        total: stats.total,
        updated: stats.updated,
        unchanged: stats.unchanged,
        errors: stats.errors
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

      // Consultar vista personalizada para órdenes con entregas
      const endpoint = 'view.svc/B1_DeliveredOrdersB1SLQuery';
      const deliveryData = await this.request('GET', endpoint);
      
      if (!deliveryData || !deliveryData.value || !Array.isArray(deliveryData.value)) {
        this.logger.warn('No se obtuvo respuesta válida de la vista de entregas');
        return stats;
      }

      this.logger.info(`Recuperadas ${deliveryData.value.length} órdenes con información de entrega`);
      stats.total = deliveryData.value.length;

      // Procesar cada registro de entrega
      for (const deliveryRecord of deliveryData.value) {
        try {
          // Buscar orden en base de datos por DocEntry de SAP
          const { rows } = await pool.query(
            'SELECT order_id, status_id, delivered_quantity, total_quantity FROM orders WHERE sap_doc_entry = $1',
            [deliveryRecord.OrderDocEntry]
          );

          if (rows.length === 0) {
            this.logger.warn('Orden no encontrada en base de datos local', { 
              sapDocEntry: deliveryRecord.OrderDocEntry, 
              sapDocNum: deliveryRecord.OrderDocNum 
            });
            continue;
          }

          const order = rows[0];
          const currentStatus = order.status_id;
          
          // Determinar nuevo estado basado en el DeliveryStatus
          let newStatusId;
          if (deliveryRecord.DeliveryStatus === 'Completa') {
            newStatusId = 4; // Entregado completo
          } else if (deliveryRecord.DeliveryStatus === 'Parcial') {
            newStatusId = 7; // Entregado parcial
          } else {
            // No cambiar estado si no hay entrega o está cancelada
            newStatusId = currentStatus;
          }

          // Si hay cambio de estado o cantidades, actualizar
          if (newStatusId !== currentStatus || 
              order.delivered_quantity !== deliveryRecord.TotalOrderedQuantity - deliveryRecord.RemainingOpenQuantity ||
              order.total_quantity !== deliveryRecord.TotalOrderedQuantity) {
            
            await pool.query(
              `UPDATE orders 
              SET status_id = $1, 
                  delivered_quantity = $2,
                  total_quantity = $3,
                  last_status_update = CURRENT_TIMESTAMP, 
                  updated_at = CURRENT_TIMESTAMP
              WHERE order_id = $4`,
              [
                newStatusId, 
                deliveryRecord.TotalOrderedQuantity - deliveryRecord.RemainingOpenQuantity,
                deliveryRecord.TotalOrderedQuantity,
                order.order_id
              ]
            );
            
            stats.updated++;
            this.logger.info('Orden actualizada con información de entrega', {
              orderId: order.order_id,
              sapDocEntry: deliveryRecord.OrderDocEntry,
              oldStatus: currentStatus,
              newStatus: newStatusId,
              deliveryStatus: deliveryRecord.DeliveryStatus,
              deliveredQty: deliveryRecord.TotalOrderedQuantity - deliveryRecord.RemainingOpenQuantity,
              totalQty: deliveryRecord.TotalOrderedQuantity
            });
          } else {
            stats.unchanged++;
          }
        } catch (orderError) {
          stats.errors++;
          this.logger.error('Error al procesar información de entrega para orden', {
            sapDocEntry: deliveryRecord.OrderDocEntry,
            error: orderError.message,
            stack: orderError.stack
          });
        }
      }
      
      this.logger.info('Verificación de órdenes con entregas parciales completada', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error en verificación de órdenes con entregas parciales', {
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

      // Consultar vista personalizada para órdenes facturadas
      const endpoint = 'view.svc/B1_InvoicedOrdersB1SLQuery';
      const invoiceData = await this.request('GET', endpoint);
      
      if (!invoiceData || !invoiceData.value || !Array.isArray(invoiceData.value)) {
        this.logger.warn('No se obtuvo respuesta válida de la vista de facturas');
        return stats;
      }

      this.logger.info(`Recuperadas ${invoiceData.value.length} órdenes con información de factura`);
      stats.total = invoiceData.value.length;

      // Procesar cada registro de factura
      for (const invoiceRecord of invoiceData.value) {
        try {
          // Convertir la fecha de factura a formato ISO
          const invoiceDate = new Date(invoiceRecord.InvoiceDate);
          
          // Buscar orden en base de datos por DocEntry de SAP
          const { rows } = await pool.query(
            'SELECT order_id, status_id, invoice_doc_entry FROM orders WHERE sap_doc_entry = $1',
            [invoiceRecord.OrderDocEntry]
          );

          if (rows.length === 0) {
            this.logger.warn('Orden no encontrada en base de datos local', { 
              sapDocEntry: invoiceRecord.OrderDocEntry, 
              sapDocNum: invoiceRecord.OrderDocNum 
            });
            continue;
          }

          const order = rows[0];
          
          // Si es la misma factura que ya teníamos registrada, no hay cambios
          if (order.invoice_doc_entry === invoiceRecord.InvoiceDocEntry) {
            stats.unchanged++;
            continue;
          }
          
          // Actualizar información de factura y cambiar estado a "Facturado" (8)
          await pool.query(
            `UPDATE orders 
            SET status_id = 8, 
                invoice_doc_entry = $1,
                invoice_doc_num = $2,
                invoice_date = $3,
                invoice_total = $4,
                invoice_url = $5,
                last_status_update = CURRENT_TIMESTAMP, 
                updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $6`,
            [
              invoiceRecord.InvoiceDocEntry,
              invoiceRecord.InvoiceDocNum,
              invoiceDate,
              invoiceRecord.InvoiceTotal,
              invoiceRecord.InvoicePdfUrl || null,
              order.order_id
            ]
          );
          
          stats.updated++;
          this.logger.info('Orden actualizada con información de factura', {
            orderId: order.order_id,
            sapDocEntry: invoiceRecord.OrderDocEntry,
            oldStatus: order.status_id,
            newStatus: 8, // Facturado
            invoiceDocEntry: invoiceRecord.InvoiceDocEntry,
            invoiceDocNum: invoiceRecord.InvoiceDocNum,
            invoiceDate: invoiceDate
          });
        } catch (orderError) {
          stats.errors++;
          this.logger.error('Error al procesar información de factura para orden', {
            sapDocEntry: invoiceRecord.OrderDocEntry,
            error: orderError.message,
            stack: orderError.stack
          });
        }
      }
      
      this.logger.info('Verificación de órdenes facturadas completada', stats);
      return stats;
    } catch (error) {
      this.logger.error('Error en verificación de órdenes facturadas', {
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