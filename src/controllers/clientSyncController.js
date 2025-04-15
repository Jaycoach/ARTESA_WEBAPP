const { createContextLogger } = require('../config/logger');
const sapServiceManager = require('../services/SapServiceManager');
const pool = require('../config/db');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ClientSyncController');

/**
 * Controlador para operaciones de sincronización de clientes con SAP B1
 */
class ClientSyncController {
  /**
   * @swagger
   * /api/client-sync/status:
   *   get:
   *     summary: Obtener estado de sincronización de clientes con SAP
   *     description: Devuelve información sobre el estado de la sincronización de clientes con SAP B1
   *     tags: [ClientSync]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Estado de sincronización de clientes
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
   *                     lastSyncTime:
   *                       type: string
   *                       format: date-time
   *                       example: "2025-03-08T12:00:00Z"
   *                     initialized:
   *                       type: boolean
   *                       example: true
   *                     syncSchedule:
   *                       type: string
   *                       example: "0 * 2 6-20 * * *"
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async getSyncStatus(req, res) {
    try {
      logger.debug('Obteniendo estado de sincronización de clientes con SAP B1', { 
        userId: req.user?.id 
      });

      // Obtener estadísticas de clientes
      const { rows } = await pool.query(`
        SELECT 
          COUNT(*) AS total_clients,
          SUM(CASE WHEN u.is_active = true THEN 1 ELSE 0 END) AS active_clients,
          SUM(CASE WHEN cp.sap_lead_synced = true THEN 1 ELSE 0 END) AS sap_synced_clients
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
      `);

      // Obtener clientes pendientes de activación
      const pendingQuery = `
        SELECT COUNT(*) AS pending_clients
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.cardcode_sap IS NOT NULL 
        AND cp.sap_lead_synced = true
        AND u.is_active = false
      `;
      
      const pendingResult = await pool.query(pendingQuery);

      const syncStatus = sapServiceManager.getSyncStatus();
      res.status(200).json({
        success: true,
        data: {
          lastSyncTime: syncStatus.clients.lastSyncTime,
          initialized: syncStatus.initialized,
          syncSchedule: syncStatus.clients.syncSchedule,
          stats: {
            totalClients: parseInt(rows[0].total_clients),
            activeClients: parseInt(rows[0].active_clients),
            sapSyncedClients: parseInt(rows[0].sap_synced_clients),
            pendingActivation: parseInt(pendingResult.rows[0].pending_clients)
          }
        }
      });
    } catch (error) {
      logger.error('Error al obtener estado de sincronización de clientes', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado de sincronización de clientes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/client-sync/sync:
   *   post:
   *     summary: Iniciar sincronización manual de clientes con SAP
   *     description: Inicia una sincronización de clientes con SAP B1 para activar usuarios
   *     tags: [ClientSync]
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
   *                   example: Sincronización de clientes iniciada exitosamente
   *                 data:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                       example: 5
   *                     activated:
   *                       type: integer
   *                       example: 2
   *                     errors:
   *                       type: integer
   *                       example: 0
   *                     skipped:
   *                       type: integer
   *                       example: 3
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async syncClients(req, res) {
    try {
      logger.info('Iniciando sincronización manual de clientes con SAP B1', { 
        userId: req.user?.id
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de sincronización manual');
        await sapServiceManager.initialize();
      }

      // Ejecutar sincronización
      const results = await sapServiceManager.clientService.syncClientsWithSAP();
      
      res.status(200).json({
        success: true,
        message: 'Sincronización de clientes completada exitosamente',
        data: results
      });
    } catch (error) {
      logger.error('Error al iniciar sincronización manual de clientes', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al iniciar sincronización de clientes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

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
   *                       client_id:
   *                         type: integer
   *                         example: 1
   *                       user_id:
   *                         type: integer
   *                         example: 5
   *                       company_name:
   *                         type: string
   *                         example: "Empresa ABC"
   *                       cardcode_sap:
   *                         type: string
   *                         example: "C1234567890"
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async getPendingClients(req, res) {
    try {
      logger.debug('Obteniendo clientes pendientes de activación', { 
        userId: req.user?.id 
      });

      // Consultar clientes pendientes de activación
      const query = `
        SELECT 
          cp.client_id, 
          cp.user_id, 
          cp.company_name, 
          cp.contact_name, 
          cp.contact_email,
          cp.cardcode_sap, 
          cp.tax_id,
          u.name as user_name,
          u.mail as user_email
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.cardcode_sap IS NOT NULL 
        AND cp.sap_lead_synced = true
        AND u.is_active = false
        ORDER BY cp.updated_at DESC
      `;
      
      const { rows } = await pool.query(query);
      
      res.status(200).json({
        success: true,
        data: rows
      });
    } catch (error) {
      logger.error('Error al obtener clientes pendientes de activación', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener clientes pendientes de activación',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

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
   *                   example: Cliente activado exitosamente
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       404:
   *         description: Cliente no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  async activateClient(req, res) {
    try {
      const { userId } = req.params;
      
      logger.info('Activando cliente manualmente', { 
        userId,
        adminId: req.user?.id
      });

      // Verificar que el cliente existe
      const clientQuery = `
        SELECT 
          cp.client_id, 
          cp.user_id, 
          cp.company_name,
          cp.cardcode_sap,
          u.is_active
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1
      `;
      
      const { rows } = await pool.query(clientQuery, [userId]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      const client = rows[0];
      
      // Verificar si ya está activado
      if (client.is_active) {
        return res.status(200).json({
          success: true,
          message: 'El cliente ya está activado',
          data: {
            userId: parseInt(userId),
            clientId: client.client_id,
            companyName: client.company_name,
            alreadyActive: true
          }
        });
      }
      
      // Activar al cliente
      await pool.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);
      
      logger.info('Cliente activado manualmente', {
        userId,
        clientId: client.client_id,
        adminId: req.user?.id
      });
      
      res.status(200).json({
        success: true,
        message: 'Cliente activado exitosamente',
        data: {
          userId: parseInt(userId),
          clientId: client.client_id,
          companyName: client.company_name
        }
      });
    } catch (error) {
      logger.error('Error al activar cliente manualmente', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId,
        adminId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al activar cliente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
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
 *                   example: "Sincronización completa de clientes completada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     updated:
 *                       type: integer
 *                       example: 20
 *                     errors:
 *                       type: integer
 *                       example: 2
 *                     skipped:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
  async syncAllClients(req, res) {
    try {
      logger.info('Iniciando sincronización manual completa de clientes con SAP B1', { 
        userId: req.user?.id
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de sincronización manual completa');
        await sapServiceManager.initialize();
      }

      // Ejecutar sincronización completa
      const results = await sapServiceManager.clientService.syncAllClientsWithSAP();
      
      res.status(200).json({
        success: true,
        message: 'Sincronización completa de clientes completada exitosamente',
        data: results
      });
    } catch (error) {
      logger.error('Error al iniciar sincronización manual completa de clientes', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al iniciar sincronización completa de clientes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Crear instancia del controlador
const clientSyncController = new ClientSyncController();

// Exportar métodos del controlador
module.exports = {
  getSyncStatus: clientSyncController.getSyncStatus,
  syncClients: clientSyncController.syncClients,
  syncAllClients: clientSyncController.syncAllClients,
  getPendingClients: clientSyncController.getPendingClients,
  activateClient: clientSyncController.activateClient
};