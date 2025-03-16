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
    const { user_id, total_amount, details, delivery_date, status_id } = req.body;
    
    logger.debug('Iniciando creación de orden', { 
      userId: user_id, 
      totalAmount: total_amount, 
      detailsCount: details?.length,
      deliveryDate: delivery_date,
      statusId: status_id
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
    
    // Validar fecha de entrega si se proporciona
    let parsedDeliveryDate = null;
    if (delivery_date) {
      parsedDeliveryDate = new Date(delivery_date);
      
      if (isNaN(parsedDeliveryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha de entrega inválido'
        });
      }
      
      // Obtener configuración de hora límite
      const adminSettings = await require('../models/AdminSettings').getSettings();
      const orderTimeLimit = adminSettings.orderTimeLimit || "18:00";
      
      // Calcular fecha mínima permitida
      const minDeliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
      
      // Comparar solo las fechas (sin la hora)
      const deliveryDateOnly = new Date(parsedDeliveryDate.toDateString());
      const minDeliveryDateOnly = new Date(minDeliveryDate.toDateString());

      if (deliveryDateOnly < minDeliveryDateOnly) {
        return res.status(400).json({
          success: false,
          message: `La fecha de entrega debe ser a partir del ${minDeliveryDate.toISOString().split('T')[0]}`,
          minDeliveryDate: minDeliveryDate.toISOString().split('T')[0]
        });
      }
    }

    if (!delivery_date) {
      // Obtener configuración de hora límite
      const adminSettings = await require('../models/AdminSettings').getSettings();
      const orderTimeLimit = adminSettings.orderTimeLimit || "18:00";
      
      // Calcular fecha de entrega automáticamente
      parsedDeliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
      
      logger.debug('Asignando fecha de entrega automática al no proporcionarse', {
        calculatedDate: parsedDeliveryDate,
        orderTimeLimit
      });
    }
    
    // Usar estado predeterminado si no se proporciona
    const initialStatus = status_id || 1; // Por defecto: Abierto

    // Crear la orden con la fecha de entrega y estado
    const result = await Order.createOrder(
      user_id, 
      total_amount, 
      details, 
      parsedDeliveryDate,
      initialStatus
    );
    
    logger.info('Orden creada exitosamente', {
      userId: user_id,
      orderId: result.order_id,
      detailsCount: result.details_count,
      deliveryDate: parsedDeliveryDate,
      statusId: initialStatus
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

/**
 * @swagger
 * /api/orders/{orderId}:
 *   put:
 *     summary: Actualizar una orden existente
 *     description: Actualiza una orden y sus detalles según el ID proporcionado
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status_id:
 *                 type: integer
 *                 description: ID del nuevo estado
 *               delivery_date:
 *                 type: string
 *                 format: date
 *                 description: Nueva fecha de entrega (YYYY-MM-DD)
 *               total_amount:
 *                 type: number
 *                 description: Nuevo monto total de la orden
 *               details:
 *                 type: array
 *                 description: Nuevos detalles de la orden (reemplazará los existentes)
 *                 items:
 *                   type: object
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       description: ID del producto
 *                     quantity:
 *                       type: integer
 *                       description: Cantidad del producto
 *                     unit_price:
 *                       type: number
 *                       description: Precio unitario
 *     responses:
 *       200:
 *         description: Orden actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Orden actualizada exitosamente
 *                 data:
 *                   type: object
 *       400:
 *         description: Datos inválidos o la orden no se puede modificar
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para modificar esta orden
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error interno del servidor
 */
const updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;
    const user = req.user;
    
    logger.debug('Solicitando actualización de orden', { 
      orderId, 
      userId: user.id,
      updateData
    });

    // Verificar que el ID de orden sea válido
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de orden inválido'
      });
    }

    // Obtener la orden actual para verificar permisos
    const currentOrder = await Order.getOrderWithDetails(orderId);
    
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    // Verificar permisos - solo el dueño o un administrador pueden modificar la orden
    if (currentOrder.user_id !== user.id && user.rol_id !== 1) {
      logger.warn('Intento de acceso no autorizado a actualización de orden', {
        orderId,
        orderUserId: currentOrder.user_id,
        requestingUserId: user.id,
        requestingUserRole: user.rol_id
      });

      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar esta orden'
      });
    }

    // Validar fecha de entrega si se proporciona
    if (updateData.delivery_date) {
      const deliveryDate = new Date(updateData.delivery_date);
      
      // Obtener configuración de hora límite
      const adminSettings = await require('../models/AdminSettings').getSettings();
      const orderTimeLimit = adminSettings.orderTimeLimit || "18:00";
      
      // Calcular fecha mínima permitida
      const minDeliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
      
      // Verificar que la fecha sea válida
      if (isNaN(deliveryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha de entrega inválido'
        });
      }
      
      // Comparar solo las fechas (sin la hora)
      const deliveryDateOnly = new Date(deliveryDate.toDateString());
      const minDeliveryDateOnly = new Date(minDeliveryDate.toDateString());
      
      if (deliveryDateOnly < minDeliveryDateOnly) {
        return res.status(400).json({
          success: false,
          message: `La fecha de entrega debe ser a partir del ${minDeliveryDate.toISOString().split('T')[0]}`,
          minDeliveryDate: minDeliveryDate.toISOString().split('T')[0]
        });
      }
    }

    // Actualizar la orden
    const updatedOrder = await Order.updateOrder(orderId, updateData);
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar la orden'
      });
    }
    
    // Responder con la orden actualizada
    res.status(200).json({
      success: true,
      message: 'Orden actualizada exitosamente',
      data: updatedOrder
    });
  } catch (error) {
    logger.error('Error al actualizar orden', {
      error: error.message,
      stack: error.stack,
      orderId: req.params?.orderId,
      userId: req.user?.id
    });
    
    // Manejo de errores específicos
    if (error.message.includes('No se puede modificar')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la orden',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/status/{statusId}:
 *   get:
 *     summary: Obtener órdenes por estado
 *     description: Recupera todas las órdenes que tienen un estado específico
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: statusId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del estado a filtrar
 *     responses:
 *       200:
 *         description: Lista de órdenes recuperada exitosamente
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para ver estas órdenes
 *       500:
 *         description: Error interno del servidor
 */
const getOrdersByStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const user = req.user;
    
    logger.debug('Solicitando órdenes por estado', { 
      statusId, 
      userId: user.id 
    });

    // Verificar que el ID de estado sea válido
    if (!statusId || isNaN(parseInt(statusId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado inválido'
      });
    }

    // Verificar permisos - solo los administradores pueden ver todas las órdenes por estado
    if (user.rol_id !== 1) {
      logger.warn('Intento de acceso no autorizado a listado de órdenes por estado', {
        statusId,
        userId: user.id,
        userRole: user.rol_id
      });

      // Si no es administrador, solo puede ver sus propias órdenes
      const userOrders = await Order.getUserOrders(user.id);
      const filteredOrders = userOrders.filter(order => order.status_id === parseInt(statusId));
      
      return res.status(200).json({
        success: true,
        data: filteredOrders
      });
    }

    // Obtener órdenes por estado
    const orders = await Order.getOrdersByStatus(statusId);
    
    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    logger.error('Error al obtener órdenes por estado', {
      error: error.message,
      stack: error.stack,
      statusId: req.params?.statusId,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes por estado',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/statuses:
 *   get:
 *     summary: Obtener todos los estados de órdenes
 *     description: Recupera la lista de posibles estados para las órdenes
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de estados recuperada exitosamente
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       500:
 *         description: Error interno del servidor
 */
const getOrderStatuses = async (req, res) => {
  try {
    logger.debug('Solicitando estados de órdenes');

    // Obtener estados de órdenes
    const statuses = await Order.getOrderStatuses();
    
    res.status(200).json({
      success: true,
      data: statuses
    });
  } catch (error) {
    logger.error('Error al obtener estados de órdenes', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener estados de órdenes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/delivery-date:
 *   get:
 *     summary: Calcular fecha de entrega disponible
 *     description: Calcula la fecha de entrega más próxima disponible según las reglas de negocio
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fecha de entrega calculada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     deliveryDate:
 *                       type: string
 *                       format: date
 *                       example: "2025-03-22"
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       500:
 *         description: Error interno del servidor
 */
const calculateDeliveryDate = async (req, res) => {
  try {
    logger.debug('Calculando fecha de entrega disponible');

    // Obtener configuración de hora límite
    const adminSettings = await require('../models/AdminSettings').getSettings();
    const orderTimeLimit = adminSettings.orderTimeLimit || "18:00";
    
    // Calcular fecha de entrega
    const deliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
    
    res.status(200).json({
      success: true,
      data: {
        deliveryDate: deliveryDate.toISOString().split('T')[0],
        orderTimeLimit
      }
    });
  } catch (error) {
    logger.error('Error al calcular fecha de entrega', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al calcular fecha de entrega',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Actualiza manualmente las órdenes pendientes a "En Producción"
 * @swagger
 * /api/orders/process-pending:
 *   post:
 *     summary: Actualizar estado de órdenes pendientes
 *     description: Actualiza todas las órdenes pendientes a estado "En Producción" (igual que el proceso automático)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ignoreTimeLimit:
 *                 type: boolean
 *                 description: Si es true, ignora la restricción de hora límite
 *                 example: false
 *               ignoreCreationDate:
 *                 type: boolean
 *                 description: Si es true, actualiza órdenes de cualquier fecha (no solo de hoy)
 *                 example: false
 *     responses:
 *       200:
 *         description: Órdenes actualizadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "5 órdenes actualizadas a estado 'En Producción'"
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderTimeLimit:
 *                       type: string
 *                       example: "18:00"
 *                     updatedCount:
 *                       type: integer
 *                       example: 5
 *                     ignoreTimeLimit:
 *                       type: boolean
 *                       example: false
 *                     ignoreCreationDate:
 *                       type: boolean
 *                       example: false
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - Sin permisos para realizar esta acción
 *       500:
 *         description: Error interno del servidor
 */
const updatePendingOrders = async (req, res) => {
  try {
    // Obtener configuración de hora límite
    const adminSettings = await require('../models/AdminSettings').getSettings();
    const orderTimeLimit = adminSettings.orderTimeLimit || "18:00";
    
    // Obtener opciones de la solicitud
    const ignoreTimeLimit = req.body.ignoreTimeLimit === true;
    const ignoreCreationDate = req.body.ignoreCreationDate === true;
    
    logger.info('Iniciando actualización manual de órdenes pendientes', {
      userId: req.user.id,
      orderTimeLimit,
      ignoreTimeLimit,
      ignoreCreationDate
    });

    // Llamar al método del modelo que actualiza las órdenes
    const updatedCount = await Order.updatePendingOrdersStatus(orderTimeLimit, {
      ignoreTimeLimit,
      ignoreCreationDate
    });
    
    res.status(200).json({
      success: true,
      message: `${updatedCount} órdenes actualizadas a estado 'En Producción'`,
      data: {
        orderTimeLimit,
        updatedCount,
        ignoreTimeLimit,
        ignoreCreationDate
      }
    });
  } catch (error) {
    logger.error('Error al actualizar estado de órdenes pendientes', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado de órdenes pendientes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/{orderId}:
 *   delete:
 *     summary: Eliminar una orden
 *     description: Elimina una orden si no está en estado "En Producción"
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden a eliminar
 *     responses:
 *       200:
 *         description: Orden eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Orden eliminada exitosamente
 *                 data:
 *                   type: object
 *       400:
 *         description: No se puede eliminar la orden (ej. está en producción)
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para eliminar esta orden
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error interno del servidor
 */
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.user;
    
    logger.debug('Solicitud de eliminación de orden', { 
      orderId,
      userId: user.id
    });
    
    // Verificar que el ID de orden sea válido
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de orden inválido'
      });
    }
    
    try {
      // Intentar eliminar la orden
      const deletedOrder = await Order.deleteOrder(orderId, user.id);
      
      if (!deletedOrder) {
        return res.status(404).json({
          success: false,
          message: 'Orden no encontrada'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Orden eliminada exitosamente',
        data: {
          orderId: deletedOrder.order_id,
          userId: deletedOrder.user_id,
          statusId: deletedOrder.status_id,
          orderDate: deletedOrder.order_date
        }
      });
    } catch (deleteError) {
      // Capturar errores específicos del modelo
      if (deleteError.message.includes('No tiene permisos')) {
        return res.status(403).json({
          success: false,
          message: deleteError.message
        });
      }
      
      if (deleteError.message.includes('No se puede eliminar')) {
        return res.status(400).json({
          success: false,
          message: deleteError.message
        });
      }
      
      // Propagar otros errores
      throw deleteError;
    }
  } catch (error) {
    logger.error('Error general al eliminar orden', {
      error: error.message,
      stack: error.stack,
      orderId: req.params.orderId,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la orden',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { 
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrder,
  getOrdersByStatus,
  getOrderStatuses,
  calculateDeliveryDate,
  updatePendingOrders,
  deleteOrder
};