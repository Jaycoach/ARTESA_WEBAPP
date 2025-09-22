/**
 * @typedef {Object} OrderDetail
 * @property {number} product_id - ID del producto
 * @property {number} quantity - Cantidad del producto
 * @property {number} unit_price - Precio unitario del producto
 */

/**
 * @typedef {Object} OrderResponse
 * @property {number} order_id - ID de la orden creada
 * @property {number} details_count - Cantidad de detalles en la orden
 */

const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('OrderModel');

/**
 * Clase que representa el modelo de Órdenes
 * @class Order
 */
class Order {
  /**
   * Obtiene el último ID de orden generado
   * @async
   * @returns {Promise<number>} - Último ID de orden generado
   */
  static async getLastOrderId() {
    try {
      const query = 'SELECT last_value FROM orders_order_id_seq';
      const result = await pool.query(query);
      logger.debug('Obtenido último ID de orden', { lastId: result.rows[0].last_value });
      return result.rows[0].last_value;
    } catch (error) {
      logger.error('Error al obtener último ID de orden', { error: error.message });
      throw error;
    }
  }

  /**
   * Crea una nueva orden con sus detalles
   * @async
   * @param {number} user_id - ID del usuario que realiza la orden
   * @param {number} total_amount - Monto total de la orden
   * @param {Array<OrderDetail>} details - Detalles de la orden
   * @returns {Promise<OrderResponse>} - Información de la orden creada
   * @throws {Error} Si no hay detalles o ocurre un error en la transacción
   */
  /**
   * Crea una nueva orden con sus detalles
   * @async
   * @param {number} user_id - ID del usuario que realiza la orden
   * @param {number} total_amount - Monto total de la orden
   * @param {Array<OrderDetail>} details - Detalles de la orden
   * @param {Date} [delivery_date=null] - Fecha de entrega programada
   * @param {number} [status_id=1] - Estado inicial de la orden (por defecto: Abierto)
   * @param {number} [branch_id=null] - ID de la sucursal para entrega
   * @returns {Promise<OrderResponse>} - Información de la orden creada
   * @throws {Error} Si no hay detalles o ocurre un error en la transacción
   */
  static async createOrder(user_id, total_amount, details, delivery_date = null, status_id = 1, branch_id = null, comments = null, attachment_url = null) {
    if (!details || details.length === 0) {
      logger.warn('Intento de crear orden sin detalles', { user_id });
      throw new Error("No se puede insertar una orden sin detalles.");
    }

    // Verificar que el usuario tenga un perfil de cliente con código SAP
    try {
      const profileCheck = await pool.query(
        `SELECT cp.cardcode_sap 
        FROM client_profiles cp
        WHERE cp.user_id = $1`,
        [user_id]
      );
      
      if (profileCheck.rows.length === 0 || !profileCheck.rows[0].cardcode_sap) {
        logger.warn('Intento de crear orden para usuario sin perfil de cliente o sin código SAP', { user_id });
        throw new Error("El usuario necesita un perfil de cliente completo con código SAP asignado.");
      }
      
      logger.debug('Usuario tiene perfil con código SAP', { 
        user_id, 
        cardcode_sap: profileCheck.rows[0].cardcode_sap 
      });
    } catch (profileError) {
      if (profileError.message.includes("perfil de cliente")) {
        throw profileError;
      }
      logger.error('Error al verificar perfil de cliente', { 
        error: profileError.message, 
        user_id
      });
      throw new Error("Error al verificar el perfil del cliente.");
    }

    // ✅ VALIDACIÓN OBLIGATORIA DE SUCURSAL
    if (branch_id === null || branch_id === undefined) {
      logger.warn('Intento de crear orden sin sucursal especificada', { user_id });
      throw new Error("Toda orden debe estar asociada a una sucursal específica.");
    }

    // Validar sucursal si se proporciona
    if (branch_id !== null && branch_id !== undefined) {
      try {
        const branchCheck = await pool.query(
          `SELECT cb.branch_id, cb.ship_to_code, cb.branch_name
          FROM client_branches cb
          JOIN client_profiles cp ON cb.client_id = cp.client_id
          WHERE cb.branch_id = $1 AND cp.user_id = $2`,
          [branch_id, user_id]
        );
        
        if (branchCheck.rows.length === 0) {
          logger.warn('Intento de crear orden con sucursal inválida', { 
            user_id, 
            branch_id 
          });
          throw new Error("La sucursal especificada no pertenece al usuario o no existe.");
        }
        
        logger.debug('Sucursal validada para orden', {
          user_id,
          branch_id,
          ship_to_code: branchCheck.rows[0].ship_to_code,
          branch_name: branchCheck.rows[0].branch_name
        });
      } catch (branchError) {
        if (branchError.message.includes("sucursal")) {
          throw branchError;
        }
        logger.error('Error al verificar sucursal', { 
          error: branchError.message, 
          user_id,
          branch_id
        });
        throw new Error("Error al verificar la sucursal.");
      }
    }

    const client = await pool.connect();
    // Calcular totales con IVA
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedTotal = 0;

    details.forEach(detail => {
      const itemSubtotal = parseFloat(detail.unit_price) * parseInt(detail.quantity);
      const itemTax = itemSubtotal * 0.19; // 19% IVA
      
      calculatedSubtotal += itemSubtotal;
      calculatedTax += itemTax;
    });

    calculatedTotal = calculatedSubtotal + calculatedTax;

    logger.debug('Totales calculados con IVA', {
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      total: calculatedTotal,
      providedTotal: total_amount
    });
    try {
      logger.debug('Iniciando transacción para crear orden', { 
        user_id, 
        total_amount, 
        detailsCount: details.length,
        delivery_date,
        status_id,
        branch_id
      });
      
      await client.query('BEGIN');

      // Crear la orden principal con valores calculados
      const orderQuery = `
        INSERT INTO orders (user_id, total_amount, subtotal, tax_amount, delivery_date, status_id, branch_id, comments, attachment_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING order_id;
      `;

      const orderResult = await client.query(orderQuery, [
        user_id, 
        calculatedTotal, 
        calculatedSubtotal, 
        calculatedTax, 
        delivery_date, 
        status_id, 
        branch_id,
        comments,
        attachment_url
      ]);
      const order_id = orderResult.rows[0].order_id;

      logger.debug('Orden creada, insertando detalles', { 
        order_id, 
        detailsCount: details.length 
      });

      // Insertar múltiples detalles en una sola consulta
      const detailValues = details.map((detail, index) => {
        const offset = index * 4;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      }).join(', ');

      const detailParams = details.flatMap(detail => [
        order_id,
        detail.product_id,
        detail.quantity,
        detail.unit_price
      ]);

      const detailQuery = `
        INSERT INTO Order_Details (order_id, product_id, quantity, unit_price)
        VALUES ${detailValues};
      `;

      await client.query(detailQuery, detailParams);
      
      await client.query('COMMIT');
      
      logger.info('Orden creada exitosamente', { 
        order_id, 
        user_id, 
        detailsCount: details.length,
        delivery_date,
        status_id,
        branch_id
      });
      
      return {
        order_id,
        details_count: details.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error en createOrder', { 
        error: error.message, 
        user_id, 
        stack: error.stack 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
 * Método de conveniencia para crear órdenes con la nueva interfaz
 * @param {Object} orderData - Datos de la orden
 * @returns {Promise<Object>} - Orden creada
 */
static async create(orderData) {
  const {
    user_id,
    branch_id = null,
    delivery_date = null,
    comments = null,
    products = []
  } = orderData;

  // Actualizar el query de inserción para incluir comments
  const insertQuery = `
    INSERT INTO Orders (user_id, branch_id, delivery_date, comments, subtotal, tax_amount, total_amount, status_id, order_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 1, CURRENT_TIMESTAMP)
    RETURNING order_id;
  `;

  const insertParams = [user_id, branch_id, delivery_date, comments, subtotal, tax_amount, total_amount];

  // Validar productos
  if (!products || products.length === 0) {
    throw new Error('Debe especificar al menos un producto');
  }

  // Validar cada producto
  products.forEach((product, index) => {
    if (!product.product_id) {
      throw new Error(`Producto ${index + 1}: ID de producto requerido`);
    }
    if (!product.quantity || parseInt(product.quantity) <= 0) {
      throw new Error(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
    }
    if (!product.unit_price || parseFloat(product.unit_price) <= 0) {
      throw new Error(`Producto ${index + 1}: Precio unitario debe ser mayor a 0`);
    }
  });

  // Calcular el total de los productos
  let totalAmount = 0;
  const details = products.map(product => {
    const quantity = parseInt(product.quantity);
    const unitPrice = parseFloat(product.unit_price);
    const lineTotal = unitPrice * quantity;
    totalAmount += lineTotal;
    
    return {
      product_id: product.product_id,
      quantity: quantity,
      unit_price: unitPrice
    };
  });

  // Validar que el total sea positivo
  if (totalAmount <= 0) {
    throw new Error('El total de la orden debe ser mayor a 0');
  }

  // Crear la orden usando el método existente
  const result = await this.createOrder(
    user_id,
    totalAmount,
    details,
    delivery_date,
    1, // status_id por defecto (Abierto)
    branch_id,
    comments
  );

  // Obtener la orden completa con detalles
  const fullOrder = await this.getOrderWithDetails(result.order_id);

  return {
    order_id: result.order_id,
    total_amount: fullOrder.total_amount,
    subtotal: fullOrder.subtotal,
    tax_amount: fullOrder.tax_amount,
    delivery_date: fullOrder.delivery_date,
    status_id: fullOrder.status_id,
    branch_id: fullOrder.branch_id,
    user_id: fullOrder.user_id,
    order_date: fullOrder.order_date,
    details_count: result.details_count
  };
}
  
  /**
   * Obtiene una orden por su ID
   * @async
   * @param {number} order_id - ID de la orden
   * @returns {Promise<Object>} - Información de la orden
   */
  static async getOrderById(order_id) {
    try {
      const query = `
        SELECT o.*, u.name as user_name 
        FROM Orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.order_id = $1
      `;
      
      const { rows } = await pool.query(query, [order_id]);
      
      if (rows.length === 0) {
        logger.warn('Orden no encontrada', { order_id });
        return null;
      }
      
      // Obtener detalles
      const detailsQuery = `
        SELECT od.*, p.name as product_name 
        FROM Order_Details od
        JOIN Products p ON od.product_id = p.product_id
        WHERE od.order_id = $1
      `;
      
      const detailsResult = await pool.query(detailsQuery, [order_id]);
      
      const order = {
        ...rows[0],
        details: detailsResult.rows
      };
      
      logger.debug('Orden obtenida correctamente', { order_id });
      return order;
    } catch (error) {
      logger.error('Error al obtener orden por ID', { error: error.message, order_id });
      throw error;
    }
  }
  /**
   * Obtiene una orden con todos sus detalles
   * @async
   * @param {number} orderId - ID de la orden
   * @returns {Promise<Object|null>} - Orden con sus detalles o null si no existe
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getOrderWithDetails(orderId) {
    try {
      logger.debug('Obteniendo orden con detalles', { orderId });
      
      // Obtener información básica de la orden
      const orderQuery = `
      SELECT o.*, u.name as user_name,
            o.delivered_quantity, o.total_quantity,
            o.invoice_doc_entry, o.invoice_doc_num,
            o.invoice_date, o.invoice_total, o.invoice_url,
            o.comments,
            o.attachment_url,
            cb.ship_to_code, cb.branch_name, cb.address as branch_address,
            cb.city as branch_city, cb.phone as branch_phone
      FROM Orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN client_branches cb ON o.branch_id = cb.branch_id
      WHERE o.order_id = $1
    `;
      
      const { rows } = await pool.query(orderQuery, [orderId]);
      
      if (rows.length === 0) {
        logger.warn('Orden no encontrada', { orderId });
        return null;
      }
      
      // Obtener detalles de la orden
      const detailsQuery = `
        SELECT od.*, p.name as product_name, p.image_url 
        FROM Order_Details od
        JOIN Products p ON od.product_id = p.product_id
        WHERE od.order_id = $1
      `;
      
      const detailsResult = await pool.query(detailsQuery, [orderId]);
      
      // Construir objeto completo de orden con detalles
      const order = {
        ...rows[0],
        details: detailsResult.rows
      };
      
      logger.info('Orden con detalles obtenida exitosamente', { 
        orderId, 
        detailsCount: detailsResult.rows.length 
      });
      
      return order;
    } catch (error) {
      logger.error('Error al obtener orden con detalles', { 
        error: error.message,
        orderId,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Obtiene todas las órdenes de un usuario específico
   * @async
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array<Object>>} - Lista de órdenes del usuario
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getUserOrders(userId) {
    try {
      logger.debug('Obteniendo órdenes del usuario', { userId });
      
      const query = `
        SELECT o.*, 
              COUNT(od.order_detail_id) as item_count, 
              SUM(od.quantity) as total_items,
              cb.branch_name,
              cb.branch_id,
              cb.address as branch_address,
              cb.city as branch_city
        FROM Orders o
        LEFT JOIN Order_Details od ON o.order_id = od.order_id
        LEFT JOIN client_branches cb ON o.branch_id = cb.branch_id
        WHERE o.user_id = $1
        GROUP BY o.order_id, cb.branch_name, cb.branch_id, cb.address, cb.city
        ORDER BY cb.branch_name ASC, o.order_date DESC
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      // Log detallado de los datos recuperados para diagnóstico
      logger.debug('Datos de órdenes recuperados', {
        userId,
        sampleData: rows.length > 0 ? JSON.stringify(rows[0]) : 'No data',
        rowCount: rows.length
      });
      
      // Procesar tipos de datos
      const processedOrders = this.processOrderTypes(rows);
      
      logger.info('Órdenes de usuario recuperadas', { userId, count: processedOrders.length });
      return processedOrders;
    } catch (error) {
      logger.error('Error al obtener órdenes del usuario', { 
        error: error.message,
        userId,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Actualiza una orden existente
   * @async
   * @param {number} orderId - ID de la orden a actualizar
   * @param {Object} updateData - Datos para actualizar la orden
   * @param {number} updateData.status_id - ID del nuevo estado
   * @param {Date} updateData.delivery_date - Nueva fecha de entrega
   * @param {number} updateData.total_amount - Nuevo monto total
   * @returns {Promise<Object|null>} - Orden actualizada o null si no existe
   * @throws {Error} Si ocurre un error en la actualización
   */
  static async updateOrder(orderId, updateData) {
    const client = await pool.connect();
    try {
      logger.debug('Iniciando actualización de orden', { 
        orderId,
        updateData
      });
      
      await client.query('BEGIN');
      
      // Primero verificamos si la orden existe
      const checkQuery = 'SELECT order_id, status_id FROM orders WHERE order_id = $1';
      const checkResult = await client.query(checkQuery, [orderId]);
      
      if (checkResult.rows.length === 0) {
        logger.warn('Orden no encontrada para actualización', { orderId });
        await client.query('ROLLBACK');
        return null;
      }
      
      const currentOrder = checkResult.rows[0];
      
      // Verificar si la orden está en un estado que permite modificación
      const nonModifiableStates = [4, 5, 6]; // Entregado, Cerrado, Cancelado
      if (nonModifiableStates.includes(currentOrder.status_id)) {
        logger.warn('Intento de modificar orden en estado no modificable', { 
          orderId, 
          currentStatus: currentOrder.status_id 
        });
        throw new Error('No se puede modificar una orden en estado Entregado, Cerrado o Cancelado');
      }
      
      // Construir query de actualización
      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;
      
      // Actualizar solo los campos proporcionados
      if (updateData.status_id !== undefined) {
        updateFields.push(`status_id = $${paramIndex}`);
        queryParams.push(updateData.status_id);
        paramIndex++;
        
        // Actualizar timestamp de cambio de estado
        updateFields.push(`last_status_update = CURRENT_TIMESTAMP`);
      }
      
      if (updateData.delivery_date !== undefined) {
        updateFields.push(`delivery_date = $${paramIndex}`);
        queryParams.push(updateData.delivery_date);
        paramIndex++;
      }
      
      if (updateData.comments !== undefined) {
        updateFields.push(`comments = $${paramIndex}`);
        queryParams.push(updateData.comments);
        paramIndex++;
      }
      
      // Siempre actualizar el timestamp
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Si hay datos de entrega parcial, agregar a los campos a actualizar
      if (updateData.delivered_quantity !== undefined) {
        updateFields.push(`delivered_quantity = $${paramIndex}`);
        queryParams.push(updateData.delivered_quantity);
        paramIndex++;
      }

      if (updateData.total_quantity !== undefined) {
        updateFields.push(`total_quantity = $${paramIndex}`);
        queryParams.push(updateData.total_quantity);
        paramIndex++;
      }

      // Si hay datos de factura, agregar a los campos a actualizar
      if (updateData.invoice_doc_entry !== undefined) {
        updateFields.push(`invoice_doc_entry = $${paramIndex}`);
        queryParams.push(updateData.invoice_doc_entry);
        paramIndex++;
      }

      if (updateData.invoice_doc_num !== undefined) {
        updateFields.push(`invoice_doc_num = $${paramIndex}`);
        queryParams.push(updateData.invoice_doc_num);
        paramIndex++;
      }

      if (updateData.invoice_date !== undefined) {
        updateFields.push(`invoice_date = $${paramIndex}`);
        queryParams.push(updateData.invoice_date);
        paramIndex++;
      }

      if (updateData.invoice_total !== undefined) {
        updateFields.push(`invoice_total = $${paramIndex}`);
        queryParams.push(updateData.invoice_total);
        paramIndex++;
      }

      if (updateData.invoice_url !== undefined) {
        updateFields.push(`invoice_url = $${paramIndex}`);
        queryParams.push(updateData.invoice_url);
        paramIndex++;
      }
      
      // Si no hay campos para actualizar, terminamos
      if (updateFields.length === 0) {
        logger.debug('No hay campos para actualizar', { orderId });
        await client.query('COMMIT');
        return await this.getOrderWithDetails(orderId);
      }
      
      // Construir y ejecutar la query de actualización
      const updateQuery = `
        UPDATE orders 
        SET ${updateFields.join(', ')}
        WHERE order_id = $${paramIndex}
        RETURNING *
      `;
      
      queryParams.push(orderId);
      const updateResult = await client.query(updateQuery, queryParams);
      
      // Actualizar detalles de la orden si se proporcionan
      if (updateData.details && updateData.details.length > 0) {
        // Primero eliminamos los detalles existentes
        await client.query('DELETE FROM order_details WHERE order_id = $1', [orderId]);
        
        // Luego insertamos los nuevos detalles
        const detailValues = updateData.details.map((detail, index) => {
          const offset = index * 4;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        }).join(', ');

        const detailParams = updateData.details.flatMap(detail => [
          orderId,
          detail.product_id,
          detail.quantity,
          detail.unit_price
        ]);

        const detailQuery = `
          INSERT INTO order_details (order_id, product_id, quantity, unit_price)
          VALUES ${detailValues};
        `;

        await client.query(detailQuery, detailParams);
      }
      
      await client.query('COMMIT');
      
      logger.info('Orden actualizada exitosamente', { 
        orderId, 
        statusId: updateData.status_id,
        detailsUpdated: updateData.details ? true : false
      });
      
      // Devolver la orden actualizada con sus detalles
      return await this.getOrderWithDetails(orderId);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error al actualizar orden', { 
        error: error.message, 
        orderId,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calcula la fecha de entrega disponible más cercana según reglas de negocio
   * @param {Date} [orderDate=new Date()] - Fecha de creación de la orden (por defecto: fecha actual)
   * @param {string} [orderTimeLimit="18:00"] - Hora límite para pedidos del día (formato HH:MM)
   * @returns {Date} Fecha de entrega calculada
   */
  static calculateDeliveryDate(fromDate, orderTimeLimit) {
    const colombianHolidays = require('../utils/colombianHolidays');
    
    // Convertir fecha base a objeto Date si es string
    const baseDate = new Date(fromDate);
    
    // Obtener hora límite configurada
    const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
    
    // Para cálculo de entrega, siempre empezar desde el día siguiente a la fecha base
    let startDate = new Date(baseDate);
    startDate.setDate(baseDate.getDate() + 1);
    
    // Verificar si la orden fue creada después de la hora límite
    const baseHour = baseDate.getHours();
    const baseMinute = baseDate.getMinutes();
    const baseTimeInMinutes = baseHour * 60 + baseMinute;
    const limitTimeInMinutes = limitHours * 60 + limitMinutes;
    
    // Si la orden fue creada después de la hora límite, agregar un día más
    if (baseTimeInMinutes >= limitTimeInMinutes) {
      startDate.setDate(startDate.getDate() + 1);
    }
    
    // Contar 2 días hábiles desde la fecha de inicio
    let deliveryDate = new Date(startDate);
    let workingDaysAdded = 0;
    
    while (workingDaysAdded < 2) {
      // Verificar si es día hábil (no fin de semana ni festivo)
      if (colombianHolidays.isWorkingDay(deliveryDate)) {
        workingDaysAdded++;
      }
      
      // Si aún no hemos completado los 2 días hábiles, avanzar al siguiente día
      if (workingDaysAdded < 2) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
      }
    }
    
    // Asegurar que la fecha final sea un día hábil
    while (!colombianHolidays.isWorkingDay(deliveryDate)) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
    }
    
    return deliveryDate;
  }

  /**
   * Actualiza el estado de las órdenes pendientes a "En Producción" y cancela órdenes con fecha de entrega vencida
   * @async
   * @param {string} orderTimeLimit - Hora límite para pedidos (formato HH:MM)
   * @param {Object} [options] - Opciones adicionales
   * @param {boolean} [options.ignoreTimeLimit=false] - Si es true, ignora la restricción de hora límite
   * @param {boolean} [options.ignoreDeliveryDate=false] - Si es true, ignora la restricción de fecha de entrega
   * @returns {Promise<Object>} - Estadísticas de órdenes actualizadas y canceladas
   */
  static async updatePendingOrdersStatus(orderTimeLimit = "18:00", options = {}) {
    try {
      const { ignoreTimeLimit = false, ignoreDeliveryDate = false } = options;
      
      logger.debug('Actualizando órdenes pendientes y vencidas', { 
        orderTimeLimit,
        ignoreTimeLimit,
        ignoreDeliveryDate
      });
      
      // Actualizar órdenes pendientes a "En Producción"
      let pendingWhereConditions = [`status_id = 1`]; // Ordenes en estado Abierto
      
      // Agregar condición de hora límite si no se ignora
      if (!ignoreTimeLimit) {
        pendingWhereConditions.push(`TO_CHAR(NOW(), 'HH24:MI') >= $1`);
      }
      
      // Agregar condición de fecha de entrega si no se ignora
      if (!ignoreDeliveryDate) {
        pendingWhereConditions.push(`(delivery_date IS NOT NULL AND delivery_date >= CURRENT_DATE)`);
      }
      
      // Construir consulta para actualización a "En Producción"
      const pendingQuery = `
        UPDATE orders
        SET status_id = 3, -- En Producción
            last_status_update = CURRENT_TIMESTAMP
        WHERE ${pendingWhereConditions.join(' AND ')}
        RETURNING order_id
      `;
      
      // Arreglo de parámetros para la consulta de pendientes
      const pendingParams = ignoreTimeLimit ? [] : [orderTimeLimit];
      
      const pendingResult = await pool.query(pendingQuery, pendingParams);
      
      const updatedCount = pendingResult.rowCount;
      
      // Cancelar órdenes con fecha de entrega vencida
      // Solo afecta a órdenes en estado Abierto (1) o Pendiente (2)
      const cancelQuery = `
        UPDATE orders
        SET status_id = 6, -- Cancelado
            last_status_update = CURRENT_TIMESTAMP
        WHERE status_id IN (1, 2)
        AND ((delivery_date IS NOT NULL AND delivery_date < CURRENT_DATE) OR delivery_date IS NULL)
        RETURNING order_id
      `;
      
      const cancelResult = await pool.query(cancelQuery);
      
      const cancelledCount = cancelResult.rowCount;
      
      if (updatedCount > 0 || cancelledCount > 0) {
        logger.info('Actualización de estados de órdenes completada', { 
          updatedToProduction: updatedCount,
          updatedToCancelled: cancelledCount,
          updatedIds: pendingResult.rows.map(row => row.order_id),
          cancelledIds: cancelResult.rows.map(row => row.order_id),
          ignoreTimeLimit,
          ignoreDeliveryDate
        });
      } else {
        logger.debug('No hay órdenes para actualizar');
      }
      
      return {
        updatedCount,
        cancelledCount,
        updatedIds: pendingResult.rows.map(row => row.order_id),
        cancelledIds: cancelResult.rows.map(row => row.order_id)
      };
    } catch (error) {
      logger.error('Error al actualizar estado de órdenes', { 
        error: error.message, 
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Cancela una orden existente cambiando su estado a Cancelado (7)
   * @async
   * @param {number} orderId - ID de la orden a cancelar
   * @param {number} userId - ID del usuario que realiza la cancelación
   * @returns {Promise<Object|null>} - Orden cancelada o null si no existe
   * @throws {Error} Si ocurre un error en la cancelación
   */
  static async cancelOrder(orderId, userId = null, reason = null) {
    const client = await pool.connect();
    try {
      logger.debug('Cancelando orden', { orderId, userId });
      
      await client.query('BEGIN');
      
      // Primero verificamos si la orden existe y si puede ser cancelada
      const checkQuery = 'SELECT order_id, status_id, user_id FROM orders WHERE order_id = $1';
      const checkResult = await client.query(checkQuery, [orderId]);
      
      if (checkResult.rows.length === 0) {
        logger.warn('Orden no encontrada para cancelación', { orderId });
        await client.query('ROLLBACK');
        return null;
      }
      
      const currentOrder = checkResult.rows[0];
      
      // Verificar si la orden ya está en un estado final
      const finalStates = [4, 5, 6]; // Entregado, Cerrado, Cancelado
      if (finalStates.includes(currentOrder.status_id)) {
        logger.warn('Intento de cancelar orden en estado final', {
          orderId,
          currentStatus: currentOrder.status_id
        });
        throw new Error('No se puede cancelar una orden en estado Entregado, Cerrado o Cancelado');
      }
      
      // Obtener el ID del estado "Cancelado" de la base de datos
      const statusQuery = "SELECT status_id FROM order_status WHERE name = 'Cancelado'";
      const statusResult = await client.query(statusQuery);
      
      if (statusResult.rows.length === 0) {
        throw new Error('Estado "Cancelado" no encontrado en la base de datos');
      }
      
      const cancelStatusId = statusResult.rows[0].status_id;
      
      // Actualizar el estado de la orden
      const updateQuery = `
        UPDATE orders 
        SET status_id = $1,
            last_status_update = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [cancelStatusId, orderId]);
      
      // Si hay razón de cancelación, registrarla
      if (reason) {
        const reasonQuery = `
          INSERT INTO order_notes (order_id, user_id, note_type, note, created_at)
          VALUES ($1, $2, 'cancelation_reason', $3, CURRENT_TIMESTAMP)
        `;
        await client.query(reasonQuery, [orderId, userId, reason]);
      }
      
      await client.query('COMMIT');
      
      logger.info('Orden cancelada exitosamente', {
        orderId,
        userId,
        reason: reason ? true : false
      });
      
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error al cancelar orden', {
        error: error.message,
        orderId,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene órdenes por fecha de entrega y opcionalmente por estado
   * @async
   * @param {Date} deliveryDate - Fecha de entrega para filtrar
   * @param {number|null} statusId - ID del estado para filtrar (opcional)
   * @returns {Promise<Array<Object>>} - Lista de órdenes encontradas
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getOrdersByDeliveryDate(deliveryDate, statusId = null) {
    try {
      logger.debug('Obteniendo órdenes por fecha de entrega', { 
        deliveryDate, 
        statusId 
      });
      
      // Convertir la fecha a formato ISO para asegurar formato correcto
      const formattedDate = new Date(deliveryDate).toISOString().split('T')[0];
      
      // Preparar la consulta base
      let query = `
        SELECT o.*, 
              u.name as user_name, 
              os.name as status_name,
              COUNT(od.order_detail_id) as item_count, 
              SUM(od.quantity) as total_items
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN order_status os ON o.status_id = os.status_id
        LEFT JOIN order_details od ON o.order_id = od.order_id
        WHERE DATE(o.delivery_date) = $1
      `;
      
      let params = [formattedDate];
      
      // Añadir filtro de estado si se proporciona
      if (statusId !== null) {
        query += ` AND o.status_id = $2`;
        params.push(statusId);
      }
      
      // Agrupar y ordenar
      query += `
        GROUP BY o.order_id, u.name, os.name
        ORDER BY o.delivery_date, o.order_date DESC
      `;
      
      const { rows } = await pool.query(query, params);
      
      logger.info('Órdenes recuperadas por fecha de entrega', { 
        deliveryDate: formattedDate, 
        statusId, 
        count: rows.length 
      });
      
      return rows;
    } catch (error) {
      logger.error('Error al obtener órdenes por fecha de entrega', { 
        error: error.message,
        deliveryDate,
        statusId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtiene todas las órdenes por estado
   * @async
   * @param {number} statusId - ID del estado a filtrar
   * @returns {Promise<Array<Object>>} - Lista de órdenes con el estado especificado
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getOrdersByStatus(statusId) {
    try {
      logger.debug('Obteniendo órdenes por estado', { statusId });
      
      const query = `
        SELECT o.*, 
              u.name as user_name, 
              os.name as status_name,
              COUNT(od.order_detail_id) as item_count, 
              SUM(od.quantity) as total_items
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN order_status os ON o.status_id = os.status_id
        LEFT JOIN order_details od ON o.order_id = od.order_id
        WHERE o.status_id = $1
        GROUP BY o.order_id, u.name, os.name
        ORDER BY o.order_date DESC
      `;
      
      const { rows } = await pool.query(query, [statusId]);
      
      logger.info('Órdenes recuperadas por estado', { 
        statusId, 
        count: rows.length 
      });
      
      return rows;
    } catch (error) {
      logger.error('Error al obtener órdenes por estado', { 
        error: error.message,
        statusId
      });
      throw error;
    }
  }

  /**
   * Obtiene los productos más vendidos en un período de tiempo
   * @async
   * @param {Object} options - Opciones de filtrado
   * @param {number} options.limit - Número máximo de productos a retornar (por defecto 5)
   * @param {Date} options.startDate - Fecha de inicio del período
   * @param {Date} options.endDate - Fecha de fin del período
   * @param {number} options.userId - ID del usuario para filtrar (opcional)
   * @returns {Promise<Array<Object>>} - Lista de productos más vendidos
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getTopSellingProducts(options = {}) {
    try {
      const { 
        limit = 5, 
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1), 
        endDate = new Date(),
        userId = null
      } = options;
      
      logger.debug('Obteniendo productos más vendidos', { 
        limit, 
        startDate, 
        endDate,
        userId 
      });
      
      // Convertir fechas a formato ISO para la consulta
      const formattedStartDate = startDate instanceof Date ? startDate.toISOString() : startDate;
      const formattedEndDate = endDate instanceof Date ? endDate.toISOString() : endDate;
      
      // Preparar la consulta base
      let query = `
        SELECT 
          p.product_id,
          p.name AS product_name,
          SUM(od.quantity) AS quantity,
          COUNT(DISTINCT o.order_id) AS total_orders
        FROM 
          order_details od
        JOIN 
          orders o ON od.order_id = o.order_id
        JOIN 
          products p ON od.product_id = p.product_id
        WHERE 
          o.order_date BETWEEN $1 AND $2
          AND o.status_id NOT IN (6) -- Excluir órdenes canceladas
      `;
      
      const params = [formattedStartDate, formattedEndDate];
      
      // Añadir filtro por usuario si se proporciona
      if (userId) {
        query += ` AND o.user_id = $3`;
        params.push(userId);
      }
      
      // Finalizar la consulta con agrupación, ordenación y límite
      query += `
        GROUP BY 
          p.product_id, p.name
        ORDER BY 
          quantity DESC
        LIMIT $${params.length + 1}
      `;
      
      params.push(limit);
      
      const { rows } = await pool.query(query, params);
      
      logger.info('Productos más vendidos recuperados exitosamente', { 
        count: rows.length,
        period: `${formattedStartDate} a ${formattedEndDate}`,
        userId: userId ? userId : 'todos'
      });
      
      return rows;
    } catch (error) {
      logger.error('Error al obtener productos más vendidos', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
 * Obtiene estadísticas mensuales de pedidos para un usuario específico
 * @async
 * @param {number} userId - ID del usuario para filtrar pedidos
 * @param {number} months - Número de meses hacia atrás para obtener datos (por defecto 6)
 * @returns {Promise<Array<Object>>} - Array con estadísticas mensuales
 * @throws {Error} Si ocurre un error en la consulta
 */
static async getMonthlyStats(userId, months = 6) {
  try {
    logger.debug('Obteniendo estadísticas mensuales de pedidos', { 
      userId, 
      months 
    });
    
    // Generar un array con los últimos X meses (incluyendo el actual)
    const result = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Calcular fecha de inicio (primer día del mes, hace 'months' meses)
    const startDate = new Date();
    startDate.setDate(1); // Primer día del mes
    startDate.setMonth(startDate.getMonth() - (months - 1)); // Retroceder 'months-1' meses
    
    // Consulta para obtener el conteo por mes
    const query = `
      SELECT 
        DATE_TRUNC('month', order_date) as month_date,
        COUNT(*) as count
      FROM 
        orders
      WHERE 
        user_id = $1
        AND order_date >= $2
      GROUP BY 
        DATE_TRUNC('month', order_date)
      ORDER BY 
        month_date ASC
    `;
    
    const { rows } = await pool.query(query, [userId, startDate]);
    
    // Convertir los resultados a un mapa para facilitar el acceso
    const countMap = {};
    rows.forEach(row => {
      const date = new Date(row.month_date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      countMap[key] = parseInt(row.count);
    });
    
    // Generar el array con todos los meses, incluyendo los que no tienen pedidos
    const currentDate = new Date();
    
    // Crear array con todos los meses en el rango
    for (let i = 0; i < months; i++) {
      const date = new Date(startDate);
      date.setMonth(startDate.getMonth() + i);
      
      // Si la fecha calculada supera el mes actual, salir del bucle
      if (date > currentDate) {
        break;
      }
      
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;
      
      result.push({
        month: `${monthNames[month]} ${year}`,
        count: countMap[key] || 0
      });
    }
    
    logger.info('Estadísticas mensuales recuperadas exitosamente', { 
      userId,
      months,
      resultCount: result.length
    });
    
    return result;
  } catch (error) {
    logger.error('Error al obtener estadísticas mensuales', { 
      error: error.message,
      stack: error.stack,
      userId,
      months
    });
    throw error;
  }
} 

  /**
   * Obtiene todos los estados de órdenes
   * @async
   * @returns {Promise<Array<Object>>} - Lista de estados disponibles
   * @throws {Error} Si ocurre un error en la consulta
   */
  static async getOrderStatuses() {
    try {
      const query = 'SELECT * FROM order_status ORDER BY status_id';
      const { rows } = await pool.query(query);
      
      logger.debug('Estados de órdenes recuperados', { count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error al obtener estados de órdenes', { 
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Función auxiliar para procesar los tipos de datos de las órdenes
   * @param {Array<Object>} orders - Lista de órdenes recuperadas de la base de datos
   * @returns {Array<Object>} Lista de órdenes con tipos de datos corregidos
   */
  static processOrderTypes(orders) {
    return orders.map(order => {
      // Crear un objeto nuevo para no modificar el original
      const processedOrder = { ...order };
      
      // Asegurarse de que los campos numéricos sean números
      processedOrder.order_id = parseInt(order.order_id, 10);
      processedOrder.user_id = parseInt(order.user_id, 10);
      processedOrder.total_amount = order.total_amount ? order.total_amount.toString() : "0";
      processedOrder.status_id = parseInt(order.status_id, 10);
      processedOrder.sap_sync_attempts = parseInt(order.sap_sync_attempts || 0, 10);
      
      // Campos de conteo - verificar que no sean null antes de convertir
      processedOrder.item_count = order.item_count ? order.item_count.toString() : "0";
      processedOrder.total_items = order.total_items ? order.total_items.toString() : "0";
      
      // Campos de entrega
      processedOrder.delivered_quantity = order.delivered_quantity ? order.delivered_quantity.toString() : "0";
      processedOrder.total_quantity = order.total_quantity ? order.total_quantity.toString() : "0";
      
      return processedOrder;
    });
  }
  /**
   * Obtener precios de productos para un cliente específico con cálculo de IVA
   * @param {number} userId - ID del usuario/cliente
   * @param {Array<string>} productCodes - Códigos de productos a consultar
   * @returns {Promise<Array>} - Array de productos con precios e IVA
   */
  static async getProductPricesWithTax(userId, productCodes) {
    try {
      // Obtener el price_list_code del cliente
      const clientQuery = `
        SELECT cp.price_list_code 
        FROM client_profiles cp 
        WHERE cp.user_id = $1
      `;
      
      const clientResult = await pool.query(clientQuery, [userId]);
      
      if (clientResult.rows.length === 0) {
        logger.warn('Cliente no encontrado o sin price_list_code', { userId });
        return [];
      }
      
      const priceListCode = clientResult.rows[0].price_list_code || 'BRONCE'; // Valor por defecto
      
      // Obtener precios de la lista correspondiente
      const PriceList = require('./PriceList');
      const pricesData = await PriceList.getMultipleProductPrices(priceListCode, productCodes);
      
      // Calcular IVA (19%) y precio total
      const productsWithTax = pricesData.map(product => {
        const basePrice = parseFloat(product.price) || 0;
        // Determinar tipo de impuesto según configuración del producto
        const hasImpuestoSaludable = product.has_impuesto_saludable || false;
        const taxRate = hasImpuestoSaludable ? 0.10 : 0.19; // 10% saludable o 19% IVA
        const taxAmount = basePrice * taxRate;
        const totalPrice = basePrice + taxAmount;

        return {
          ...product,
          base_price: basePrice,
          tax_rate: taxRate,
          tax_type: hasImpuestoSaludable ? 'IMPUESTO_SALUDABLE' : 'IVA',
          tax_amount: parseFloat(taxAmount.toFixed(2)),
          total_price_with_tax: parseFloat(totalPrice.toFixed(2)),
          has_impuesto_saludable: hasImpuestoSaludable
        };
      });
      
      logger.debug('Precios con IVA calculados', { 
        userId, 
        priceListCode, 
        productCount: productsWithTax.length 
      });
      
      return productsWithTax;
    } catch (error) {
      logger.error('Error obteniendo precios con IVA', { 
        error: error.message, 
        userId, 
        productCodes 
      });
      throw error;
    }
  }
}

module.exports = Order;