const express = require('express');
const router = express.Router();
const branchOrderController = require('../controllers/branchOrderController');
const branchAuthController = require('../controllers/branchAuthController');
const { verifyBranchToken } = require('../middleware/auth');
const { sanitizeBody, sanitizeParams, sanitizeQuery } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: BranchOrders
 *   description: Gestión de órdenes desde el contexto de sucursales
 */

// Aplicar middleware de autenticación de sucursales a todas las rutas
router.use(verifyBranchToken);

// Aplicar sanitización
router.use(sanitizeBody, sanitizeParams, sanitizeQuery);

/**
 * @swagger
 * /api/branch-orders:
 *   post:
 *     summary: Crear una nueva orden desde sucursal
 *     description: Crea una nueva orden de venta asociada a la sucursal autenticada
 *     tags: [BranchOrders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - products
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: ID del usuario del cliente principal
 *                 example: 5
 *               delivery_date:
 *                 type: string
 *                 format: date
 *                 description: Fecha de entrega deseada
 *                 example: "2025-08-20"
 *               comments:
 *                 type: string
 *                 description: Comentarios adicionales
 *                 example: "Entrega en horario de oficina"
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_id
 *                     - quantity
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       description: ID del producto
 *                       example: 123
 *                     quantity:
 *                       type: integer
 *                       description: Cantidad solicitada
 *                       example: 10
 *     responses:
 *       201:
 *         description: Orden creada exitosamente
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
 *                   example: "Orden creada exitosamente"
 *                 data:
 *                   type: object
 *                   description: Detalles de la orden creada
 *       400:
 *         description: Datos inválidos o usuario no pertenece al cliente
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.post('/', branchOrderController.createOrder);

/**
 * @swagger
 * /api/branch-orders/orders:
 *   get:
 *     summary: Obtener órdenes creadas por la sucursal
 *     description: Recupera la lista de órdenes creadas por la sucursal autenticada
 *     tags: [BranchOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *         description: Filtrar por estado de la orden (opcional)
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial (opcional)
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final (opcional)
 *     responses:
 *       200:
 *         description: Lista de órdenes obtenida exitosamente
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
 *                       order_date:
 *                         type: string
 *                         format: date-time
 *                       delivery_date:
 *                         type: string
 *                         format: date
 *                       status_name:
 *                         type: string
 *                       user_name:
 *                         type: string
 *                       total_amount:
 *                         type: number
 *                         format: float
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.get('/orders', branchOrderController.getOrdersForBranch);


/**
 * @swagger
 * /api/branch-orders/products:
 *   get:
 *     summary: Obtener productos disponibles para la sucursal
 *     description: Recupera la lista de productos con precios específicos para el cliente de la sucursal
 *     tags: [BranchOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, código SAP o descripción
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: Filtrar por categoría (sap_group)
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Solo productos activos
 *     responses:
 *       200:
 *         description: Lista de productos obtenida exitosamente
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
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       sap_code:
 *                         type: string
 *                       current_price:
 *                         type: number
 *                         format: float
 *                         description: Precio según la lista del cliente
 *                       stock:
 *                         type: integer
 *                       image_url:
 *                         type: string
 *                       price_list1:
 *                         type: number
 *                         format: float
 *                       price_list2:
 *                         type: number
 *                         format: float
 *                       price_list3:
 *                         type: number
 *                         format: float
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.get('/products', branchOrderController.getProductsForBranch);


/**
 * @swagger
 * /api/branch-orders/products/inherited:
 *   get:
 *     summary: Obtener productos con precios heredados del cliente principal
 *     description: Recupera productos con precios que la sucursal hereda del cliente principal, incluyendo información de herencia
 *     tags: [BranchOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, código SAP o descripción
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoría de producto
 *     responses:
 *       200:
 *         description: Productos con información de herencia de precios
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
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           sap_code:
 *                             type: string
 *                           inherited_price:
 *                             type: number
 *                             format: float
 *                           custom_price:
 *                             type: number
 *                             format: float
 *                             nullable: true
 *                           price_inheritance:
 *                             type: object
 *                             properties:
 *                               source:
 *                                 type: string
 *                                 enum: [custom, inherited]
 *                               inherited_from:
 *                                 type: string
 *                               client_price_list_code:
 *                                 type: string
 *                     price_inheritance_info:
 *                       type: object
 *                       properties:
 *                         client_id:
 *                           type: integer
 *                         client_price_list_code:
 *                           type: string
 *                         company_name:
 *                           type: string
 *                         branch_id:
 *                           type: integer
 *                         price_list_source:
 *                           type: string
 *                           enum: [price_list, price_list_code, default]
 *                         raw_values:
 *                           type: object
 *                           properties:
 *                             price_list:
 *                               type: integer
 *                               nullable: true
 *                             price_list_code:
 *                               type: string
 *                               nullable: true
 *       404:
 *         description: Cliente principal no encontrado
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.get('/products/inherited', branchOrderController.getProductsForBranch);

/**
 * @swagger
 * /api/branch-orders/client/price-list-code:
 *   get:
 *     summary: Obtener el código de lista de precios del cliente principal
 *     description: Recupera el price_list_code que la sucursal hereda del cliente principal
 *     tags: [BranchOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Código de lista de precios obtenido exitosamente
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
 *                     price_list_code:
 *                       type: string
 *                       example: "2"
 *                       description: "Código final de lista de precios (prioriza price_list sobre price_list_code)"
 *                     price_list_source:
 *                       type: string
 *                       enum: [price_list, price_list_code, default]
 *                       example: "price_list"
 *                       description: "Origen del código de lista de precios utilizado"
 *                     raw_values:
 *                       type: object
 *                       properties:
 *                         price_list:
 *                           type: integer
 *                           nullable: true
 *                           example: 2
 *                           description: "Valor original del campo price_list"
 *                         price_list_code:
 *                           type: string
 *                           nullable: true
 *                           example: "ORO"
 *                           description: "Valor original del campo price_list_code"
 *                     company_name:
 *                       type: string
 *                       example: "Empresa Principal S.A.S"
 *       404:
 *         description: Cliente principal no encontrado
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client/price-list-code', branchAuthController.getClientPriceListCode);

/**
 * @swagger
 * /api/branch-orders/{orderId}:
 *   get:
 *     summary: Obtener detalles de una orden específica
 *     description: Recupera los detalles completos de una orden que pertenece a la sucursal autenticada
 *     tags: [BranchOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden
 *     responses:
 *       200:
 *         description: Detalles de la orden obtenidos exitosamente
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
 *                     order_id:
 *                       type: integer
 *                     order_date:
 *                       type: string
 *                       format: date-time
 *                     delivery_date:
 *                       type: string
 *                       format: date-time
 *                     total_amount:
 *                       type: number
 *                       format: float
 *                     status_name:
 *                       type: string
 *                     user_name:
 *                       type: string
 *                     branch_name:
 *                       type: string
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_id:
 *                             type: integer
 *                           product_name:
 *                             type: string
 *                           quantity:
 *                             type: integer
 *                           unit_price:
 *                             type: number
 *                             format: float
 *                           line_total:
 *                             type: number
 *                             format: float
 *                     notes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           note_id:
 *                             type: integer
 *                           note:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       404:
 *         description: Orden no encontrada o no pertenece a esta sucursal
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:orderId', branchOrderController.getOrderDetails);

/**
 * @swagger
 * /api/branch-orders/{orderId}/status:
 *   put:
 *     summary: Actualizar el estado de una orden
 *     description: Actualiza el estado de una orden (solo ciertas transiciones permitidas para sucursales)
 *     tags: [BranchOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status_id
 *             properties:
 *               status_id:
 *                 type: integer
 *                 description: Nuevo estado de la orden
 *                 example: 5
 *               note:
 *                 type: string
 *                 description: Nota opcional sobre el cambio de estado
 *                 example: "Cancelada por solicitud del cliente"
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente
 *       400:
 *         description: Transición de estado no permitida
 *       404:
 *         description: Orden no encontrada
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.put('/:orderId/status', branchOrderController.updateOrderStatus);

module.exports = router;