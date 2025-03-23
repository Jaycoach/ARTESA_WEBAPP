const express = require('express');
const { verifyToken, checkRole } = require('../middleware/auth');
const { 
  createOrder, 
  getOrderById, 
  getUserOrders, 
  updateOrder, 
  getOrdersByStatus, 
  getOrderStatuses,
  calculateDeliveryDate,
  updatePendingOrders,
  cancelOrder,
  getOrdersByDeliveryDate
} = require('../controllers/orderController');

const router = express.Router();

/**
 * @typedef {object} OrderDetail
 * @property {number} product_id.required - ID del producto
 * @property {number} quantity.required - Cantidad del producto
 * @property {number} unit_price.required - Precio unitario
 */

/**
 * @typedef {object} CreateOrderRequest
 * @property {number} user_id.required - ID del usuario
 * @property {number} total_amount.required - Monto total de la orden
 * @property {Array<OrderDetail>} details.required - Detalles de la orden
 * @property {Date} delivery_date - Fecha de entrega programada
 * @property {number} status_id - ID del estado inicial (por defecto: 1 - Abierto)
 */

/**
 * @typedef {object} CreateOrderResponse
 * @property {string} message - Mensaje de éxito
 * @property {object} order_id - ID de la orden creada
 * @property {number} details_count - Cantidad de detalles en la orden
 */

/**
 * @typedef {object} UpdateOrderRequest
 * @property {number} status_id - ID del nuevo estado
 * @property {Date} delivery_date - Nueva fecha de entrega
 * @property {number} total_amount - Nuevo monto total
 * @property {Array<OrderDetail>} details - Nuevos detalles de la orden
 */

/**
 * Crear una nueva orden
 * @route POST /orders
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {CreateOrderRequest} request.body.required - Datos de la orden
 * @security bearerAuth
 * @returns {CreateOrderResponse} 201 - Orden creada exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para crear una orden
router.post('/orders', verifyToken, createOrder);

/**
 * Actualizar una orden existente
 * @route PUT /orders/{orderId}
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} orderId.path.required - ID de la orden a actualizar
 * @param {UpdateOrderRequest} request.body.required - Datos para actualizar la orden
 * @security bearerAuth
 * @returns {object} 200 - Orden actualizada exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para actualizar esta orden
 * @returns {object} 404 - Orden no encontrada
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para actualizar una orden
router.put('/orders/:orderId', verifyToken, updateOrder);

/**
 * Obtener órdenes por estado
 * @route GET /orders/status/{statusId}
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} statusId.path.required - ID del estado a filtrar
 * @security bearerAuth
 * @returns {object} 200 - Lista de órdenes recuperada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para ver estas órdenes
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para obtener órdenes por estado
router.get('/orders/status/:statusId', verifyToken, getOrdersByStatus);

/**
 * Verificar si un usuario puede crear órdenes
 * @route GET /orders/can-create/{userId}
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} userId.path.required - ID del usuario
 * @security bearerAuth
 * @returns {object} 200 - Respuesta con estado de capacidad para crear órdenes
 * @returns {object} 401 - No autorizado
 * @returns {object} 404 - Usuario no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/orders/can-create/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar si el usuario existe y está activo
    const userQuery = 'SELECT is_active FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar si tiene perfil de cliente y código SAP
    const profileQuery = 'SELECT client_id, cardcode_sap FROM client_profiles WHERE user_id = $1';
    const profileResult = await pool.query(profileQuery, [userId]);
    
    const canCreate = userResult.rows[0].is_active || 
                      (profileResult.rows.length > 0 && profileResult.rows[0].cardcode_sap);
    
    res.status(200).json({
      success: true,
      data: {
        canCreate,
        isActive: userResult.rows[0].is_active,
        hasProfile: profileResult.rows.length > 0,
        hasCardCode: profileResult.rows.length > 0 && !!profileResult.rows[0].cardcode_sap
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al verificar capacidad para crear órdenes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Obtener todos los estados de órdenes
 * @route GET /orders/statuses
 * @group Orders - Operaciones relacionadas con órdenes
 * @security bearerAuth
 * @returns {object} 200 - Lista de estados recuperada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para obtener todos los estados de órdenes
router.get('/orders/statuses', verifyToken, getOrderStatuses);

/**
 * Calcular fecha de entrega disponible
 * @route GET /orders/delivery-date
 * @group Orders - Operaciones relacionadas con órdenes
 * @security bearerAuth
 * @returns {object} 200 - Fecha de entrega calculada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para calcular fecha de entrega disponible
router.get('/orders/delivery-date', verifyToken, calculateDeliveryDate);

/**
 * Actualizar manualmente órdenes pendientes a "En Producción"
 * @route POST /orders/process-pending
 * @group Orders - Operaciones relacionadas con órdenes
 * @security bearerAuth
 * @returns {object} 200 - Órdenes actualizadas exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para realizar esta acción
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para actualizar manualmente órdenes pendientes
router.post('/orders/process-pending', verifyToken, checkRole([1]), updatePendingOrders);

/**
 * Obtener una orden específica
 * @route GET /orders/{orderId}
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} orderId.path.required - ID de la orden
 * @security bearerAuth
 * @returns {object} 200 - Orden recuperada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para ver esta orden
 * @returns {object} 404 - Orden no encontrada
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para obtener una orden específica
router.get('/orders/:orderId', verifyToken, getOrderById);

/**
 * Cancelar una orden
 * @route PUT /orders/{orderId}/cancel
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} orderId.path.required - ID de la orden a cancelar
 * @param {object} request.body - Datos para la cancelación
 * @param {string} request.body.reason - Razón de la cancelación
 * @security bearerAuth
 * @returns {object} 200 - Orden cancelada exitosamente
 * @returns {object} 400 - Datos inválidos o la orden no se puede cancelar
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para cancelar esta orden
 * @returns {object} 404 - Orden no encontrada
 * @returns {object} 500 - Error interno del servidor
 */
router.put('/orders/:orderId/cancel', verifyToken, cancelOrder);

/**
 * Obtener órdenes por fecha de entrega
 * @route GET /orders/byDeliveryDate
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {string} deliveryDate.query.required - Fecha de entrega en formato YYYY-MM-DD
 * @param {number} statusId.query - ID del estado a filtrar (opcional)
 * @security bearerAuth
 * @returns {object} 200 - Lista de órdenes recuperada exitosamente
 * @returns {object} 400 - Formato de fecha inválido
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/orders/byDeliveryDate', verifyToken, getOrdersByDeliveryDate);

/**
 * Obtener órdenes de un usuario
 * @route GET /orders/user/{userId}
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} userId.path.required - ID del usuario
 * @security bearerAuth
 * @returns {object} 200 - Órdenes recuperadas exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para ver estas órdenes
 * @returns {object} 500 - Error interno del servidor
 */
// Ruta para obtener órdenes de un usuario
router.get('/orders/user/:userId', verifyToken, getUserOrders);

module.exports = router;