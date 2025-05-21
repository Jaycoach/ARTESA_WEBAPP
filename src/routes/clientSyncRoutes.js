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
 * Sincronizar manualmente un cliente específico con SAP
 * @route POST /api/client-sync/client/{userId}/sync
 * @group ClientSync - Operaciones relacionadas con sincronización de clientes
 * @security bearerAuth
 * @param {number} userId.path.required - ID del usuario a sincronizar
 * @returns {object} 200 - Cliente sincronizado exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos para realizar esta acción
 * @returns {object} 404 - Cliente no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/client/:userId/sync', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  clientSyncController.syncClient
);

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
 * /api/client-sync/sync-institutional:
 *   post:
 *     summary: Iniciar sincronización de clientes institucionales
 *     description: Sincroniza clientes del grupo Institucional desde SAP B1 con sus sucursales
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
router.post('/sync-institutional', 
  checkRole([1]), // Solo administradores
  clientSyncController.syncInstitutionalClients
);

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

/**
 * @swagger
 * /api/client-sync/branches/validate:
 *   get:
 *     summary: Validar sucursales de clientes institucionales
 *     description: Obtiene una lista de las sucursales encontradas en SAP para clientes institucionales y compara con las almacenadas localmente
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: ID del cliente específico para validar (opcional)
 *       - in: query
 *         name: cardCode
 *         schema:
 *           type: string
 *         description: Código SAP del cliente específico para validar (opcional)
 *     responses:
 *       200:
 *         description: Validación de sucursales completada exitosamente
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
 *                     totalClients:
 *                       type: integer
 *                       example: 15
 *                     clientsWithBranches:
 *                       type: integer
 *                       example: 12
 *                     totalSapBranches:
 *                       type: integer
 *                       example: 45
 *                     totalLocalBranches:
 *                       type: integer
 *                       example: 40
 *                     missingBranches:
 *                       type: integer
 *                       example: 5
 *                     extraBranches:
 *                       type: integer
 *                       example: 0
 *                     clientDetails:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           clientId:
 *                             type: integer
 *                           cardCode:
 *                             type: string
 *                           companyName:
 *                             type: string
 *                           sapBranches:
 *                             type: array
 *                           localBranches:
 *                             type: array
 *                           missing:
 *                             type: array
 *                           extra:
 *                             type: array
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/branches/validate', 
  checkRole([1]), // Solo administradores
  clientSyncController.validateClientBranches
);

/**
 * @swagger
 * /api/client-sync/branches/sync:
 *   post:
 *     summary: Sincronizar sucursales de clientes institucionales
 *     description: Sincroniza las sucursales de clientes institucionales desde SAP B1 hacia la base de datos local
 *     tags: [ClientSync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: integer
 *                 description: ID del cliente específico para sincronizar (opcional)
 *               cardCode:
 *                 type: string
 *                 description: Código SAP del cliente específico para sincronizar (opcional)
 *               forceUpdate:
 *                 type: boolean
 *                 description: Forzar actualización de sucursales existentes
 *                 default: false
 *     responses:
 *       200:
 *         description: Sincronización de sucursales completada exitosamente
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
 *                   example: "Sincronización de sucursales completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalClients:
 *                       type: integer
 *                       example: 15
 *                     totalBranches:
 *                       type: integer
 *                       example: 45
 *                     created:
 *                       type: integer
 *                       example: 5
 *                     updated:
 *                       type: integer
 *                       example: 10
 *                     errors:
 *                       type: integer
 *                       example: 0
 *                     skipped:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.post('/branches/sync', 
  checkRole([1]), // Solo administradores
  clientSyncController.syncClientBranches
);

module.exports = router;