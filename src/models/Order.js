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
  static async createOrder(user_id, total_amount, details) {
    if (!details || details.length === 0) {
      logger.warn('Intento de crear orden sin detalles', { user_id });
      throw new Error("No se puede insertar una orden sin detalles.");
    }

    const client = await pool.connect();
    try {
      logger.debug('Iniciando transacción para crear orden', { user_id, total_amount, detailsCount: details.length });
      await client.query('BEGIN');

      // Insertar en Orders
      const orderQuery = `
        INSERT INTO Orders (user_id, total_amount)
        VALUES ($1, $2)
        RETURNING order_id;
      `;
      const orderResult = await client.query(orderQuery, [user_id, total_amount]);
      const order_id = orderResult.rows[0].order_id;

      logger.debug('Orden creada, insertando detalles', { order_id, detailsCount: details.length });

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
      
      logger.info('Orden creada exitosamente', { order_id, user_id, detailsCount: details.length });
      
      return {
        order_id,
        details_count: details.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error en createOrder', { error: error.message, user_id });
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
}

module.exports = Order;