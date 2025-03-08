// src/routes/sapSyncRoutes.js
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
 * /api/sap/sync:
 *   post:
 *     summary: Iniciar sincronización manual desde SAP B1
 *     description: Inicia una sincronización manual de productos desde SAP B1 hacia la WebApp
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: full
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Indica si se debe realizar una sincronización completa (true) o incremental (false, por defecto)
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
 * /api/sap/products/{productId}/sync:
 *   post:
 *     summary: Sincronizar producto específico hacia SAP B1
 *     description: Envía los cambios de un producto específico desde la WebApp hacia SAP B1
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del producto a sincronizar
 *     responses:
 *       200:
 *         description: Producto sincronizado exitosamente
 *       400:
 *         description: Producto no encontrado o sin código SAP
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/products/:productId/sync', 
  checkRole([1]), // Solo administradores
  sapSyncController.syncProductToSAP
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
 * /api/sap/group/{groupCode}/sync:
 *   post:
 *     summary: Sincronizar productos por grupo desde SAP B1
 *     description: Inicia una sincronización de productos de un grupo específico desde SAP B1 hacia la WebApp
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupCode
 *         schema:
 *           type: integer
 *         required: true
 *         description: Código del grupo de artículos a sincronizar (ej. 127)
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
router.post('/group/:groupCode/sync', 
  checkRole([1]), // Solo administradores
  sapSyncController.syncProductsByGroup
);

/**
 * @swagger
 * /api/sap/group/{groupCode}/status:
 *   get:
 *     summary: Obtener estado de sincronización de grupo
 *     description: Devuelve información sobre el estado de la sincronización de un grupo específico
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupCode
 *         schema:
 *           type: integer
 *         required: true
 *         description: Código del grupo de artículos (ej. 127)
 *     responses:
 *       200:
 *         description: Estado de sincronización del grupo
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/group/:groupCode/status', 
  checkRole([1]), // Solo administradores
  sapSyncController.getGroupSyncStatus
);

/**
 * @swagger
 * /api/sap/group/{groupCode}/config:
 *   post:
 *     summary: Configurar sincronización de grupo
 *     description: Configura la programación de sincronización para un grupo específico
 *     tags: [SAP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupCode
 *         schema:
 *           type: integer
 *         required: true
 *         description: Código del grupo de artículos (ej. 127)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schedule:
 *                 type: string
 *                 description: Programación en formato cron
 *               enabled:
 *                 type: boolean
 *                 description: Indica si la sincronización está habilitada
 *     responses:
 *       200:
 *         description: Configuración actualizada exitosamente
 *       400:
 *         description: Formato de programación inválido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/group/:groupCode/config', 
  checkRole([1]), // Solo administradores
  sapSyncController.configureGroupSync
);

module.exports = router;