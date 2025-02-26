// src/controllers/orderController.js
const Order = require('../models/Order');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('OrderController');

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderDetail:
 *       type: object
 *       required:
 *         - product_id
 *         - quantity
 *         - unit_price
 *       properties:
 *         product_id:
 *           type: integer
 *           description: ID del producto
 *           example: 1
 *         quantity:
 *           type: integer
 *           description: Cantidad del producto
 *           example: 2
 *         unit_price:
 *           type: number
 *           format: float
 *           description: Precio unitario del producto
 *           example: 25.99
 *     
 *     CreateOrderRequest:
 *       type: object
 *       required:
 *         - user_id
 *         - total_amount
 *         - details
 *       properties:
 *         user_id:
 *           type: integer
 *           description: ID del usuario que realiza la orden
 *           example: 1
 *         total_amount:
 *           type: number
 *           format: float
 *           description: Monto total de la orden
 *           example: 51.98
 *         details:
 *           type: array
 *           description: Detalles de los productos en la orden
 *           items:
 *             $ref: '#/components/schemas/OrderDetail'
 *     
 *     CreateOrderResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Orden creada exitosamente
 *         order_id:
 *           type: object
 *           properties:
 *             order_id:
 *               type: integer
 *               example: 1
 *             details_count:
 *               type: integer
 *               example: 2
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Crear una nueva orden
 *     description: Crea una nueva orden con sus detalles asociados
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       201:
 *         description: Orden creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateOrderResponse'
 *       400:
 *         description: Datos inválidos o falta de información necesaria
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       500:
 *         description: Error interno del servidor
 */
const createOrder = async (req, res) => {
  try {
    const { user_id, total_amount, details } = req.body;
    
    logger.debug('Iniciando creación de orden', { 
      userId: user_id, 
      totalAmount: total_amount, 
      detailsCount: details?.length 
    });

    // Validación básica
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario requerido'
      });
    }

    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Monto total inválido'
      });
    }

    if (!details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede crear una orden sin detalles'
      });
    }

    // Crear la orden
    const result = await Order.createOrder(user_id, total_amount, details);
    
    logger.info('Orden creada exitosamente', {
      userId: user_id,
      orderId: result.order_id,
      detailsCount: result.details_count
    });

    res.status(201).json({
      success: true,
      message: 'Orden creada exitosamente',
      data: result
    });
  } catch (error) {
    logger.error('Error al crear la orden:', {
      error: error.message,
      stack: error.stack,
      userId: req.body?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al crear la orden',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/{orderId}:
 *   get:
 *     summary: Obtener detalles de una orden
 *     description: Recupera información detallada de una orden específica
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden a consultar
 *     responses:
 *       200:
 *         description: Detalles de la orden recuperados exitosamente
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para acceder a esta orden
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error interno del servidor
 */
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.user;
    
    logger.debug('Solicitando detalles de orden', { 
      orderId, 
      requestingUserId: user.id 
    });

    // Obtener la orden
    const order = await Order.getOrderWithDetails(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    // Verificar permisos - solo el dueño o un administrador pueden ver la orden
    if (order.user_id !== user.id && user.rol_id !== 1) {
      logger.warn('Intento de acceso no autorizado a detalles de orden', {
        orderId,
        orderUserId: order.user_id,
        requestingUserId: user.id,
        requestingUserRole: user.rol_id
      });

      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver esta orden'
      });
    }

    logger.info('Detalles de orden recuperados exitosamente', {
      orderId,
      requestingUserId: user.id
    });

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error al obtener detalles de la orden:', {
      error: error.message,
      stack: error.stack,
      orderId: req.params.orderId,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles de la orden',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/user/{userId}:
 *   get:
 *     summary: Obtener órdenes de un usuario
 *     description: Recupera todas las órdenes realizadas por un usuario específico
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario cuyas órdenes se quieren consultar
 *     responses:
 *       200:
 *         description: Listado de órdenes recuperado exitosamente
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para acceder a estas órdenes
 *       500:
 *         description: Error interno del servidor
 */
const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user;
    
    logger.debug('Solicitando órdenes de usuario', { 
      targetUserId: userId, 
      requestingUserId: user.id 
    });

    // Verificar permisos - solo el dueño o un administrador pueden ver las órdenes
    if (parseInt(userId) !== user.id && user.rol_id !== 1) {
      logger.warn('Intento de acceso no autorizado a órdenes de usuario', {
        targetUserId: userId,
        requestingUserId: user.id,
        requestingUserRole: user.rol_id
      });

      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas órdenes'
      });
    }

    // Obtener las órdenes
    const orders = await Order.getUserOrders(userId);
    
    logger.info('Órdenes de usuario recuperadas exitosamente', {
      targetUserId: userId,
      orderCount: orders.length,
      requestingUserId: user.id
    });

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    logger.error('Error al obtener órdenes de usuario:', {
      error: error.message,
      stack: error.stack,
      userId: req.params.userId,
      requestingUserId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes del usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { 
  createOrder,
  getOrderById,
  getUserOrders
};