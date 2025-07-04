const express = require('express');
const router = express.Router();
const sapSyncController = require('../controllers/sapSyncController');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeParams } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: SAP
 *   description: Endpoints para integración con SAP Business One
 */

// Aplicar middleware de autenticación y seguridad a todas las rutas
router.use(verifyToken);
router.use(sanitizeParams);
/**
 * @swagger
 * /api/sap/test:
 *   get:
 *     summary: Probar conexión con SAP B1
 *     description: Realiza una prueba de conexión con SAP B1 Service Layer
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conexión exitosa
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error de conexión con SAP B1
 */
router.get('/test', 
  checkRole([1]), // Solo administradores
  sapSyncController.testSapConnection
);
/**
 * @swagger
 * /api/sap/sync:
 *   post:
 *     summary: Iniciar sincronización manual desde SAP B1
 *     description: Inicia una sincronización completa de productos desde SAP B1 hacia la WebApp
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización iniciada exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/sync', 
  checkRole([1]), // Solo administradores
  sapSyncController.startSync
);

/**
 * @swagger
 * /api/sap/status:
 *   get:
 *     summary: Obtener estado de sincronización con SAP
 *     description: Devuelve información sobre el estado de la integración con SAP B1
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de sincronización
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/status', 
  checkRole([1]), // Solo administradores
  sapSyncController.getSyncStatus
);
/**
 * @swagger
 * /api/sap/analyze-view:
 *   get:
 *     summary: Analizar estructura de vista SAP
 *     description: Obtiene metadatos y muestra de datos para analizar la estructura de la vista
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Análisis completado
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error al analizar vista
 */
router.get('/analyze-view', 
  checkRole([1]), // Solo administradores
  sapSyncController.analyzeView
);
/**
 * @swagger
 * /api/sap/products/direct:
 *   get:
 *     summary: Obtener productos usando consulta SQL directa
 *     description: Obtiene productos de SAP B1 ejecutando la consulta SQL directamente sin usar la vista
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Número de registros a omitir (paginación)
 *       - in: query
 *         name: groupCode
 *         schema:
 *           type: integer
 *         description: Código del grupo de productos a filtrar
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Número máximo de registros a devolver
 *     responses:
 *       200:
 *         description: Productos obtenidos exitosamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error al obtener productos
 */
router.get('/products/direct', 
  checkRole([1]), // Solo administradores
  sapSyncController.getProductsDirectQuery
);
/**
 * @swagger
 * /api/sap/update-description:
 *   post:
 *     summary: Actualizar descripción de producto y sincronizar con SAP
 *     description: Actualiza el campo description en la BD local y Nombre Comercial en SAP B1
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - description
 *             properties:
 *               productId:
 *                 type: integer
 *                 description: ID del producto en la base de datos local
 *               description:
 *                 type: string
 *                 description: Nueva descripción para el producto
 *     responses:
 *       200:
 *         description: Descripción actualizada y sincronizada exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       404:
 *         description: Producto no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/update-description', 
  checkRole([1]), // Solo administradores
  sapSyncController.updateProductDescription
);
/**
 * @swagger
 * /api/sap/sync/group/{groupCode}:
 *   post:
 *     summary: Sincronizar productos por grupo específico
 *     description: Inicia una sincronización de productos de un grupo específico desde SAP B1 hacia la WebApp
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupCode
 *         required: true
 *         schema:
 *           type: integer
 *         description: Código del grupo de productos a sincronizar (ej 127)
 *         example: 127
 *     responses:
 *       200:
 *         description: Sincronización de grupo iniciada exitosamente
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
 *                   example: "Sincronización de productos del grupo 127 iniciada exitosamente"
 *       400:
 *         description: Código de grupo inválido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/sync/group/:groupCode', 
  checkRole([1]), // Solo administradores
  sapSyncController.syncProductsByGroup
);
module.exports = router;