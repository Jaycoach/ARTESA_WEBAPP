// src/controllers/orderController.js
const Order = require('../models/Order');
const { createContextLogger } = require('../config/logger');
const pool = require('../config/db');

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
     // Manejar datos de multipart/form-data si están presentes
    let requestData = req.body;
    
    // Si el content-type es multipart/form-data, los datos pueden estar en diferentes ubicaciones
    if (req.files || req.body.constructor === Object && Object.keys(req.body).length === 0) {
      // Intentar parsear datos JSON desde campos de formulario
      try {
        if (req.body.orderData) {
          requestData = JSON.parse(req.body.orderData);
        } else if (req.body.data) {
          requestData = JSON.parse(req.body.data);
        }
      } catch (parseError) {
        logger.error('Error parseando datos JSON desde multipart/form-data:', parseError);
      }
    }

    const { user_id, total_amount, details, delivery_date, status_id, branch_id } = requestData;
    logger.debug('Iniciando creación de orden', {
      userId: user_id,
      totalAmount: total_amount,
      detailsCount: details?.length,
      deliveryDate: delivery_date,
      statusId: status_id
    });

    // Log adicional para debugging de multipart/form-data
    logger.debug('Datos de request completos:', {
      contentType: req.headers['content-type'],
      hasFiles: !!req.files,
      bodyKeys: Object.keys(req.body),
      bodyData: req.body,
      requestData: requestData
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

    // Validación adicional para multipart/form-data
    if (!requestData || Object.keys(requestData).length === 0) {
      logger.error('Datos de orden vacíos o inválidos', {
        originalBody: req.body,
        contentType: req.headers['content-type'],
        hasFiles: !!req.files
      });
      
      return res.status(400).json({
        success: false,
        message: 'Datos de orden requeridos. Verifica que los datos se envíen correctamente.',
        debug: process.env.NODE_ENV === 'development' ? {
          receivedKeys: Object.keys(req.body),
          contentType: req.headers['content-type']
        } : undefined
      });
    }

    if (!details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede crear una orden sin detalles'
      });
    }

    // Verificar si el usuario está activo
    const userQuery = 'SELECT is_active FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [user_id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!userResult.rows[0].is_active) {
      // Verificar si el usuario tiene un perfil de cliente con cardtype_sap válido
      const profileQuery = 'SELECT client_id, cardcode_sap, cardtype_sap FROM client_profiles WHERE user_id = $1';
      const profileResult = await pool.query(profileQuery, [user_id]);

      // Solo permitir si tiene perfil completo Y cardtype_sap = 'cCustomer' (ya no es Lead)
      if (profileResult.rows.length > 0 && 
          profileResult.rows[0].cardcode_sap && 
          profileResult.rows[0].cardtype_sap === 'cCustomer') {
        logger.info('Usuario inactivo con perfil completo y cliente confirmado en SAP, permitiendo creación de orden', {
          userId: user_id,
          cardcodeSap: profileResult.rows[0].cardcode_sap,
          cardTypeSap: profileResult.rows[0].cardtype_sap
        });
      } else {
        let reason = 'Usuario inactivo';
        if (profileResult.rows.length === 0) {
          reason = 'Usuario inactivo sin perfil de cliente';
        } else if (!profileResult.rows[0].cardcode_sap) {
          reason = 'Usuario inactivo sin código SAP asignado';
        } else if (profileResult.rows[0].cardtype_sap === 'cLid') {
          reason = 'Usuario inactivo - cliente aún es Lead en SAP';
        }
        
        logger.warn('Intento de crear orden con usuario inactivo sin perfil completo o cliente Lead', { 
          userId: user_id,
          reason,
          cardTypeSap: profileResult.rows.length > 0 ? profileResult.rows[0].cardtype_sap : null
        });
        
        return res.status(403).json({
          success: false,
          message: `${reason}. No puede crear órdenes.`
        });
      }
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
      const orderTimeLimit = adminSettings.orderTimeLimit;

      if (!orderTimeLimit) {
        logger.warn('No se encontró configuración de hora límite en AdminSettings');
        return res.status(500).json({
          success: false,
          message: 'Error en la configuración del sistema'
        });
      }
      
      // Calcular fecha mínima permitida usando el nuevo método
      const minDeliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
      
      // Comparar solo las fechas (sin la hora)
      const deliveryDateOnly = new Date(parsedDeliveryDate.toDateString());
      const minDeliveryDateOnly = new Date(minDeliveryDate.toDateString());

      // Logging para debug de zona horaria
      logger.debug('Validación de fecha con zona horaria', {
        receivedDate: delivery_date,
        parsedDeliveryDate: parsedDeliveryDate.toISOString(),
        deliveryDateOnly: deliveryDateOnly.toISOString(),
        minDeliveryDate: minDeliveryDate.toISOString(),
        minDeliveryDateOnly: minDeliveryDateOnly.toISOString(),
        timezone: process.env.TZ || 'UTC'
      });

      // Validar que sea un día hábil
      const colombianHolidays = require('../utils/colombianHolidays');
      
      if (!colombianHolidays.isWorkingDay(deliveryDateOnly)) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de entrega debe ser un día hábil (no festivo ni fin de semana)',
          suggestedDate: colombianHolidays.getNextWorkingDay(deliveryDateOnly).toISOString().split('T')[0]
        });
      }

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
      const orderTimeLimit = adminSettings.orderTimeLimit;

      if (!orderTimeLimit) {
        logger.warn('No se encontró configuración de hora límite en AdminSettings');
        return res.status(500).json({
          success: false,
          message: 'Error en la configuración del sistema'
        });
      }
      
      // Calcular fecha de entrega automáticamente
      parsedDeliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
      
      logger.debug('Asignando fecha de entrega automática al no proporcionarse', {
        calculatedDate: parsedDeliveryDate,
        orderTimeLimit
      });
    }

    // Validar sucursal si se proporciona
    if (branch_id !== undefined && branch_id !== null) {
      // Verificar que la sucursal pertenece al usuario
      const branchQuery = `
        SELECT cb.branch_id, cb.ship_to_code 
        FROM client_branches cb
        JOIN client_profiles cp ON cb.client_id = cp.client_id
        WHERE cb.branch_id = $1 AND cp.user_id = $2
      `;
      
      const branchResult = await pool.query(branchQuery, [branch_id, user_id]);
      
      if (branchResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La sucursal especificada no pertenece al usuario o no existe'
        });
      }
      
      logger.debug('Sucursal validada para orden', {
        branchId: branch_id,
        shipToCode: branchResult.rows[0].ship_to_code,
        userId: user_id
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
      initialStatus,
      branch_id
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

    // Log detallado para diagnóstico
    if (orders.length > 0) {
      logger.debug('Detalles de la primera orden recuperada:', {
        firstOrder: JSON.stringify(orders[0])
      });
    }
    
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
      const orderTimeLimit = adminSettings.orderTimeLimit;

      if (!orderTimeLimit) {
        logger.warn('No se encontró configuración de hora límite en AdminSettings');
        return res.status(500).json({
          success: false,
          message: 'Error en la configuración del sistema'
        });
      }
      
      // Calcular fecha mínima permitida
      const minDeliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
      
      // Verificar que la fecha sea válida
      if (isNaN(deliveryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha de entrega inválido'
        });
      }
      
      // Validar que sea un día hábil
      const colombianHolidays = require('../utils/colombianHolidays');
      
      if (!colombianHolidays.isWorkingDay(deliveryDate)) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de entrega debe ser un día hábil (no festivo ni fin de semana)',
          suggestedDate: colombianHolidays.getNextWorkingDay(deliveryDate).toISOString().split('T')[0]
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
 * /api/orders/can-create/{userId}:
 *   get:
 *     summary: Verificar si un usuario puede crear órdenes
 *     description: Verifica si un usuario está activo y tiene un perfil de cliente con código SAP
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a verificar
 *     responses:
 *       200:
 *         description: Resultado de la verificación
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
 *                     canCreate:
 *                       type: boolean
 *                       example: true
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     hasProfile:
 *                       type: boolean
 *                       example: true
 *                     hasCardCode:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error interno del servidor
 */
const checkUserCanCreateOrders = async (req, res) => {
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
    
    // Verificar si tiene perfil de cliente y cardtype_sap
    const profileQuery = 'SELECT client_id, cardcode_sap, cardtype_sap FROM client_profiles WHERE user_id = $1';
    const profileResult = await pool.query(profileQuery, [userId]);

    let canCreate = false;
    let reason = '';

    // NUEVA LÓGICA SIMPLIFICADA - igual que createOrder
    // Verificar primero si tiene perfil y cardtype_sap válido
    if (profileResult.rows.length > 0 && 
        profileResult.rows[0].cardcode_sap && 
        profileResult.rows[0].cardtype_sap === 'cCustomer') {
      canCreate = true;
      reason = userResult.rows[0].is_active ? 
        'Usuario activo con perfil SAP válido' : 
        'Usuario con perfil SAP válido pero inactivo';
    } else if (profileResult.rows.length > 0) {
      canCreate = false;
      reason = 'Perfil existe pero sin cardcode_sap o cardtype_sap no es cCustomer';
    } else {
      canCreate = false;
      reason = 'Usuario sin perfil de cliente';
    }

    const responseData = {
      canCreate: canCreate && userResult.rows[0].is_active, // Solo puede crear si está activo Y tiene perfil válido
      isActive: userResult.rows[0].is_active,
      hasProfile: profileResult.rows.length > 0,
      hasCardCode: profileResult.rows.length > 0 && 
                  profileResult.rows[0].cardcode_sap && 
                  profileResult.rows[0].cardtype_sap === 'cCustomer'
    };

    logger.debug('Resultado de validación can-create', {
      userId,
      canCreate: responseData.canCreate,
      reason,
      profileData: profileResult.rows[0] || null
    });

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error al verificar capacidad para crear órdenes', {
      error: error.message,
      stack: error.stack,
      userId: req.params.userId
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al verificar capacidad para crear órdenes',
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
    const orderTimeLimit = adminSettings.orderTimeLimit;

    if (!orderTimeLimit) {
      logger.warn('No se encontró configuración de hora límite en AdminSettings');
      return res.status(500).json({
        success: false,
        message: 'Error en la configuración del sistema'
      });
    }
    
    // Calcular fecha de entrega
    const deliveryDate = Order.calculateDeliveryDate(new Date(), orderTimeLimit);
    
    // Importar utilidad de días festivos
    const colombianHolidays = require('../utils/colombianHolidays');
    
    // Calcular algunas fechas hábiles para sugerir en el frontend
    const today = new Date();
    const nextFiveDays = [];
    let currentDate = new Date(today);
    
    // Generar próximos 7 días hábiles para el frontend
    for (let i = 0; i < 10; i++) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (colombianHolidays.isWorkingDay(currentDate)) {
        nextFiveDays.push({
          date: new Date(currentDate).toISOString().split('T')[0],
          isAvailable: currentDate >= deliveryDate
        });
        
        // Si ya tenemos 7 días hábiles, terminamos
        if (nextFiveDays.length >= 7) break;
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        deliveryDate: deliveryDate.toISOString().split('T')[0],
        orderTimeLimit,
        nextAvailableDates: nextFiveDays,
        isPastTimeLimit: new Date().getHours() >= parseInt(orderTimeLimit.split(':')[0])
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
    const orderTimeLimit = adminSettings.orderTimeLimit;

    if (!orderTimeLimit) {
      logger.warn('No se encontró configuración de hora límite en AdminSettings');
      return res.status(500).json({
        success: false,
        message: 'Error en la configuración del sistema'
      });
    }
    
    // Obtener opciones de la solicitud
    const ignoreTimeLimit = req.body.ignoreTimeLimit === true;
    const ignoreDeliveryDate = req.body.ignoreDeliveryDate === true;
    
    logger.info('Iniciando actualización manual de órdenes', {
      userId: req.user.id,
      orderTimeLimit,
      ignoreTimeLimit,
      ignoreDeliveryDate
    });

    // Llamar al método del modelo que actualiza las órdenes
    const result = await Order.updatePendingOrdersStatus(orderTimeLimit, {
      ignoreTimeLimit,
      ignoreDeliveryDate
    });
    
    res.status(200).json({
      success: true,
      message: `${result.updatedCount} órdenes actualizadas a 'En Producción' y ${result.cancelledCount} órdenes vencidas canceladas`,
      data: {
        orderTimeLimit,
        updatedToProduction: result.updatedCount,
        updatedToCancelled: result.cancelledCount,
        updatedIds: result.updatedIds,
        cancelledIds: result.cancelledIds,
        ignoreTimeLimit,
        ignoreDeliveryDate
      }
    });
  } catch (error) {
    logger.error('Error al actualizar estado de órdenes', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado de órdenes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/{orderId}/cancel:
 *   put:
 *     summary: Cancelar una orden
 *     description: Cambia el estado de una orden existente a Cancelado
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden a cancelar
 *     responses:
 *       200:
 *         description: Orden cancelada exitosamente
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
 *                   example: Orden cancelada exitosamente
 *                 data:
 *                   type: object
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para cancelar esta orden
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error interno del servidor
 */
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.user;
    
    logger.debug('Solicitando cancelación de orden', { 
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

    // Obtener la orden para verificar permisos
    const order = await Order.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    // Verificar permisos - solo el dueño o un administrador pueden cancelar la orden
    if (order.user_id !== user.id && user.rol_id !== 1) {
      logger.warn('Intento de acceso no autorizado para cancelación de orden', {
        orderId,
        orderUserId: order.user_id,
        requestingUserId: user.id,
        requestingUserRole: user.rol_id
      });

      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cancelar esta orden'
      });
    }
    
    // Verificar si la orden está en un estado que permite cancelación
    const nonCancelableStates = [3, 4, 5, 7]; // En producción, Entregado, Cerrado, ya Cancelado
    if (nonCancelableStates.includes(order.status_id)) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar esta orden porque está en estado "En Producción", "Entregado", "Cerrado" o ya está "Cancelada"'
      });
    }

    // Verificar si la orden ya fue sincronizada con SAP
    if (order.sap_synced) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar esta orden porque ya fue sincronizada con SAP'
      });
    }

    // Cancelar la orden
    const canceledOrder = await Order.cancelOrder(orderId, user.id);
    
    if (!canceledOrder) {
      return res.status(500).json({
        success: false,
        message: 'Error al cancelar la orden'
      });
    }
    
    // Responder con la orden cancelada
    res.status(200).json({
      success: true,
      message: 'Orden cancelada exitosamente',
      data: canceledOrder
    });
  } catch (error) {
    logger.error('Error al cancelar orden', {
      error: error.message,
      stack: error.stack,
      orderId: req.params?.orderId,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la orden',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/byDeliveryDate:
 *   get:
 *     summary: Obtener órdenes por fecha de entrega
 *     description: Recupera órdenes filtradas por fecha de entrega y opcionalmente por estado
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: deliveryDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de entrega en formato YYYY-MM-DD
 *         example: "2025-03-24"
 *       - in: query
 *         name: statusId
 *         required: false
 *         schema:
 *           type: integer
 *         description: ID del estado a filtrar (opcional)
 *     responses:
 *       200:
 *         description: Lista de órdenes recuperada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Formato de fecha inválido
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para ver estas órdenes
 *       500:
 *         description: Error interno del servidor
 */
const getOrdersByDeliveryDate = async (req, res) => {
  try {
    const { deliveryDate, statusId } = req.query;
    const user = req.user;
    
    logger.debug('Solicitando órdenes por fecha de entrega', { 
      deliveryDate, 
      statusId, 
      userId: user.id 
    });

    // Validar que la fecha tenga un formato válido
    if (!deliveryDate || isNaN(new Date(deliveryDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Utilice YYYY-MM-DD'
      });
    }

    // Validar el estado si se proporciona
    if (statusId !== undefined && (isNaN(parseInt(statusId)) || parseInt(statusId) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado inválido'
      });
    }

    let filteredStatusId = statusId ? parseInt(statusId) : null;
    
    // Si no es administrador, solo puede ver sus propias órdenes
    if (user.rol_id !== 1) {
      // Obtener todas las órdenes del usuario primero
      const userOrders = await Order.getUserOrders(user.id);
      
      // Filtrar manualmente por fecha de entrega y estado
      const formatDate = date => new Date(date).toISOString().split('T')[0];
      const formattedDeliveryDate = formatDate(deliveryDate);
      
      const filteredOrders = userOrders.filter(order => {
        const orderDeliveryDate = order.delivery_date ? formatDate(order.delivery_date) : null;
        
        // Verificar coincidencia de fecha
        const dateMatches = orderDeliveryDate === formattedDeliveryDate;
        
        // Verificar coincidencia de estado (si se especificó)
        const statusMatches = filteredStatusId === null || order.status_id === filteredStatusId;
        
        return dateMatches && statusMatches;
      });
      
      return res.status(200).json({
        success: true,
        data: filteredOrders
      });
    }

    // Si es administrador, obtener todas las órdenes por fecha y estado
    const orders = await Order.getOrdersByDeliveryDate(deliveryDate, filteredStatusId);
    
    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    logger.error('Error al obtener órdenes por fecha de entrega', {
      error: error.message,
      stack: error.stack,
      deliveryDate: req.query?.deliveryDate,
      statusId: req.query?.statusId,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes por fecha de entrega',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/sync-to-sap:
 *   post:
 *     summary: Sincronizar órdenes con SAP
 *     description: Inicia la sincronización de todas las órdenes pendientes con SAP B1
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización iniciada exitosamente
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
 *                   example: "Sincronización de órdenes con SAP iniciada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 5
 *                     created:
 *                       type: integer
 *                       example: 3
 *                     errors:
 *                       type: integer
 *                       example: 1
 *                     skipped:
 *                       type: integer
 *                       example: 1
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
const syncOrdersToSap = async (req, res) => {
  try {
    const sapServiceManager = require('../services/SapServiceManager');
    
    logger.info('Iniciando sincronización manual de órdenes con SAP', { 
      userId: req.user?.id
    });
    
    // Asegurar que el servicio está inicializado
    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
    }
    
    // Ejecutar sincronización
    const result = await sapServiceManager.syncOrders();
    
    res.status(200).json({
      success: true,
      message: 'Sincronización de órdenes con SAP iniciada exitosamente',
      data: result
    });
  } catch (error) {
    logger.error('Error al sincronizar órdenes con SAP', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar órdenes con SAP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/update-status-from-sap:
 *   post:
 *     summary: Actualizar estados de órdenes desde SAP
 *     description: Obtiene y actualiza el estado de las órdenes basándose en la información de SAP B1
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Actualización iniciada exitosamente
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
 *                   example: "Actualización de estados desde SAP iniciada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 10
 *                     updated:
 *                       type: integer
 *                       example: 5
 *                     unchanged:
 *                       type: integer
 *                       example: 4
 *                     errors:
 *                       type: integer
 *                       example: 1
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
const updateOrderStatusFromSap = async (req, res) => {
  try {
    const sapServiceManager = require('../services/SapServiceManager');
    
    logger.info('Iniciando actualización manual de estados de órdenes desde SAP', { 
      userId: req.user?.id
    });
    
    // Asegurar que el servicio está inicializado
    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
    }
    
    // Ejecutar actualización de estados
    const result = await sapServiceManager.updateOrderStatus();
    
    res.status(200).json({
      success: true,
      message: 'Actualización de estados desde SAP iniciada exitosamente',
      data: result
    });
  } catch (error) {
    logger.error('Error al actualizar estados desde SAP', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estados desde SAP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/check-delivered:
 *   post:
 *     summary: Verificar órdenes entregadas desde SAP
 *     description: Consulta la vista B1_DeliveredOrdersB1SLQuery en SAP para actualizar órdenes entregadas
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verificación iniciada exitosamente
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
 *                   example: "Verificación de órdenes entregadas completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 10
 *                     updated:
 *                       type: integer
 *                       example: 5
 *                     unchanged:
 *                       type: integer
 *                       example: 4
 *                     errors:
 *                       type: integer
 *                       example: 1
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
const checkDeliveredOrders = async (req, res) => {
  try {
    const sapServiceManager = require('../services/SapServiceManager');
    
    logger.info('Iniciando verificación manual de órdenes entregadas y facturadas desde SAP', { 
      userId: req.user?.id
    });
    
    // Asegurar que el servicio está inicializado
    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
    }
    
    // Ejecutar verificación de órdenes entregadas completas
    const deliveredResult = await sapServiceManager.orderService.checkDeliveredOrdersFromSAP();
    
    // Ejecutar verificación de órdenes con entrega parcial
    const partialDeliveredResult = await sapServiceManager.orderService.checkPartialDeliveredOrdersFromSAP();
    
    // Ejecutar verificación de órdenes facturadas
    const invoicedResult = await sapServiceManager.orderService.checkInvoicedOrdersFromSAP();
    
    const combinedResult = {
      delivered: deliveredResult,
      partialDelivered: partialDeliveredResult,
      invoiced: invoicedResult,
      summary: {
        total: deliveredResult.total + partialDeliveredResult.total + invoicedResult.total,
        updated: deliveredResult.updated + partialDeliveredResult.updated + invoicedResult.updated,
        errors: deliveredResult.errors + partialDeliveredResult.errors + invoicedResult.errors,
        unchanged: deliveredResult.unchanged + partialDeliveredResult.unchanged + invoicedResult.unchanged
      }
    };
    
    res.status(200).json({
      success: true,
      message: 'Verificación de órdenes entregadas y facturadas completada exitosamente',
      data: combinedResult
    });
  } catch (error) {
    logger.error('Error al verificar órdenes entregadas y facturadas desde SAP', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al verificar órdenes entregadas y facturadas desde SAP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/{orderId}/send-to-sap:
 *   post:
 *     summary: Enviar una orden específica a SAP
 *     description: Envía una orden específica a SAP B1, independientemente de su estado actual
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden a enviar a SAP
 *     responses:
 *       200:
 *         description: Orden enviada exitosamente
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
 *                   example: "Orden enviada exitosamente a SAP"
 *                 data:
 *                   type: object
 *                   properties:
 *                     sapDocEntry:
 *                       type: integer
 *                       example: 12345
 *                     sapDocNum:
 *                       type: integer
 *                       example: 1000
 *                     orderId:
 *                       type: integer
 *                       example: 42
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error interno del servidor
 */
const sendOrderToSap = async (req, res) => {
  try {
    const { orderId } = req.params;
    const Order = require('../models/Order');
    
    logger.debug('Enviando orden específica a SAP', { 
      orderId, 
      userId: req.user?.id 
    });
    
    // Verificar que la orden existe
    const order = await Order.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }
    
    const sapServiceManager = require('../services/SapServiceManager');
    
    // Asegurar que el servicio está inicializado
    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
    }
    
    // Enviar orden a SAP
    const result = await sapServiceManager.orderService.createOrderInSAP({ order_id: orderId });
    
    logger.info('Orden enviada exitosamente a SAP', {
      orderId,
      sapDocEntry: result.sapDocEntry,
      sapDocNum: result.sapDocNum,
      userId: req.user?.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Orden enviada exitosamente a SAP',
      data: result
    });
  } catch (error) {
    logger.error('Error al enviar orden a SAP', {
      error: error.message,
      stack: error.stack,
      orderId: req.params?.orderId,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al enviar orden a SAP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/check-invoiced:
 *   post:
 *     summary: Verificar órdenes facturadas desde SAP
 *     description: Consulta la vista B1_InvoicedOrdersB1SLQuery en SAP para actualizar órdenes facturadas
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verificación iniciada exitosamente
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
 *                   example: "Verificación de órdenes facturadas completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 10
 *                     updated:
 *                       type: integer
 *                       example: 5
 *                     unchanged:
 *                       type: integer
 *                       example: 4
 *                     errors:
 *                       type: integer
 *                       example: 1
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
const checkInvoicedOrders = async (req, res) => {
  try {
    const sapServiceManager = require('../services/SapServiceManager');
    
    logger.info('Iniciando verificación manual de órdenes facturadas desde SAP', { 
      userId: req.user?.id
    });
    
    // Asegurar que el servicio está inicializado
    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
    }
    
    // Ejecutar verificación de órdenes facturadas
    const result = await sapServiceManager.orderService.checkInvoicedOrdersFromSAP();
    
    res.status(200).json({
      success: true,
      message: 'Verificación de órdenes facturadas completada exitosamente',
      data: result
    });
  } catch (error) {
    logger.error('Error al verificar órdenes facturadas desde SAP', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al verificar órdenes facturadas desde SAP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/invoices:
 *   get:
 *     summary: Obtener facturas sincronizadas
 *     description: Recupera la información de facturas sincronizadas desde SAP, con opción de filtrar por usuario
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filtrar facturas por ID de usuario (opcional)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial para filtrar (formato YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final para filtrar (formato YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Lista de facturas recuperada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       order_id:
 *                         type: integer
 *                         example: 123
 *                       user_id:
 *                         type: integer
 *                         example: 5
 *                       user_name:
 *                         type: string
 *                         example: "Juan Pérez"
 *                       order_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-03-20T15:30:00Z"
 *                       invoice_doc_entry:
 *                         type: integer
 *                         example: 12345
 *                       invoice_doc_num:
 *                         type: integer
 *                         example: 1000
 *                       invoice_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-03-22T10:00:00Z"
 *                       invoice_total:
 *                         type: number
 *                         format: float
 *                         example: 1530.75
 *                       invoice_url:
 *                         type: string
 *                         example: "https://example.com/invoices/1000.pdf"
 *                       company_name:
 *                         type: string
 *                         example: "Empresa ABC S.A.S."
 *                       cardcode_sap:
 *                         type: string
 *                         example: "C12345"
 *       400:
 *         description: Formato de fechas inválido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
const getInvoicesByUser = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const requestingUser = req.user;
    
    logger.debug('Solicitando información de facturas', { 
      userId, 
      startDate, 
      endDate, 
      requestingUserId: requestingUser.id 
    });

    // Validar fechas si se proporcionan
    if ((startDate && isNaN(new Date(startDate).getTime())) || 
    (endDate && isNaN(new Date(endDate).getTime()))) {
      return res.status(400).json({
      success: false,
      message: 'Formato de fecha inválido. Utilice YYYY-MM-DD'
      });
    }

    // Preparar consulta base
    let query = `
      SELECT 
        o.order_id, 
        o.user_id, 
        u.name AS user_name,
        o.order_date, 
        o.invoice_doc_entry, 
        o.invoice_doc_num, 
        o.invoice_date, 
        o.invoice_total, 
        o.invoice_url,
        cp.company_name,
        cp.cardcode_sap
      FROM 
        orders o
      JOIN 
        users u ON o.user_id = u.id
      LEFT JOIN 
        client_profiles cp ON u.id = cp.user_id
      WHERE 
        o.invoice_doc_entry IS NOT NULL
    `;

    const queryParams = [];
    let paramIndex = 1;

    // Filtrar por usuario si no es admin o si se especifica un userId
    if (requestingUser.rol_id !== 1) {
      // Si no es admin, solo puede ver sus propias facturas
      query += ` AND o.user_id = $${paramIndex}`;
      queryParams.push(requestingUser.id);
      paramIndex++;
    } else if (userId) {
      // Si es admin y se especifica userId, filtrar por ese usuario
      query += ` AND o.user_id = $${paramIndex}`;
      queryParams.push(parseInt(userId, 10)); // Asegurar que es un entero
      paramIndex++;
    }

    // Filtrar por rango de fechas si se proporciona
    if (startDate) {
      query += ` AND o.invoice_date >= $${paramIndex}`;
      queryParams.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      query += ` AND o.invoice_date <= $${paramIndex}`;
      // Establecer la hora a 23:59:59 para incluir todo el día final
      const endDateWithTime = new Date(endDate);
      endDateWithTime.setHours(23, 59, 59, 999);
      queryParams.push(endDateWithTime);
      paramIndex++;
    }

    // Ordenar por fecha de factura descendente
    query += ` ORDER BY o.invoice_date DESC`;

    const { rows } = await pool.query(query, queryParams);

    logger.info('Información de facturas recuperada exitosamente', {
      count: rows.length,
      userId,
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    logger.error('Error al obtener información de facturas', {
      error: error.message,
      stack: error.stack,
      userId: req.query?.userId,
      requestingUserId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de facturas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/top-products:
 *   get:
 *     summary: Obtener productos más vendidos
 *     description: Recupera los productos más vendidos en un período de tiempo, opcionalmente filtrados por usuario
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Número máximo de productos a retornar
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio del período (formato YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin del período (formato YYYY-MM-DD)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: ID del usuario para filtrar compras (opcional)
 *     responses:
 *       200:
 *         description: Lista de productos más vendidos recuperada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       product_id:
 *                         type: integer
 *                         example: 123
 *                       product_name:
 *                         type: string
 *                         example: "Nombre del producto"
 *                       quantity:
 *                         type: integer
 *                         example: 50
 *                       total_orders:
 *                         type: integer
 *                         example: 10
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
const getTopSellingProducts = async (req, res) => {
  try {
    const { limit, startDate, endDate, userId } = req.query;
    
    logger.debug('Solicitando productos más vendidos', { 
      limit, 
      startDate, 
      endDate,
      userId,
      requestingUserId: req.user?.id 
    });
    
    // Convertir parámetros a los tipos correctos
    const options = {
      limit: limit ? parseInt(limit) : 5
    };
    
    // Validar y convertir fechas si se proporcionan
    if (startDate) {
      const parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha de inicio inválido. Utilice YYYY-MM-DD'
        });
      }
      options.startDate = parsedStartDate;
    }
    
    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha de fin inválido. Utilice YYYY-MM-DD'
        });
      }
      
      // Establecer la hora al final del día para incluir todas las órdenes de esa fecha
      parsedEndDate.setHours(23, 59, 59, 999);
      options.endDate = parsedEndDate;
    }
    
    // Procesar userId si se proporciona
    if (userId) {
      const parsedUserId = parseInt(userId);
      if (isNaN(parsedUserId)) {
        return res.status(400).json({
          success: false,
          message: 'userId debe ser un número entero válido'
        });
      }
      
      // Verificar permisos - Un usuario normal solo puede ver sus propios datos
      if (req.user.rol_id !== 1 && parsedUserId !== req.user.id) {
        logger.warn('Intento de acceso no autorizado a datos de otro usuario', {
          requestedUserId: parsedUserId,
          requestingUserId: req.user.id,
          requestingUserRole: req.user.rol_id
        });
        
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para ver datos de otro usuario'
        });
      }
      
      options.userId = parsedUserId;
    }
    
    // Si el usuario no es administrador y no se especificó un userId, usar el del usuario actual
    if (req.user.rol_id !== 1 && !userId) {
      options.userId = req.user.id;
    }
    
    // Obtener productos más vendidos
    const topProducts = await Order.getTopSellingProducts(options);
    
    res.status(200).json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    logger.error('Error al obtener productos más vendidos', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos más vendidos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/monthly-stats:
 *   get:
 *     summary: Obtener estadísticas mensuales de pedidos
 *     description: Recupera el conteo de pedidos agrupados por mes para un usuario específico
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario para filtrar pedidos
 *       - in: query
 *         name: months
 *         required: false
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Número de meses hacia atrás para obtener datos
 *     responses:
 *       200:
 *         description: Estadísticas mensuales recuperadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         example: "Mar 2025"
 *                       count:
 *                         type: integer
 *                         example: 5
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos para ver estas estadísticas
 *       500:
 *         description: Error interno del servidor
 */
const getMonthlyStats = async (req, res) => {
  try {
    const { userId, months } = req.query;
    const requestingUser = req.user;
    
    logger.debug('Solicitando estadísticas mensuales de pedidos', { 
      userId, 
      months, 
      requestingUserId: requestingUser.id 
    });
    
    // Validar parámetros
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido o no proporcionado'
      });
    }
    
    // Validar el parámetro months si se proporciona
    const parsedMonths = months ? parseInt(months) : 6;
    if (isNaN(parsedMonths) || parsedMonths < 1 || parsedMonths > 24) {
      return res.status(400).json({
        success: false,
        message: 'El número de meses debe ser un entero entre 1 y 24'
      });
    }
    
    // Verificar permisos - solo el propio usuario o un administrador pueden ver sus estadísticas
    if (parseInt(userId) !== requestingUser.id && requestingUser.rol_id !== 1) {
      logger.warn('Intento de acceso no autorizado a estadísticas mensuales', {
        targetUserId: userId,
        requestingUserId: requestingUser.id,
        requestingUserRole: requestingUser.rol_id
      });

      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estas estadísticas'
      });
    }
    
    // Obtener las estadísticas mensuales
    const stats = await Order.getMonthlyStats(parseInt(userId), parsedMonths);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas mensuales de pedidos', {
      error: error.message,
      stack: error.stack,
      userId: req.query?.userId,
      requestingUserId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas mensuales de pedidos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * /api/orders/debug/{userId}:
 *   get:
 *     summary: Ejecutar diagnóstico SQL directo para órdenes de usuario
 *     description: Realiza una consulta SQL directa para obtener información detallada de todas las órdenes de un usuario
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario para diagnóstico
 *     responses:
 *       200:
 *         description: Resultados de diagnóstico obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 source:
 *                   type: string
 *                   example: "sql_direct"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores pueden usar esta función
 *       500:
 *         description: Error interno del servidor
 */
const debugUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user;
    
    if (user.rol_id !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden usar esta función de diagnóstico'
      });
    }
    
    logger.debug('Ejecutando consulta SQL directa para diagnóstico', { userId });
    
    // Ejecutar la consulta SQL directamente
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
    
    res.status(200).json({
      success: true,
      source: 'sql_direct',
      data: rows
    });
  } catch (error) {
    logger.error('Error en diagnóstico SQL', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error en diagnóstico',
      error: error.message
    });
  }
};

/**
 * @swagger
 * /api/orders/prices:
 *   post:
 *     summary: Obtener precios de productos con IVA para el cliente logueado
 *     description: Obtiene los precios de productos específicos según la lista de precios del cliente, incluyendo cálculo de IVA
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_codes
 *             properties:
 *               product_codes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de códigos de productos
 *                 example: ["PROD001", "PROD002"]
 *     responses:
 *       200:
 *         description: Precios obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       product_code:
 *                         type: string
 *                         example: "PROD001"
 *                       product_name:
 *                         type: string
 *                         example: "Producto de ejemplo"
 *                       base_price:
 *                         type: number
 *                         format: float
 *                         example: 100.00
 *                       tax_rate:
 *                         type: number
 *                         format: float
 *                         example: 0.19
 *                       tax_amount:
 *                         type: number
 *                         format: float
 *                         example: 19.00
 *                       total_price_with_tax:
 *                         type: number
 *                         format: float
 *                         example: 119.00
 *                 message:
 *                   type: string
 *                   example: "Precios obtenidos exitosamente"
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Token inválido
 *       500:
 *         description: Error interno del servidor
 */
const getProductPricesWithTax = async (req, res) => {
  try {
    const { product_codes } = req.body;
    const userId = req.user.id;

    if (!product_codes || !Array.isArray(product_codes) || product_codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de códigos de productos'
      });
    }

    const pricesWithTax = await Order.getProductPricesWithTax(userId, product_codes);

    res.json({
      success: true,
      data: pricesWithTax,
      message: 'Precios obtenidos exitosamente'
    });

  } catch (error) {
    logger.error('Error en getProductPricesWithTax', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
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
  debugUserOrders,
  getProductPricesWithTax 
};