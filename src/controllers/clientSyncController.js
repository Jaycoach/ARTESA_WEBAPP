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
      
      logger.info('Iniciando sincronización de sucursales de clientes', { 
        userId: req.user?.id,
        clientId,
        cardCode,
        forceUpdate
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
            branchStats
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
  syncClientBranches: clientSyncController.syncClientBranches
};