// src/routes/priceListRoutes.js
const express = require('express');
const router = express.Router();
const priceListController = require('../controllers/priceListController');
// Debugging - verificar que el controlador se importó correctamente
console.log('=== DEBUGGING PRICE LIST CONTROLLER ===');
console.log('priceListController:', priceListController);
console.log('getAllPriceLists:', priceListController.getAllPriceLists);
console.log('getPriceListProducts:', priceListController.getPriceListProducts);
console.log('getProductPrice:', priceListController.getProductPrice);
console.log('getMultipleProductPrices:', priceListController.getMultipleProductPrices);
console.log('getPriceListStatistics:', priceListController.getPriceListStatistics);
console.log('validatePriceListInSap:', priceListController.validatePriceListInSap);
console.log('syncPriceListsFromSap:', priceListController.syncPriceListsFromSap);
console.log('getSyncSummary:', priceListController.getSyncSummary);
console.log('searchProductsInSap:', priceListController.searchProductsInSap);
console.log('=== END DEBUGGING ===');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeBody, sanitizeParams, sanitizeQuery } = require('../middleware/security');
const { body, param, query } = require('express-validator');

/**
 * @swagger
 * components:
 *   schemas:
 *     PriceList:
 *       type: object
 *       properties:
 *         price_list_id:
 *           type: integer
 *           description: ID único de la entrada de lista de precios
 *         price_list_code:
 *           type: string
 *           description: Código de la lista de precios (ej. ORO, PLATA, BRONCE)
 *         price_list_name:
 *           type: string
 *           description: Nombre de la lista de precios
 *         product_code:
 *           type: string
 *           description: Código del producto
 *         product_name:
 *           type: string
 *           description: Nombre del producto
 *         price:
 *           type: number
 *           format: decimal
 *           description: Precio del producto en la lista
 *         currency:
 *           type: string
 *           description: Moneda del precio
 *         sap_price_list_no:
 *           type: integer
 *           description: Número de lista de precios en SAP
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *     
 *     PriceListSummary:
 *       type: object
 *       properties:
 *         price_list_code:
 *           type: string
 *         price_list_name:
 *           type: string
 *         sap_price_list_no:
 *           type: integer
 *         product_count:
 *           type: integer
 *         last_sync:
 *           type: string
 *           format: date-time
 *
 *     SyncRequest:
 *       type: object
 *       properties:
 *         priceListNo:
 *           type: integer
 *           description: Número específico de lista de precios a sincronizar (opcional)
 *         batchSize:
 *           type: integer
 *           default: 50
 *           description: Tamaño del lote para sincronización
 *         maxItems:
 *           type: integer
 *           description: Número máximo de items a sincronizar (opcional)
 */

/**
 * @swagger
 * /api/price-lists:
 *   get:
 *     summary: Obtener todas las listas de precios disponibles
 *     description: Recupera un resumen de todas las listas de precios sincronizadas desde SAP
 *     tags: [Price Lists]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listas de precios obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceListSummary'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/',
  verifyToken,
  (req, res) => {
    if (typeof priceListController.getAllPriceLists === 'function') {
      return priceListController.getAllPriceLists(req, res);
    } else {
      console.error('getAllPriceLists is not a function:', typeof priceListController.getAllPriceLists);
      res.status(500).json({ error: 'Controller method not available' });
    }
  }
);

/**
 * @swagger
 * /api/price-lists/{priceListCode}/products:
 *   get:
 *     summary: Obtener productos de una lista de precios específica
 *     description: Recupera todos los productos y sus precios de una lista específica con paginación
 *     tags: [Price Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: priceListCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código de la lista de precios (ej. ORO, PLATA, BRONCE)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número de elementos por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Término de búsqueda para filtrar productos
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           default: product_code
 *         description: Campo por el cual ordenar
 *       - in: query
 *         name: orderDirection
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: ASC
 *         description: Dirección del ordenamiento
 *     responses:
 *       200:
 *         description: Productos obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 priceListCode:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceList'
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:priceListCode/products',
  verifyToken,
  [
    param('priceListCode')
      .notEmpty()
      .withMessage('Código de lista de precios es requerido')
      .isLength({ min: 1, max: 50 })
      .withMessage('Código de lista de precios debe tener entre 1 y 50 caracteres'),
    query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe ser entre 1 y 100'),
    query('search').optional().isLength({ max: 100 }).withMessage('Búsqueda no puede exceder 100 caracteres'),
    query('orderBy').optional().isIn(['product_code', 'product_name', 'price', 'updated_at']).withMessage('Campo de ordenamiento inválido'),
    query('orderDirection').optional().isIn(['ASC', 'DESC']).withMessage('Dirección de ordenamiento debe ser ASC o DESC')
  ],
  sanitizeParams,
  sanitizeQuery,
  priceListController.getPriceListProducts
);

/**
 * @swagger
 * /api/price-lists/{priceListCode}/products/{productCode}/price:
 *   get:
 *     summary: Obtener precio específico de un producto
 *     description: Recupera el precio de un producto específico en una lista de precios
 *     tags: [Price Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: priceListCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código de la lista de precios
 *       - in: path
 *         name: productCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código del producto
 *     responses:
 *       200:
 *         description: Precio obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PriceList'
 *       404:
 *         description: Precio no encontrado
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:priceListCode/products/:productCode/price',
  verifyToken,
  [
    param('priceListCode')
      .notEmpty()
      .withMessage('Código de lista de precios es requerido')
      .isLength({ min: 1, max: 50 })
      .withMessage('Código de lista de precios debe tener entre 1 y 50 caracteres'),
    param('productCode')
      .notEmpty()
      .withMessage('Código de producto es requerido')
      .isLength({ min: 1, max: 100 })
      .withMessage('Código de producto debe tener entre 1 y 100 caracteres')
  ],
  sanitizeParams,
  priceListController.getProductPrice
);

/**
 * @swagger
 * /api/price-lists/{priceListCode}/products/prices:
 *   post:
 *     summary: Obtener precios de múltiples productos
 *     description: Recupera los precios de varios productos en una lista específica
 *     tags: [Price Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: priceListCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código de la lista de precios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productCodes
 *             properties:
 *               productCodes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de códigos de productos
 *                 example: ["PROD001", "PROD002", "PROD003"]
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
 *                 priceListCode:
 *                   type: string
 *                 requestedProducts:
 *                   type: integer
 *                 foundPrices:
 *                   type: integer
 *                 productsWithoutPrice:
 *                   type: array
 *                   items:
 *                     type: string
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       price:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       lastUpdate:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/:priceListCode/products/prices',
  verifyToken,
  [
    param('priceListCode')
      .notEmpty()
      .withMessage('Código de lista de precios es requerido')
      .isLength({ min: 1, max: 50 })
      .withMessage('Código de lista de precios debe tener entre 1 y 50 caracteres'),
    body('productCodes')
      .isArray({ min: 1, max: 100 })
      .withMessage('Se requiere un array de códigos de productos (máximo 100)')
      .custom((productCodes) => {
        if (productCodes.some(code => typeof code !== 'string' || code.length === 0 || code.length > 100)) {
          throw new Error('Todos los códigos de productos deben ser strings no vacíos de máximo 100 caracteres');
        }
        return true;
      })
  ],
  sanitizeParams,
  sanitizeBody,
  priceListController.getMultipleProductPrices
);

/**
 * @swagger
 * /api/price-lists/{priceListCode}/statistics:
 *   get:
 *     summary: Obtener estadísticas de una lista de precios
 *     description: Recupera estadísticas como total de productos, precios promedio, etc.
 *     tags: [Price Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: priceListCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código de la lista de precios
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 priceListCode:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_products:
 *                       type: integer
 *                     products_with_price:
 *                       type: integer
 *                     average_price:
 *                       type: number
 *                     min_price:
 *                       type: number
 *                     max_price:
 *                       type: number
 *                     last_sync:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:priceListCode/statistics',
  verifyToken,
  [
    param('priceListCode')
      .notEmpty()
      .withMessage('Código de lista de precios es requerido')
      .isLength({ min: 1, max: 50 })
      .withMessage('Código de lista de precios debe tener entre 1 y 50 caracteres')
  ],
  sanitizeParams,
  priceListController.getPriceListStatistics
);
/**
 * @swagger
 * /api/price-lists/sync:
 *   post:
 *     summary: Sincronizar listas de precios desde SAP
 *     description: Sincroniza las listas de precios desde SAP B1 a la base de datos local
 *     tags: [Price Lists, SAP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SyncRequest'
 *     responses:
 *       200:
 *         description: Sincronización completada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         priceListsProcessed:
 *                           type: integer
 *                         itemsCreated:
 *                           type: integer
 *                         itemsUpdated:
 *                           type: integer
 *                         itemsDeactivated:
 *                           type: integer
 *                         errors:
 *                           type: array
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/sync',
  verifyToken,
  checkRole([1]), // Solo administradores
  [
    body('priceListNo')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Número de lista de precios debe ser un entero positivo'),
    body('batchSize')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Tamaño de lote debe ser entre 1 y 200'),
    body('maxItems')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Máximo de items debe ser un entero positivo')
  ],
  sanitizeBody,
  priceListController.syncPriceListsFromSap
);

/**
 * @swagger
 * /api/price-lists/sync/summary:
 *   get:
 *     summary: Obtener resumen de sincronización
 *     description: Recupera un resumen del estado de sincronización entre SAP y la base de datos local
 *     tags: [Price Lists, SAP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sapPriceLists:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           priceListNo:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           active:
 *                             type: boolean
 *                           currency:
 *                             type: string
 *                     localPriceLists:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PriceListSummary'
 *                     syncStatus:
 *                       type: object
 *                       properties:
 *                         totalSapLists:
 *                           type: integer
 *                         totalLocalLists:
 *                           type: integer
 *                         lastSyncDate:
 *                           type: string
 *                           format: date-time
 *                         unsyncedLists:
 *                           type: array
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/sync/summary',
  verifyToken,
  checkRole([1]), // Solo administradores
  priceListController.getSyncSummary
);

/**
 * @swagger
 * /api/price-lists/sap/search:
 *   get:
 *     summary: Buscar productos en SAP
 *     description: Busca productos directamente en SAP por nombre o código
 *     tags: [Price Lists, SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: searchTerm
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Término de búsqueda (mínimo 2 caracteres)
 *       - in: query
 *         name: priceListNo
 *         required: true
 *         schema:
 *           type: integer
 *         description: Número de lista de precios en SAP
 *     responses:
 *       200:
 *         description: Búsqueda completada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 searchTerm:
 *                   type: string
 *                 priceListNo:
 *                   type: integer
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       itemCode:
 *                         type: string
 *                       itemName:
 *                         type: string
 *                       price:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       hasPrice:
 *                         type: boolean
 *       400:
 *         description: Parámetros de búsqueda inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/sap/search',
  verifyToken,
  [
    query('searchTerm')
      .notEmpty()
      .withMessage('Término de búsqueda es requerido')
      .isLength({ min: 2, max: 100 })
      .withMessage('Término de búsqueda debe tener entre 2 y 100 caracteres'),
    query('priceListNo')
      .notEmpty()
      .withMessage('Número de lista de precios es requerido')
      .isInt({ min: 1 })
      .withMessage('Número de lista de precios debe ser un entero positivo')
  ],
  sanitizeQuery,
  priceListController.searchProductsInSap
);

/**
 * @swagger
 * /api/price-lists/sap/validate/{priceListNo}:
 *   get:
 *     summary: Validar lista de precios en SAP
 *     description: Verifica si una lista de precios existe y está activa en SAP
 *     tags: [Price Lists, SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: priceListNo
 *         required: true
 *         schema:
 *           type: integer
 *         description: Número de lista de precios en SAP
 *     responses:
 *       200:
 *         description: Lista de precios válida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     priceListNo:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     active:
 *                       type: boolean
 *                     currency:
 *                       type: string
 *       404:
 *         description: Lista de precios no encontrada o inactiva
 *       400:
 *         description: Número de lista de precios inválido
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/sap/validate/:priceListNo',
  verifyToken,
  [
    param('priceListNo')
      .notEmpty()
      .withMessage('Número de lista de precios es requerido')
      .isInt({ min: 1 })
      .withMessage('Número de lista de precios debe ser un entero positivo')
  ],
  sanitizeParams,
  priceListController.validatePriceListInSap
);

module.exports = router;