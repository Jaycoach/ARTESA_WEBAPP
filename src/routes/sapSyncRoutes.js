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

module.exports = router;