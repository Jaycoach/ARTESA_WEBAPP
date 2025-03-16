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
   * @returns {Promise<OrderResponse>} - Información de la orden creada
   * @throws {Error} Si no hay detalles o ocurre un error en la transacción
   */
  static async createOrder(user_id, total_amount, details, delivery_date = null, status_id = 1) {
    if (!details || details.length === 0) {
      logger.warn('Intento de crear orden sin detalles', { user_id });
      throw new Error("No se puede insertar una orden sin detalles.");
    }

    const client = await pool.connect();
    try {
      logger.debug('Iniciando transacción para crear orden', { 
        user_id, 
        total_amount, 
        detailsCount: details.length,
        delivery_date,
        status_id
      });
      
      await client.query('BEGIN');

      // Insertar en Orders con fecha de entrega y estado
      const orderQuery = `
        INSERT INTO Orders (user_id, total_amount, delivery_date, status_id)
        VALUES ($1, $2, $3, $4)
        RETURNING order_id;
      `;
      const orderResult = await client.query(orderQuery, [
        user_id, 
        total_amount, 
        delivery_date, 
        status_id
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
        status_id
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
        SELECT o.*, u.name as user_name 
        FROM Orders o
        JOIN users u ON o.user_id = u.id
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
              SUM(od.quantity) as total_items
        FROM Orders o
        LEFT JOIN Order_Details od ON o.order_id = od.order_id
        WHERE o.user_id = $1
        GROUP BY o.order_id
        ORDER BY o.order_date DESC
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      logger.info('Órdenes de usuario recuperadas', { userId, count: rows.length });
      return rows;
    } catch (error) {
      logger.error('Error al obtener órdenes del usuario', { 
        error: error.message,
        userId
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
      
      if (updateData.total_amount !== undefined) {
        updateFields.push(`total_amount = $${paramIndex}`);
        queryParams.push(updateData.total_amount);
        paramIndex++;
      }
      
      // Siempre actualizar el timestamp
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      
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
  static calculateDeliveryDate(orderDate = new Date(), orderTimeLimit = "18:00") {
    const date = new Date(orderDate);
    const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
    
    // Verificar si ya pasó la hora límite
    const isPastTimeLimit = date.getHours() > limitHours || 
      (date.getHours() === limitHours && date.getMinutes() >= limitMinutes);
    
    // Determinar día de la semana (0 = domingo, 6 = sábado)
    const dayOfWeek = date.getDay();
    
    // Calcular días adicionales según el día de la semana y hora
    let additionalDays = 2; // Por defecto, 2 días hábiles
    
    if (dayOfWeek === 5) { // Viernes
      additionalDays = isPastTimeLimit ? 4 : 3; // Lunes o martes
    } 
    else if (dayOfWeek === 6) { // Sábado
      additionalDays = isPastTimeLimit ? 3 : 2; // Miércoles o martes
    }
    else if (dayOfWeek === 0) { // Domingo
      additionalDays = 2; // Martes
    }
    else { // Lunes a jueves
      additionalDays = isPastTimeLimit ? 3 : 2; // +3 o +2 días
    }
    
    // Añadir los días calculados
    date.setDate(date.getDate() + additionalDays);
    
    // Asegurar que no caiga en fin de semana
    const newDayOfWeek = date.getDay();
    if (newDayOfWeek === 0) { // domingo
      date.setDate(date.getDate() + 1); // mover al lunes
    } else if (newDayOfWeek === 6) { // sábado
      date.setDate(date.getDate() + 2); // mover al lunes
    }
    
    return date;
  }

  /**
   * Actualiza el estado de las órdenes pendientes a "En Producción"
   * @async
   * @param {string} orderTimeLimit - Hora límite para pedidos (formato HH:MM)
   * @param {Object} [options] - Opciones adicionales
   * @param {boolean} [options.ignoreTimeLimit=false] - Si es true, ignora la restricción de hora límite
   * @param {boolean} [options.ignoreCreationDate=false] - Si es true, ignora la restricción de fecha de creación
   * @returns {Promise<number>} - Número de órdenes actualizadas
   */
  static async updatePendingOrdersStatus(orderTimeLimit = "18:00", options = {}) {
    try {
      const { ignoreTimeLimit = false, ignoreCreationDate = false } = options;
      
      logger.debug('Actualizando órdenes pendientes a En Producción', { 
        orderTimeLimit,
        ignoreTimeLimit,
        ignoreCreationDate
      });
      
      // Construir condiciones de la consulta basadas en las opciones
      let whereConditions = [`status_id = 2`]; // Siempre filtrar por órdenes pendientes
      
      // Agregar condición de hora límite si no se ignora
      if (!ignoreTimeLimit) {
        whereConditions.push(`TO_CHAR(NOW(), 'HH24:MI') >= $1`);
      }
      
      // Agregar condición de fecha de creación si no se ignora
      if (!ignoreCreationDate) {
        whereConditions.push(`DATE(order_date) = DATE(NOW())`);
      }
      
      // Construir consulta completa
      const query = `
        UPDATE orders
        SET status_id = 3, -- En Producción
            last_status_update = CURRENT_TIMESTAMP
        WHERE ${whereConditions.join(' AND ')}
        RETURNING order_id
      `;
      
      // Arreglo de parámetros
      const params = ignoreTimeLimit ? [] : [orderTimeLimit];
      
      const result = await pool.query(query, params);
      
      const updatedCount = result.rowCount;
      
      if (updatedCount > 0) {
        logger.info('Órdenes actualizadas a estado En Producción', { 
          count: updatedCount, 
          ids: result.rows.map(row => row.order_id),
          ignoreTimeLimit,
          ignoreCreationDate
        });
      } else {
        logger.debug('No hay órdenes pendientes para actualizar');
      }
      
      return updatedCount;
    } catch (error) {
      logger.error('Error al actualizar estado de órdenes pendientes', { 
        error: error.message, 
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Elimina una orden si cumple con las condiciones permitidas
   * @async
   * @param {number} orderId - ID de la orden a eliminar
   * @param {number} userId - ID del usuario que solicita la eliminación
   * @returns {Promise<Object|null>} - Orden eliminada o null si no existe o no se puede eliminar
   * @throws {Error} Si ocurre un error en la eliminación
   */
  static async deleteOrder(orderId, userId) {
    const client = await pool.connect();
    try {
      logger.debug('Iniciando eliminación de orden', { orderId, userId });
      
      await client.query('BEGIN');
      
      // Primero verificar si la orden existe y comprobar su estado
      const orderQuery = `
        SELECT o.*, u.name as user_name 
        FROM Orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.order_id = $1
      `;
      
      const orderResult = await client.query(orderQuery, [orderId]);
      
      if (orderResult.rows.length === 0) {
        logger.warn('Orden no encontrada para eliminación', { orderId });
        await client.query('ROLLBACK');
        return null;
      }
      
      const order = orderResult.rows[0];
      
      // Verificar si el usuario es el propietario o un administrador
      if (order.user_id !== userId && userId !== 1) { // Asumiendo que rol_id 1 es ADMIN
        logger.warn('Intento de eliminación no autorizado', { orderId, userId, orderUserId: order.user_id });
        await client.query('ROLLBACK');
        throw new Error('No tiene permisos para eliminar esta orden');
      }
      
      // Verificar si la orden está en un estado que permite eliminación
      // Asumiendo que estado_id 3 es "En Producción"
      if (order.status_id === 3) {
        logger.warn('No se puede eliminar una orden en estado "En Producción"', {
          orderId,
          statusId: order.status_id
        });
        await client.query('ROLLBACK');
        throw new Error('No se puede eliminar una orden que ya está en producción');
      }
      
      // Primero eliminar los detalles de la orden
      await client.query('DELETE FROM order_details WHERE order_id = $1', [orderId]);
      
      // Luego eliminar la orden
      const deleteQuery = 'DELETE FROM orders WHERE order_id = $1 RETURNING *';
      const deleteResult = await client.query(deleteQuery, [orderId]);
      
      if (deleteResult.rows.length === 0) {
        logger.warn('Error al eliminar la orden', { orderId });
        await client.query('ROLLBACK');
        return null;
      }
      
      await client.query('COMMIT');
      
      logger.info('Orden eliminada exitosamente', { 
        orderId, 
        userId,
        statusId: order.status_id
      });
      
      return {
        ...order,
        deleted: true
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error al eliminar orden', { 
        error: error.message, 
        orderId,
        userId,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
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
}

module.exports = Order;