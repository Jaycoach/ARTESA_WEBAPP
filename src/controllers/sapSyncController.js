const pool = require('../config/db');
const Product = require('../models/Product');
const AuditService = require('../services/AuditService');
const sapServiceManager = require('../services/SapServiceManager');
const { createContextLogger } = require('../config/logger');
const cron = require('node-cron');

// Crear una instancia del logger con contexto
const logger = createContextLogger('SapSyncController');

/**
 * Controlador para operaciones de sincronización con SAP B1
 */
class SapSyncController {
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
   *                   example: Sincronización iniciada exitosamente
   *                 data:
   *                   type: object
   *                   properties:
   *                     jobId:
   *                       type: string
   *                       example: sync-20250308-123456
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async startSync(req, res) {
    try {
      const jobId = `sync-${new Date().toISOString().replace(/[:.]/g, '')}`;
      
      logger.info('Iniciando sincronización manual', { 
        userId: req.user?.id,
        jobId
      });

      // Iniciar sincronización en segundo plano para no bloquear la respuesta
      Promise.resolve().then(async () => {
        try {
          // Siempre hacemos sincronización completa (true)
          await sapServiceManager.syncProducts(true);
          logger.info('Sincronización manual completada', { jobId });
        } catch (error) {
          logger.error('Error en sincronización manual', {
            error: error.message,
            stack: error.stack,
            jobId
          });
        }
      });

      res.status(200).json({
        success: true,
        message: 'Sincronización completa iniciada exitosamente',
        data: {
          jobId
        }
      });
    } catch (error) {
      logger.error('Error al iniciar sincronización manual', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al iniciar sincronización',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

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
   *                     nextSyncTime:
   *                       type: string
   *                       format: date-time
   *                       example: "2025-03-09T00:00:00Z"
   *                     initialized:
   *                       type: boolean
   *                       example: true
   *                     syncSchedule:
   *                       type: string
   *                       example: "0 0 * * *"
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async getSyncStatus(req, res) {
    try {
      logger.debug('Obteniendo estado de sincronización con SAP B1', { 
        userId: req.user?.id 
      });

      // Calcular próxima sincronización basada en la programación cron
      let nextSyncTime = null;
      try {
        const cronParser = require('cron-parser');
        const interval = cronParser.parseExpression(sapIntegrationService.syncSchedule);
        nextSyncTime = interval.next().toDate();
      } catch (cronError) {
        logger.warn('Error al calcular próxima sincronización', {
          schedule: sapIntegrationService.syncSchedule,
          error: cronError.message
        });
      }

      const syncStatus = sapServiceManager.getSyncStatus();
      res.status(200).json({
        success: true,
        data: {
          lastSyncTime: syncStatus.products.lastSyncTime,
          nextSyncTime,
          initialized: syncStatus.initialized,
          syncSchedule: syncStatus.products.syncSchedule
        }
      });
    } catch (error) {
      logger.error('Error al obtener estado de sincronización', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado de sincronización',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

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
  async testSapConnection(req, res) {
    try {
      logger.info('Probando conexión con SAP B1');
      
      // Iniciar sesión y verificar
      // Utilizamos directamente el servicio de productos para la prueba
      const productService = sapServiceManager.productService;
      await productService.login();
      const endpoint = 'view.svc/B1_ProductsB1SLQuery?$top=2';
      const result = await productService.request('GET', endpoint);
        
      res.status(200).json({
        success: true,
        message: 'Conexión exitosa con SAP B1',
        sessionId: sapIntegrationService.sessionId ? 'Válido' : 'No disponible',
        endpoint: endpoint,
        data: {
          value: result.value,
          count: result.value?.length || 0,
          // También mostrar metadatos para análisis
          metadata: result['@odata.metadata'] || null
        }
      });
    } catch (error) {
      logger.error('Error al probar conexión con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al probar conexión con SAP B1',
        error: error.message,
        details: error.response?.data
      });
    }
  }

  /**
   * Sincroniza productos de un grupo específico
   * @async
   * @param {object} req - Objeto de solicitud Express
   * @param {object} res - Objeto de respuesta Express
   */
  async syncProductsByGroup(req, res) {
    try {
      const { groupCode } = req.params;
      
      if (!groupCode || isNaN(parseInt(groupCode))) {
        return res.status(400).json({
          success: false,
          message: 'Código de grupo inválido'
        });
      }
      
      const groupCodeInt = parseInt(groupCode);
      
      logger.info('Iniciando sincronización manual por grupo', { 
        userId: req.user?.id,
        groupCode: groupCodeInt
      });

      // Iniciar sincronización en segundo plano
      Promise.resolve().then(async () => {
        try {
          await sapServiceManager.syncProductsByGroup(groupCodeInt);
          logger.info('Sincronización por grupo completada', { groupCode: groupCodeInt });
        } catch (error) {
          logger.error('Error en sincronización por grupo', {
            error: error.message,
            stack: error.stack,
            groupCode: groupCodeInt
          });
        }
      });

      res.status(200).json({
        success: true,
        message: `Sincronización de productos del grupo ${groupCodeInt} iniciada exitosamente`
      });
    } catch (error) {
      logger.error('Error al iniciar sincronización por grupo', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        groupCode: req.params.groupCode
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al iniciar sincronización por grupo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtiene el estado de sincronización por grupo
   * @async
   * @param {object} req - Objeto de solicitud Express
   * @param {object} res - Objeto de respuesta Express
   */
  async getGroupSyncStatus(req, res) {
    try {
      const { groupCode } = req.params;
      
      if (!groupCode || isNaN(parseInt(groupCode))) {
        return res.status(400).json({
          success: false,
          message: 'Código de grupo inválido'
        });
      }
      
      const groupCodeInt = parseInt(groupCode);
      
      logger.debug('Obteniendo estado de sincronización por grupo', { 
        userId: req.user?.id,
        groupCode: groupCodeInt
      });

      const syncStatus = sapServiceManager.getSyncStatus();
      const groupInfo = syncStatus.products.groupSchedules.find(g => parseInt(g.groupCode) === groupCodeInt) || {};
      res.status(200).json({
        success: true,
        data: {
          groupCode: groupCodeInt,
          lastSyncTime: groupInfo.lastSyncTime || null,
          schedule: groupInfo.lastSyncTime ? 'Activa' : 'No configurada'
        }
      });
    } catch (error) {
      logger.error('Error al obtener estado de sincronización por grupo', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        groupCode: req.params.groupCode
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado de sincronización por grupo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Configura la sincronización periódica por grupo
   * @async
   * @param {object} req - Objeto de solicitud Express
   * @param {object} res - Objeto de respuesta Express
   */
  async configureGroupSync(req, res) {
    try {
      const { groupCode } = req.params;
      const { schedule, enabled } = req.body;
      
      if (!groupCode || isNaN(parseInt(groupCode))) {
        return res.status(400).json({
          success: false,
          message: 'Código de grupo inválido'
        });
      }
      
      const groupCodeInt = parseInt(groupCode);
      
      logger.info('Configurando sincronización periódica por grupo', { 
        userId: req.user?.id,
        groupCode: groupCodeInt,
        schedule,
        enabled
      });

      // Si está habilitado, configurar la tarea
      if (enabled) {
        if (!schedule || !cron.validate(schedule)) {
          return res.status(400).json({
            success: false,
            message: 'Formato de programación cron inválido'
          });
        }
        
        // Configurar tarea de sincronización
        sapServiceManager.productService.scheduleGroupSyncTask(groupCodeInt, schedule);
        
        res.status(200).json({
          success: true,
          message: `Sincronización periódica configurada para grupo ${groupCodeInt}`,
          data: {
            groupCode: groupCodeInt,
            schedule,
            enabled: true
          }
        });
      } else {
        // Desactivar tarea si existe
        if (sapIntegrationService.groupSyncTasks?.[groupCodeInt]) {
          sapIntegrationService.groupSyncTasks[groupCodeInt].stop();
          delete sapIntegrationService.groupSyncTasks[groupCodeInt];
          
          res.status(200).json({
            success: true,
            message: `Sincronización periódica desactivada para grupo ${groupCodeInt}`,
            data: {
              groupCode: groupCodeInt,
              enabled: false
            }
          });
        } else {
          res.status(200).json({
            success: true,
            message: `No había sincronización configurada para grupo ${groupCodeInt}`,
            data: {
              groupCode: groupCodeInt,
              enabled: false
            }
          });
        }
      }
    } catch (error) {
      logger.error('Error al configurar sincronización por grupo', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        groupCode: req.params.groupCode
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al configurar sincronización por grupo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async analyzeView(req, res) {
    try {
      logger.info('Analizando estructura de vista SAP');
      
      await sapIntegrationService.login();
      
      // Obtener metadatos de la vista
      const productService = sapServiceManager.productService;
      await productService.login();
      const metadataEndpoint = 'view.svc/$metadata';
      const metadataResult = await productService.request('GET', metadataEndpoint);
      
      // Obtener una muestra de datos
      const sampleEndpoint = 'view.svc/B1_ProductsB1SLQuery?$top=1';
      const sampleResult = await productService.request('GET', sampleEndpoint);
      
      // Analizar las propiedades disponibles
      let propertyNames = [];
      if (sampleResult.value && sampleResult.value.length > 0) {
        propertyNames = Object.keys(sampleResult.value[0]);
      }
      
      res.status(200).json({
        success: true,
        message: 'Análisis de vista SAP completado',
        view: {
          name: 'B1_ProductsB1SLQuery',
          propertyNames: propertyNames,
          sampleData: sampleResult.value || [],
          metadata: metadataResult
        }
      });
    } catch (error) {
      logger.error('Error al analizar vista SAP', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al analizar vista SAP',
        error: error.message
      });
    }
  }

  /**
   * Actualiza la descripción de un producto y la sincroniza con SAP B1
   * @async
   * @param {object} req - Objeto de solicitud Express
   * @param {object} res - Objeto de respuesta Express
   */
  async updateProductDescription(req, res) {
    // Obtener una conexión para la transacción
    const client = await pool.connect();
    let auditLog = null;
  
    try {
      const { productId, description } = req.body;
  
      // Registro de inicio de operación en auditoría
      auditLog = await AuditService.logAuditEvent(
        AuditService.AUDIT_EVENTS.DATA_ACCESSED,
        {
          details: {
            action: 'UPDATE_PRODUCT_DESCRIPTION',
            productId,
            newDescriptionLength: description?.length
          },
          ipAddress: req.ip
        },
        req.user.id,
        AuditService.SEVERITY_LEVELS.INFO
      );
      
      if (!productId || !description) {
        return res.status(400).json({
          success: false,
          message: 'El ID del producto y la descripción son requeridos'
        });
      }
      
      // Validación de longitud para FrgnName (SAP B1)
      const MAX_FRGNNAME_LENGTH = 200;
      if (description.length > MAX_FRGNNAME_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `La descripción excede el límite de ${MAX_FRGNNAME_LENGTH} caracteres permitido por SAP B1`,
          currentLength: description.length,
          maxLength: MAX_FRGNNAME_LENGTH
        });
      }
  
      logger.info('Iniciando actualización de descripción y sincronización con SAP', { 
        userId: req.user?.id,
        productId,
        descriptionLength: description.length
      });
  
      // Iniciar transacción
      await client.query('BEGIN');
  
      // 1. Obtener el producto dentro de la transacción
      const productResult = await client.query(
        'SELECT * FROM products WHERE product_id = $1', 
        [productId]
      );
      
      // Verificar si el producto existe
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        
        // Registrar en auditoría: producto no encontrado
        await AuditService.logAuditEvent(
          AuditService.AUDIT_EVENTS.DATA_ACCESSED,
          {
            details: {
              action: 'UPDATE_PRODUCT_DESCRIPTION_FAILED',
              productId,
              reason: 'PRODUCT_NOT_FOUND'
            },
            ipAddress: req.ip,
            auditId: auditLog
          },
          req.user.id,
          AuditService.SEVERITY_LEVELS.WARNING
        );
  
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      const product = productResult.rows[0];
      
      // Verificar si tiene código SAP (en un bloque separado después de definir product)
      if (!product.sap_code) {
        await client.query('ROLLBACK');
        
        // Registrar en auditoría: producto sin código SAP
        await AuditService.logAuditEvent(
          AuditService.AUDIT_EVENTS.DATA_ACCESSED,
          {
            details: {
              action: 'UPDATE_PRODUCT_DESCRIPTION_FAILED',
              productId,
              reason: 'NO_SAP_CODE'
            },
            ipAddress: req.ip,
            auditId: auditLog
          },
          req.user.id,
          AuditService.SEVERITY_LEVELS.WARNING
        );
  
        return res.status(404).json({
          success: false,
          message: 'Este producto no tiene código SAP asociado'
        });
      }
  
      const oldDescription = product.description;
  
      // 2. Actualizar la descripción localmente dentro de la transacción
      await client.query(
        'UPDATE products SET description = $1, sap_sync_pending = true, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2',
        [description, productId]
      );
      
      try {
        // 3. Intentar actualizar en SAP (FrgnName en tabla OITM)
        await sapServiceManager.updateProductDescription(product.sap_code, description);
  
        // Marcar como sincronizado si todo es exitoso (eliminamos la operación redundante)
        await client.query(
          'UPDATE products SET sap_last_sync = $1, sap_sync_pending = false WHERE product_id = $2',
          [new Date().toISOString(), productId]
        );
  
        // Confirmar transacción
        await client.query('COMMIT');
  
        // Registrar en auditoría: actualización exitosa
        await AuditService.logAuditEvent(
          AuditService.AUDIT_EVENTS.DATA_ACCESSED,
          {
            details: {
              action: 'UPDATE_PRODUCT_DESCRIPTION_SUCCESS',
              productId,
              sapCode: product.sap_code,
              oldDescription,
              newDescription: description,
              syncStatus: 'completed'
            },
            ipAddress: req.ip,
            auditId: auditLog,
            oldStatus: 'unchanged',
            newStatus: 'updated_and_synced'
          },
          req.user.id,
          AuditService.SEVERITY_LEVELS.INFO
        );
        
        res.status(200).json({
          success: true,
          message: 'Descripción actualizada y sincronizada exitosamente',
          data: {
            productId,
            sapCode: product.sap_code,
            oldDescription,
            newDescription: description,
            syncStatus: 'completed'
          }
        });
      } catch (sapError) {
        // Error al sincronizar con SAP
        logger.error('Error al sincronizar con SAP B1', {
          productId,
          sapCode: product.sap_code,
          error: sapError.message
        });
        
        // Confirmar transacción local (quedará pendiente de sincronizar)
        await client.query('COMMIT');
        
        // Registrar en auditoría: actualización local exitosa pero sincronización pendiente
        await AuditService.logAuditEvent(
          AuditService.AUDIT_EVENTS.DATA_ACCESSED,
          {
            details: {
              action: 'UPDATE_PRODUCT_DESCRIPTION_PARTIAL',
              productId,
              sapCode: product.sap_code,
              oldDescription,
              newDescription: description,
              syncStatus: 'pending',
              syncError: sapError.message
            },
            ipAddress: req.ip,
            auditId: auditLog,
            oldStatus: 'unchanged',
            newStatus: 'updated_sync_pending'
          },
          req.user.id,
          AuditService.SEVERITY_LEVELS.WARNING
        );
      
        res.status(202).json({
          success: true,
          message: 'Descripción actualizada localmente, pero la sincronización con SAP queda pendiente',
          data: {
            productId,
            sapCode: product.sap_code,
            oldDescription,
            newDescription: description,
            syncStatus: 'pending',
            syncError: sapError.message
          }
        });
      } // Aquí faltaba esta llave de cierre para el catch interno
    } catch (error) {
      // Revertir en caso de error
      await client.query('ROLLBACK');
      
      logger.error('Error general en actualización de descripción', {
        error: error.message,
        stack: error.stack,
        productId: req.body?.productId
      });
      
      // Registrar en auditoría: fallo general
      if (auditLog) {
        await AuditService.logAuditEvent(
          AuditService.AUDIT_EVENTS.DATA_ACCESSED,
          {
            details: {
              action: 'UPDATE_PRODUCT_DESCRIPTION_FAILED',
              productId: req.body?.productId,
              error: error.message
            },
            ipAddress: req.ip,
            auditId: auditLog
          },
          req.user?.id || null,
          AuditService.SEVERITY_LEVELS.ERROR
        );
      }
      
      res.status(500).json({
        success: false,
        message: 'Error al actualizar descripción y sincronizar con SAP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      // Liberar la conexión al pool en cualquier caso
      client.release();
    }
  }
}

// Crear instancia del controlador
const sapSyncController = new SapSyncController();

// Exportar métodos del controlador
module.exports = {
  startSync: sapSyncController.startSync,
  getSyncStatus: sapSyncController.getSyncStatus,
  testSapConnection: sapSyncController.testSapConnection,
  analyzeView: sapSyncController.analyzeView,
  syncProductsByGroup: sapSyncController.syncProductsByGroup,
  getGroupSyncStatus: sapSyncController.getGroupSyncStatus,
  configureGroupSync: sapSyncController.configureGroupSync,
  updateProductDescription: sapSyncController.updateProductDescription
};