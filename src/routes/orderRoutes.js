const express = require('express');
const pool = require('../config/db');
const Order = require('../models/Order');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/security');
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
  getOrdersByDeliveryDate,
  syncOrdersToSap,          
  updateOrderStatusFromSap, 
  sendOrderToSap,
  checkUserCanCreateOrders,
  checkDeliveredOrders,
  checkInvoicedOrders,
  getInvoicesByUser,
  getTopSellingProducts,
  getMonthlyStats,
  debugUserOrders    
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
 * Sincronizar manualmente órdenes con SAP
 * @route POST /orders/sync-to-sap
 * @group Orders - Operaciones relacionadas con órdenes
 * @security bearerAuth
 * @returns {object} 200 - Sincronización iniciada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para realizar esta acción
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/orders/sync-to-sap', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  syncOrdersToSap
);

/**
 * Actualizar estados de órdenes desde SAP
 * @route POST /orders/update-status-from-sap
 * @group Orders - Operaciones relacionadas con órdenes
 * @security bearerAuth
 * @returns {object} 200 - Actualización iniciada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para realizar esta acción
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/orders/update-status-from-sap', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  updateOrderStatusFromSap
);

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
router.get('/orders/can-create/:userId', verifyToken, checkUserCanCreateOrders);

/**
 * Obtener facturas sincronizadas
 * @route GET /orders/invoices
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {integer} userId.query - Filtrar facturas por ID de usuario (opcional)
 * @param {string} startDate.query - Fecha inicial para filtrar (formato YYYY-MM-DD)
 * @param {string} endDate.query - Fecha final para filtrar (formato YYYY-MM-DD)
 * @security bearerAuth
 * @returns {object} 200 - Lista de facturas recuperada exitosamente
 * @returns {object} 400 - Formato de fechas inválido
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/orders/invoices', verifyToken, getInvoicesByUser);

/**
 * Obtener productos más vendidos
 * @route GET /orders/top-products
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {integer} limit.query - Número máximo de productos a retornar (por defecto 5)
 * @param {string} startDate.query - Fecha de inicio del período (formato YYYY-MM-DD)
 * @param {string} endDate.query - Fecha de fin del período (formato YYYY-MM-DD)
 * @param {integer} userId.query - ID del usuario para filtrar (opcional)
 * @security bearerAuth
 * @returns {object} 200 - Lista de productos más vendidos recuperada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para ver datos de otro usuario
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/orders/top-products', verifyToken, getTopSellingProducts);

/**
 * Obtener estadísticas mensuales de pedidos
 * @route GET /orders/monthly-stats
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {integer} userId.query.required - ID del usuario para filtrar pedidos
 * @param {integer} months.query - Número de meses hacia atrás para obtener datos (por defecto 6)
 * @security bearerAuth
 * @returns {object} 200 - Estadísticas mensuales recuperadas exitosamente
 * @returns {object} 400 - Parámetros inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para ver estas estadísticas
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/orders/monthly-stats', verifyToken, getMonthlyStats);

/**
 * Ejecutar diagnóstico SQL directo para órdenes de usuario
 * @route GET /orders/debug/{userId}
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} userId.path.required - ID del usuario para diagnóstico
 * @security bearerAuth
 * @returns {object} 200 - Resultados de diagnóstico obtenidos exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - Solo administradores pueden usar esta función
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/orders/debug/:userId', verifyToken, checkRole([1]), debugUserOrders);

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
 * Obtener precios de productos con IVA
 * @route POST /orders/prices
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {object} request.body.required - Códigos de productos
 * @security bearerAuth
 * @returns {object} 200 - Precios obtenidos exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
// Obtener precios con IVA para productos específicos
router.post('/prices', verifyToken, sanitizeBody, orderController.getProductPricesWithTax);

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
 * Enviar una orden específica a SAP
 * @route POST /orders/{orderId}/send-to-sap
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {number} orderId.path.required - ID de la orden a enviar a SAP
 * @security bearerAuth
 * @returns {object} 200 - Orden enviada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para realizar esta acción
 * @returns {object} 404 - Orden no encontrada
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/orders/:orderId/send-to-sap', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  sendOrderToSap
);

/**
 * Verificar órdenes entregadas desde SAP
 * @route POST /orders/check-delivered
 * @group Orders - Operaciones relacionadas con órdenes
 * @security bearerAuth
 * @returns {object} 200 - Verificación iniciada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para realizar esta acción
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/orders/check-delivered', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  checkDeliveredOrders
);

/**
 * Verificar órdenes facturadas desde SAP
 * @route POST /orders/check-invoiced
 * @group Orders - Operaciones relacionadas con órdenes
 * @security bearerAuth
 * @returns {object} 200 - Verificación iniciada exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/orders/check-invoiced', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  checkInvoicedOrders
);

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

module.exports = router;