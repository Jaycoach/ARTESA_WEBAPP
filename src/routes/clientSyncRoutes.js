const express = require('express');
const router = express.Router();
const clientSyncController = require('../controllers/clientSyncController');
const { verifyToken, checkRole } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: ClientSync
 *   description: Endpoints para sincronización de clientes con SAP Business One
 */

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

// Solo los administradores pueden acceder a estas rutas
router.use(checkRole([1]));

/**
 * @swagger
 * /api/client-sync/status:
 *   get:
 *     summary: Obtener estado de sincronización de clientes
 *     description: Devuelve información sobre el estado de la sincronización de clientes con SAP B1
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de sincronización de clientes
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/status', clientSyncController.getSyncStatus);

/**
 * @swagger
 * /api/client-sync/sync:
 *   post:
 *     summary: Iniciar sincronización manual de clientes
 *     description: Inicia una sincronización de clientes con SAP B1 para activar usuarios
 *     tags: [ClientSync]
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
router.post('/sync', clientSyncController.syncClients);

/**
 * @swagger
 * /api/client-sync/clients/pending:
 *   get:
 *     summary: Obtener clientes pendientes de activación
 *     description: Devuelve la lista de clientes que están sincronizados con SAP pero aún no activados
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes pendientes de activación
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/clients/pending', clientSyncController.getPendingClients);

/**
 * @swagger
 * /api/client-sync/client/{userId}/activate:
 *   post:
 *     summary: Activar un cliente manualmente
 *     description: Activa un cliente específico sin verificar su estado en SAP
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a activar
 *     responses:
 *       200:
 *         description: Cliente activado exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       404:
 *         description: Cliente no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/client/:userId/activate', clientSyncController.activateClient);

/**
 * @swagger
 * /api/client-sync/sync-all:
 *   post:
 *     summary: Iniciar sincronización manual completa con SAP
 *     description: Actualiza todos los perfiles de clientes con la información más reciente de SAP. Esta operación se ejecuta automáticamente a las 3 AM todos los días, pero puede ser iniciada manualmente.
 *     tags: [ClientSync]
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
router.post('/sync-all', 
  checkRole([1]), // Solo administradores
  clientSyncController.syncAllClients
);

module.exports = router;