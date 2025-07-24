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
      const results = await sapServiceManager.syncClients();
      
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
        cp.nit_number,
        cp.verification_digit,
        cp.clientprofilecode_sap,
        cp.sap_lead_synced,
        u.name as user_name,
        u.mail as user_email
      FROM client_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE (
        -- Clientes ya sincronizados pero no activados
        (cp.cardcode_sap IS NOT NULL AND cp.sap_lead_synced = true AND u.is_active = false)
        OR 
        -- Clientes pendientes de sincronización inicial con SAP
        (cp.nit_number IS NOT NULL AND (cp.cardcode_sap IS NULL OR cp.sap_lead_synced = false) AND u.is_active = false)
      )
      ORDER BY cp.updated_at DESC
    `;
      
      const { rows } = await pool.query(query);
      
      // Clasificar los resultados
      const result = {
        pendingActivation: rows.filter(r => r.cardcode_sap && r.sap_lead_synced && !r.is_active),
        pendingSynchronization: rows.filter(r => r.nit_number && (!r.cardcode_sap || !r.sap_lead_synced))
      };
      
      res.status(200).json({
        success: true,
        data: rows,
        categories: result
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

  /**
   * Sincroniza un cliente específico con SAP
   */
  async syncClient(req, res) {
    try {
      const { userId } = req.params;
      
      logger.info('Sincronizando cliente específico con SAP', { 
        userId,
        adminId: req.user?.id
      });

      // Verificar que el cliente existe
      const query = `
        SELECT 
          cp.*,
          u.name,
          u.mail,
          u.is_active
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      const clientProfile = rows[0];
      
      // Verificar que tiene datos necesarios para sincronización
      if (!clientProfile.nit_number || clientProfile.verification_digit === undefined) {
        return res.status(400).json({
          success: false,
          message: 'El cliente no tiene NIT o dígito de verificación, que son requeridos para la sincronización'
        });
      }
      
      const sapServiceManager = require('../services/SapServiceManager');
      
      // Asegurar que el servicio está inicializado
      if (!sapServiceManager.initialized) {
        await sapServiceManager.initialize();
      }
      
      // Sincronizar el cliente con SAP
      const result = await sapServiceManager.createOrUpdateLead(clientProfile);
      
      if (result.success) {
        logger.info('Cliente sincronizado exitosamente con SAP', {
          userId,
          cardCode: result.cardCode,
          isNew: result.isNew
        });
        
        return res.status(200).json({
          success: true,
          message: 'Cliente sincronizado exitosamente con SAP',
          data: {
            userId: parseInt(userId),
            cardCode: result.cardCode,
            isNew: result.isNew
          }
        });
      } else {
        logger.error('Error al sincronizar cliente con SAP', {
          userId,
          error: result.error
        });
        
        return res.status(500).json({
          success: false,
          message: 'Error al sincronizar cliente con SAP',
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Error al sincronizar cliente con SAP', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId,
        adminId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar cliente con SAP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Simula la sincronización con SAP para un cliente específico
   */
  async simulateSapSync(req, res) {
    try {
      const { userId } = req.params;
      const { cardType = 'Customer', activateUser = true } = req.body;
      
      logger.info('Simulando sincronización SAP para cliente', { 
        userId,
        cardType,
        activateUser,
        adminId: req.user?.id
      });

      // Verificar que el cliente existe y tiene perfil
      const query = `
        SELECT 
          cp.*,
          u.name,
          u.mail,
          u.is_active
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado o sin perfil de cliente'
        });
      }
      
      const clientProfile = rows[0];
      
      // Verificar que tiene datos necesarios para la simulación
      if (!clientProfile.nit_number || clientProfile.verification_digit === undefined) {
        return res.status(400).json({
          success: false,
          message: 'El cliente no tiene NIT o dígito de verificación, que son requeridos para la simulación'
        });
      }
      
      // Generar CardCode si no existe
      let cardCode = clientProfile.cardcode_sap;
      if (!cardCode) {
        cardCode = `CI${clientProfile.nit_number}`;
      }
      
      // Iniciar transacción para la simulación
      const dbClient = await pool.connect();
      try {
        await dbClient.query('BEGIN');
        
        // Actualizar el perfil del cliente con datos simulados de SAP
        await dbClient.query(
          `UPDATE client_profiles 
          SET 
            cardcode_sap = $1,
            sap_lead_synced = true,
            updated_at = CURRENT_TIMESTAMP
          WHERE client_id = $2`,
          [cardCode, clientProfile.client_id]
        );
        
        // Si el tipo es Customer y se debe activar el usuario
        if (cardType === 'Customer' && activateUser && !clientProfile.is_active) {
          await dbClient.query(
            'UPDATE users SET is_active = true WHERE id = $1',
            [userId]
          );
          
          logger.info('Usuario activado por simulación SAP', {
            userId,
            clientId: clientProfile.client_id,
            cardCode,
            cardType
          });
        }
        
        await dbClient.query('COMMIT');
        
        logger.info('Sincronización SAP simulada exitosamente', {
          userId,
          clientId: clientProfile.client_id,
          cardCode,
          cardType,
          userActivated: activateUser && cardType === 'Customer'
        });
        
        return res.status(200).json({
          success: true,
          message: 'Sincronización con SAP simulada exitosamente',
          data: {
            userId: parseInt(userId),
            clientId: clientProfile.client_id,
            cardcodeSap: cardCode,
            cardType,
            userActivated: activateUser && cardType === 'Customer' && !clientProfile.is_active,
            simulatedAt: new Date().toISOString()
          }
        });
      } catch (dbError) {
        await dbClient.query('ROLLBACK');
        throw dbError;
      } finally {
        dbClient.release();
      }
    } catch (error) {
      logger.error('Error al simular sincronización SAP', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId,
        adminId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al simular sincronización SAP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
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
  async syncInstitutionalClients(req, res) {
    try {
      logger.info('Iniciando sincronización de clientes institucionales', { 
        userId: req.user?.id
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de sincronización');
        await sapServiceManager.initialize();
      }

      // Ejecutar sincronización de clientes institucionales
      const results = await sapServiceManager.clientService.syncInstitutionalClients();
      
      res.status(200).json({
        success: true,
        message: 'Sincronización de clientes institucionales completada exitosamente',
        data: results
      });
    } catch (error) {
      logger.error('Error al sincronizar clientes institucionales', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar clientes institucionales',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * Sincroniza todos los clientes cuyo CardCode comience con "CI"
   * @async
   * @param {object} req - Objeto de solicitud Express
   * @param {object} res - Objeto de respuesta Express
   */
  async syncCIClients(req, res) {
    try {
      logger.info('Iniciando sincronización de clientes con CardCode CI', { 
        userId: req.user?.id
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de sincronización');
        await sapServiceManager.initialize();
      }

      // Ejecutar sincronización de clientes CI
      const results = await sapServiceManager.clientService.syncCIClients();
      
      res.status(200).json({
        success: true,
        message: 'Sincronización de clientes CI completada exitosamente',
        data: results
      });
    } catch (error) {
      logger.error('Error al sincronizar clientes CI', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar clientes CI',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Lista clientes de SAP cuyo CardCode comience con "CI" sin sincronizar
   * @async
   * @param {object} req - Objeto de solicitud Express
   * @param {object} res - Objeto de respuesta Express
   */
  async listCIClients(req, res) {
    try {
      logger.info('Obteniendo lista de clientes CI desde SAP', { 
        userId: req.user?.id
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de consulta');
        await sapServiceManager.initialize();
      }

      // Obtener clientes de SAP
      const clients = await sapServiceManager.clientService.getClientsByCardCodePrefix();
      
      res.status(200).json({
        success: true,
        message: 'Clientes CI obtenidos exitosamente',
        data: {
          totalClients: clients.length,
          clients: clients
        }
      });
      
    } catch (error) {
      logger.error('Error al obtener clientes CI', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener clientes CI',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
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
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async validateClientBranches(req, res) {
    try {
      const { clientId, cardCode } = req.query;
      
      logger.info('Iniciando validación de sucursales de clientes', { 
        userId: req.user?.id,
        clientId,
        cardCode
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de validación');
        await sapServiceManager.initialize();
      }

      // Obtener clientes para validar
      let clientsQuery = `
        SELECT 
          cp.client_id, 
          cp.cardcode_sap, 
          cp.company_name,
          cp.user_id
        FROM client_profiles cp
        WHERE cp.cardcode_sap IS NOT NULL
      `;
      
      const queryParams = [];
      
      if (clientId) {
        clientsQuery += ` AND cp.client_id = $${queryParams.length + 1}`;
        queryParams.push(clientId);
      }
      
      if (cardCode) {
        clientsQuery += ` AND cp.cardcode_sap = $${queryParams.length + 1}`;
        queryParams.push(cardCode);
      }
      
      clientsQuery += ` ORDER BY cp.company_name`;
      
      const { rows: clients } = await pool.query(clientsQuery, queryParams);
      
      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron clientes para validar'
        });
      }

      const validationResults = {
        totalClients: clients.length,
        clientsWithBranches: 0,
        totalSapBranches: 0,
        totalLocalBranches: 0,
        missingBranches: 0,
        extraBranches: 0,
        clientDetails: []
      };

      // Validar cada cliente
      for (const client of clients) {
        try {
          // Obtener sucursales de SAP
          const sapBranches = await sapServiceManager.clientService.getClientBranches(client.cardcode_sap);
          
          // Obtener sucursales locales
          const localBranchesQuery = `
            SELECT * FROM client_branches 
            WHERE client_id = $1 
            ORDER BY branch_name
          `;
          const { rows: localBranches } = await pool.query(localBranchesQuery, [client.client_id]);
          
          // Comparar sucursales
          const sapBranchCodes = new Set(sapBranches.map(b => b.AddressName));
          const localBranchCodes = new Set(localBranches.map(b => b.ship_to_code));
          
          const missing = sapBranches.filter(b => !localBranchCodes.has(b.AddressName));
          const extra = localBranches.filter(b => !sapBranchCodes.has(b.ship_to_code));
          
          const clientDetail = {
            clientId: client.client_id,
            cardCode: client.cardcode_sap,
            companyName: client.company_name,
            sapBranches: sapBranches.map(b => ({
              addressName: b.AddressName,
              street: b.Street,
              city: b.City,
              state: b.State,
              country: b.Country,
              zipCode: b.ZipCode,
              phone: b.Phone,
              contactPerson: b.ContactPerson,
              municipalityCode: b.U_HBT_MunMed || null
            })),
            localBranches: localBranches.map(b => ({
              branchId: b.branch_id,
              shipToCode: b.ship_to_code,
              branchName: b.branch_name,
              address: b.address,
              city: b.city,
              state: b.state,
              country: b.country,
              zipCode: b.zip_code,
              phone: b.phone,
              contactPerson: b.contact_person,
              isDefault: b.is_default,
              municipalityCode: b.municipality_code
            })),
            missing: missing.map(b => ({
              addressName: b.AddressName,
              street: b.Street,
              city: b.City,
              state: b.State
            })),
            extra: extra.map(b => ({
              branchId: b.branch_id,
              shipToCode: b.ship_to_code,
              branchName: b.branch_name
            }))
          };
          
          validationResults.clientDetails.push(clientDetail);
          validationResults.totalSapBranches += sapBranches.length;
          validationResults.totalLocalBranches += localBranches.length;
          validationResults.missingBranches += missing.length;
          validationResults.extraBranches += extra.length;
          
          if (sapBranches.length > 0) {
            validationResults.clientsWithBranches++;
          }
          
        } catch (clientError) {
          logger.error('Error al validar sucursales para cliente', {
            clientId: client.client_id,
            cardCode: client.cardcode_sap,
            error: clientError.message
          });
          
          // Agregar cliente con error a los resultados
          validationResults.clientDetails.push({
            clientId: client.client_id,
            cardCode: client.cardcode_sap,
            companyName: client.company_name,
            error: clientError.message,
            sapBranches: [],
            localBranches: [],
            missing: [],
            extra: []
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Validación de sucursales completada exitosamente',
        data: validationResults
      });
    } catch (error) {
      logger.error('Error al validar sucursales de clientes', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al validar sucursales de clientes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * Valida las sucursales de un cliente específico contra SAP
   * @async
   * @param {object} req - Objeto de solicitud Express
   * @param {object} res - Objeto de respuesta Express
   */
  async validateSpecificClientBranches(req, res) {
    try {
      const { cardCode } = req.params;
      
      logger.info('Validando sucursales para cliente específico', { 
        cardCode,
        userId: req.user?.id
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de validación');
        await sapServiceManager.initialize();
      }

      // Obtener cliente por CardCode
      const clientQuery = `
        SELECT client_id, cardcode_sap, company_name
        FROM client_profiles 
        WHERE cardcode_sap = $1
      `;
      
      const { rows: clientRows } = await pool.query(clientQuery, [cardCode]);
      
      if (clientRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Cliente con CardCode ${cardCode} no encontrado en la plataforma`
        });
      }

      const client = clientRows[0];

      // Obtener sucursales desde SAP usando todos los métodos
      logger.info('Obteniendo sucursales desde SAP usando múltiples métodos', { cardCode });
      const sapBranches = await sapServiceManager.clientService.getClientBranchesFromCRD1(cardCode);

      // Obtener sucursales locales
      const localBranchesQuery = `
        SELECT ship_to_code, branch_name, address, city, state, created_at
        FROM client_branches 
        WHERE client_id = $1
        ORDER BY is_default DESC, branch_name
      `;
      
      const { rows: localBranches } = await pool.query(localBranchesQuery, [client.client_id]);

      // Realizar comparación detallada
      const comparison = {
        cardCode,
        clientId: client.client_id,
        companyName: client.company_name,
        sapBranches: {
          total: sapBranches.length,
          list: sapBranches.map(branch => ({
            address: branch.Address,
            street: branch.Street,
            city: branch.City,
            state: branch.State,
            country: branch.Country
          }))
        },
        localBranches: {
          total: localBranches.length,
          list: localBranches.map(branch => ({
            shipToCode: branch.ship_to_code,
            branchName: branch.branch_name,
            address: branch.address,
            city: branch.city,
            state: branch.state,
            createdAt: branch.created_at
          }))
        },
        analysis: {
          sapHasBranches: sapBranches.length > 0,
          localHasBranches: localBranches.length > 0,
          needsSync: sapBranches.length !== localBranches.length,
          missingInLocal: sapBranches.length - localBranches.length,
          recommendation: ''
        }
      };

      // Generar recomendación
      if (sapBranches.length === 0) {
        comparison.analysis.recommendation = 'El cliente no tiene sucursales en SAP. Verificar configuración en SAP B1.';
      } else if (localBranches.length === 0) {
        comparison.analysis.recommendation = `Sincronización requerida: ${sapBranches.length} sucursales encontradas en SAP, 0 en local.`;
      } else if (sapBranches.length > localBranches.length) {
        comparison.analysis.recommendation = `Sincronización requerida: Faltan ${sapBranches.length - localBranches.length} sucursales en local.`;
      } else if (sapBranches.length < localBranches.length) {
        comparison.analysis.recommendation = `Revisar: Hay más sucursales en local (${localBranches.length}) que en SAP (${sapBranches.length}).`;
      } else {
        comparison.analysis.recommendation = 'Las cantidades coinciden. Verificar si los datos están actualizados.';
      }

      res.status(200).json({
        success: true,
        message: `Validación completada para cliente ${cardCode}`,
        data: comparison
      });

    } catch (error) {
      logger.error('Error al validar sucursales del cliente específico', {
        error: error.message,
        stack: error.stack,
        cardCode: req.params?.cardCode,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al validar sucursales del cliente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * @swagger
   * /api/client-sync/branches/sync:
   *   post:
   *     summary: Sincronizar sucursales de clientes institucionales
   *     description: Sincroniza las sucursales de clientes institucionales desde SAP B1 hacia la base de datos local
   *     tags: [ClientSync]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Sincronización de sucursales completada exitosamente
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async syncClientBranches(req, res) {
    try {
      // Obtener parámetros del query string en lugar del body
      const { clientId, cardCode, forceUpdate = false } = req.query;
      const forceUpdateBool = forceUpdate === 'true' || forceUpdate === true;

      logger.info('Iniciando sincronización de sucursales de clientes', { 
        userId: req.user?.id,
        clientId,
        cardCode,
        forceUpdate: forceUpdateBool
      });

      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        logger.debug('Inicializando servicio de SAP antes de sincronización');
        await sapServiceManager.initialize();
      }

      // Obtener clientes para sincronizar
      let clientsQuery = `
        SELECT 
          cp.client_id, 
          cp.cardcode_sap, 
          cp.company_name,
          cp.user_id
        FROM client_profiles cp
        WHERE cp.cardcode_sap IS NOT NULL
      `;
      
      const queryParams = [];
      
      if (clientId) {
        clientsQuery += ` AND cp.client_id = $${queryParams.length + 1}`;
        queryParams.push(clientId);
      }
      
      if (cardCode) {
        clientsQuery += ` AND cp.cardcode_sap = $${queryParams.length + 1}`;
        queryParams.push(cardCode);
      }
      
      clientsQuery += ` ORDER BY cp.company_name`;
      
      const { rows: clients } = await pool.query(clientsQuery, queryParams);
      
      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron clientes para sincronizar'
        });
      }

      const syncResults = {
        totalClients: clients.length,
        totalBranches: 0,
        created: 0,
        updated: 0,
        errors: 0,
        skipped: 0,
        clientDetails: []
      };

      // Sincronizar cada cliente
      for (const client of clients) {
        try {
          const branchStats = {
            total: 0,
            created: 0,
            updated: 0,
            errors: 0
          };
          
          // Usar el método existente del servicio SAP
          await sapServiceManager.clientService.syncClientBranches(
            client.cardcode_sap, 
            client.client_id, 
            branchStats,
            forceUpdateBool
          );
          
          // Actualizar estadísticas generales
          syncResults.totalBranches += branchStats.total;
          syncResults.created += branchStats.created;
          syncResults.updated += branchStats.updated;
          syncResults.errors += branchStats.errors;
          
          syncResults.clientDetails.push({
            clientId: client.client_id,
            cardCode: client.cardcode_sap,
            companyName: client.company_name,
            branches: branchStats
          });
          
        } catch (clientError) {
          syncResults.errors++;
          logger.error('Error al sincronizar sucursales para cliente', {
            clientId: client.client_id,
            cardCode: client.cardcode_sap,
            error: clientError.message
          });
          
          syncResults.clientDetails.push({
            clientId: client.client_id,
            cardCode: client.cardcode_sap,
            companyName: client.company_name,
            error: clientError.message,
            branches: { total: 0, created: 0, updated: 0, errors: 1 }
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Sincronización de sucursales completada exitosamente',
        data: syncResults
      });
    } catch (error) {
      logger.error('Error al sincronizar sucursales de clientes', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar sucursales de clientes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * @swagger
   * /api/client-sync/test-email-ses:
   *   post:
   *     summary: Probar envío de correo con AWS SES (Capa Gratuita)
   *     description: Envía un correo de prueba usando AWS SES con validaciones de capa gratuita
   *     tags: [ClientSync]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - to
   *             properties:
   *               to:
   *                 type: string
   *                 format: email
   *                 description: Dirección de correo destino (debe estar verificada en capa gratuita)
   *                 example: "test@artesapanaderia.com"
   *               subject:
   *                 type: string
   *                 description: Asunto del correo
   *                 default: "Prueba AWS SES - La Artesa Panadería"
   *     responses:
   *       200:
   *         description: Correo enviado exitosamente
   *       400:
   *         description: Datos inválidos o límites excedidos
   *       401:
   *         description: No autorizado
   *       500:
   *         description: Error al enviar correo
   */
  async testEmailSes(req, res) {
    try {
      const { to, subject = 'Prueba AWS SES - La Artesa Panadería' } = req.body;
      
      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'La dirección de correo destino es requerida'
        });
      }
      
      logger.info('Iniciando prueba de correo SES', {
        to,
        subject,
        userId: req.user?.id
      });
      
      const EmailService = require('../services/EmailService');
      
      const mailOptions = {
        from: {
          name: 'La Artesa Panadería',
          address: process.env.SMTP_FROM
        },
        to: to,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #8B4513; margin-bottom: 10px;">🥖 La Artesa Panadería</h1>
              <p style="color: #666; font-size: 16px;">Prueba de Correo - AWS SES</p>
            </div>
            
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin-top: 0;">✅ Configuración Exitosa</h2>
              <p>Este correo confirma que AWS SES está configurado correctamente para La Artesa Panadería.</p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
              <h3 style="color: #856404; margin-top: 0;">📊 Información de Capa Gratuita</h3>
              <ul style="color: #856404; margin: 0;">
                <li>Límite diario: 200 correos</li>
                <li>Límite por segundo: 14 correos</li>
                <li>Solo direcciones verificadas en sandbox</li>
              </ul>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #333; margin-top: 0;">⚙️ Detalles Técnicos</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 5px; border-bottom: 1px solid #ddd;"><strong>Servidor:</strong></td><td style="padding: 5px; border-bottom: 1px solid #ddd;">${process.env.SMTP_HOST || 'No configurado'}</td></tr>
                <tr><td style="padding: 5px; border-bottom: 1px solid #ddd;"><strong>Puerto:</strong></td><td style="padding: 5px; border-bottom: 1px solid #ddd;">${process.env.SMTP_PORT || 'No configurado'}</td></tr>
                <tr><td style="padding: 5px; border-bottom: 1px solid #ddd;"><strong>Enviado:</strong></td><td style="padding: 5px; border-bottom: 1px solid #ddd;">${new Date().toLocaleString()}</td></tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #666; font-size: 14px; margin: 0;">
                Correo automático de prueba - La Artesa Panadería<br>
                <strong>Sistema de Notificaciones</strong>
              </p>
            </div>
          </div>
        `
      };
      
      const info = await EmailService.sendMailWithLimits(mailOptions);
      
      logger.info('Correo de prueba SES enviado exitosamente', {
        messageId: info.messageId,
        to,
        userId: req.user?.id
      });
      
      res.status(200).json({
        success: true,
        message: 'Correo de prueba enviado exitosamente con AWS SES',
        data: {
          messageId: info.messageId,
          to: to,
          from: process.env.SMTP_FROM,
          sentAt: new Date().toISOString(),
          sesInfo: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            dailyLimit: '200 correos',
            rateLimit: '14 correos por segundo'
          }
        }
      });
    } catch (error) {
      logger.error('Error al enviar correo de prueba SES', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al enviar correo de prueba con AWS SES',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        details: error.code ? { errorCode: error.code } : undefined
      });
    }
  }

  /**
   * Debug: Verificar estado de cliente específico en SAP vs API
   */
  async debugClientStatus(req, res) {
    try {
      const { userId } = req.params;
      
      logger.info('Debug: Verificando estado de cliente', { 
        userId,
        adminId: req.user?.id
      });

      // Obtener datos del cliente de la API
      const query = `
        SELECT cp.*, u.is_active, u.name, u.mail
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1
      `;
      
      const { rows } = await pool.query(query, [userId]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      const clientProfile = rows[0];
      
      // Verificar que el servicio esté inicializado
      if (!sapServiceManager.initialized) {
        await sapServiceManager.initialize();
      }
      
      let sapClient = null;
      if (clientProfile.cardcode_sap) {
        try {
          sapClient = await sapServiceManager.clientService.getBusinessPartnerByCardCode(clientProfile.cardcode_sap);
        } catch (sapError) {
          logger.error('Error al consultar SAP', {
            error: sapError.message,
            cardCode: clientProfile.cardcode_sap
          });
        }
      }
      
      const canCreateOrders = clientProfile.is_active && 
                            clientProfile.cardcode_sap && 
                            clientProfile.cardtype_sap !== 'cLId' &&
                            clientProfile.cardtype_sap !== 'cLid';
      
      res.status(200).json({
        success: true,
        data: {
          api: {
            userId: clientProfile.user_id,
            clientId: clientProfile.client_id,
            isActive: clientProfile.is_active,
            cardCodeSap: clientProfile.cardcode_sap,
            cardTypeSap: clientProfile.cardtype_sap,
            companyName: clientProfile.company_name,
            sapLeadSynced: clientProfile.sap_lead_synced
          },
          sap: {
            found: !!sapClient,
            cardCode: sapClient?.CardCode,
            cardName: sapClient?.CardName,
            cardType: sapClient?.CardType,
            groupCode: sapClient?.GroupCode
          },
          analysis: {
            cardTypeMatches: sapClient?.CardType === clientProfile.cardtype_sap,
            needsUpdate: sapClient && sapClient.CardType !== clientProfile.cardtype_sap,
            canCreateOrders: canCreateOrders,
            isLead: clientProfile.cardtype_sap === 'cLId' || clientProfile.cardtype_sap === 'cLid'
          }
        }
      });
      
    } catch (error) {
      logger.error('Error en debug de cliente', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error en debug de cliente',
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
  activateClient: clientSyncController.activateClient,
  syncClient: clientSyncController.syncClient,
  syncInstitutionalClients: clientSyncController.syncInstitutionalClients,
  validateClientBranches: clientSyncController.validateClientBranches,
  syncClientBranches: clientSyncController.syncClientBranches,
  simulateSapSync: clientSyncController.simulateSapSync,
  testEmailSes: clientSyncController.testEmailSes,
  syncCIClients: clientSyncController.syncCIClients,
  listCIClients: clientSyncController.listCIClients,
  validateSpecificClientBranches: clientSyncController.validateSpecificClientBranches,
  debugClientStatus: clientSyncController.debugClientStatus,
};