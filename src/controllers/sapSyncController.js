const { createContextLogger } = require('../config/logger');
const sapIntegrationService = require('../services/SapIntegrationService');
const Product = require('../models/Product');
const cron = require('node-cron');
const axios = require('axios');
const pool = require('../config/db');

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
      const fullSync = req.query.full === 'true';
      const jobId = `sync-${new Date().toISOString().replace(/[:.]/g, '')}`; 
      
      logger.info('Iniciando sincronización manual', { 
        userId: req.user?.id,
        fullSync,
        jobId
      });

      // Iniciar sincronización en segundo plano
      // Usamos Promise para no bloquear la respuesta
      Promise.resolve().then(async () => {
        try {
          await sapIntegrationService.syncProductsFromSAP(fullSync);
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
        message: `Sincronización ${fullSync ? 'completa' : 'incremental'} iniciada exitosamente`,
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
   *                   example: Producto sincronizado exitosamente
   *       400:
   *         description: Producto no encontrado o sin código SAP
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async syncProductToSAP(req, res) {
    try {
      const { productId } = req.params;
      
      logger.debug('Iniciando sincronización de producto hacia SAP B1', { 
        productId,
        userId: req.user?.id 
      });

      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        logger.warn('Producto no encontrado', { productId });
        return res.status(400).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      // Verificar que tiene código SAP
      if (!product.sap_code) {
        logger.warn('Producto sin código SAP, no se puede sincronizar', { productId });
        return res.status(400).json({
          success: false,
          message: 'El producto no tiene código SAP asignado'
        });
      }

      // Sincronizar producto
      await sapIntegrationService.syncProductToSAP(productId);
      
      logger.info('Producto sincronizado exitosamente hacia SAP B1', {
        productId,
        sapCode: product.sap_code
      });

      res.status(200).json({
        success: true,
        message: 'Producto sincronizado exitosamente hacia SAP B1'
      });
    } catch (error) {
      logger.error('Error al sincronizar producto hacia SAP B1', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar producto hacia SAP B1',
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
      // Esta es una implementación simplificada
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

      res.status(200).json({
        success: true,
        data: {
          lastSyncTime: sapIntegrationService.lastSyncTime,
          nextSyncTime,
          initialized: sapIntegrationService.initialized,
          syncSchedule: sapIntegrationService.syncSchedule
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
 * /api/sap/group/{groupCode}/sync:
 *   post:
 *     summary: Sincronizar productos desde SAP B1 por grupo específico
 *     description: Importa productos activos de un grupo específico desde SAP B1 a la base de datos de la API (modo DESDE SAP HACIA API)
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
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Filtrar solo productos activos (valor por defecto=true)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *         required: false
 *         description: Límite de productos a importar por lote (valor por defecto=100)
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
 *                   example: Sincronización de productos completada exitosamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     groupCode:
 *                       type: integer
 *                       example: 127
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 45
 *                         created:
 *                           type: integer
 *                           example: 30
 *                         updated:
 *                           type: integer
 *                           example: 15
 *                         errors:
 *                           type: integer
 *                           example: 0
 *                     duration:
 *                       type: string
 *                       example: "3.5 segundos"
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
async syncProductsByGroup(req, res) {
    try {
      const { groupCode } = req.params;
      const isActive = req.query.isActive !== 'false'; // Valor predeterminado: true
      const limit = parseInt(req.query.limit) || 100;
      
      // Validar que groupCode sea un número
      const groupCodeNum = parseInt(groupCode);
      if (isNaN(groupCodeNum)) {
        return res.status(400).json({
          success: false,
          message: 'El código de grupo debe ser un número'
        });
      }
      
      // Validar límite razonable
      if (limit < 1 || limit > 1000) {
        return res.status(400).json({
          success: false,
          message: 'El límite debe estar entre 1 y 1000'
        });
      }
      
      logger.info('Iniciando sincronización desde SAP B1 por grupo', { 
        userId: req.user?.id,
        groupCode: groupCodeNum,
        isActive,
        limit
      });
  
      const startTime = Date.now();
      const syncStats = await this.performGroupSyncFromSAP(groupCodeNum, isActive, limit);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Actualizar timestamp de última sincronización en el servicio
      if (!sapIntegrationService.lastGroupSyncTime) {
        sapIntegrationService.lastGroupSyncTime = {};
      }
      sapIntegrationService.lastGroupSyncTime[groupCodeNum] = new Date();
  
      res.status(200).json({
        success: true,
        message: `Sincronización de productos del grupo ${groupCodeNum} completada exitosamente`,
        data: {
          groupCode: groupCodeNum,
          stats: syncStats,
          duration: `${duration} segundos`
        }
      });
    } catch (error) {
      logger.error('Error al sincronizar productos desde SAP B1 por grupo', {
        error: error.message,
        stack: error.stack,
        groupCode: req.params.groupCode,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar productos desde SAP B1',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * @swagger
   * /api/sap/group/{groupCode}/status:
   *   get:
   *     summary: Obtener estado de sincronización de un grupo específico
   *     description: Devuelve información sobre el estado de la sincronización de un grupo específico con SAP B1
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
   *                     groupCode:
   *                       type: integer
   *                       example: 127
   *                     lastSyncTime:
   *                       type: string
   *                       format: date-time
   *                       example: "2025-03-08T12:00:00Z"
   *                     nextSyncTime:
   *                       type: string
   *                       format: date-time
   *                       example: "2025-03-08T18:00:00Z"
   *                     syncSchedule:
   *                       type: string
   *                       example: "0 * /6 * * *"
   *                     isActive:
   *                       type: boolean
   *                       example: true
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async getGroupSyncStatus(req, res) {
    try {
      const { groupCode } = req.params;
      const groupCodeNum = parseInt(groupCode);
      
      if (isNaN(groupCodeNum)) {
        return res.status(400).json({
          success: false,
          message: 'El código de grupo debe ser un número'
        });
      }
      
      logger.debug('Obteniendo estado de sincronización de grupo', { 
        groupCode: groupCodeNum,
        userId: req.user?.id 
      });

      // Calcular próxima sincronización basada en la programación cron
      let nextSyncTime = null;
      try {
        if (sapIntegrationService.groupSyncTasks && 
            sapIntegrationService.groupSyncTasks[groupCodeNum]) {
          
          const cronParser = require('cron-parser');
          const groupSchedule = process.env.SAP_GROUP_SYNC_SCHEDULE || '0 */6 * * *';
          const interval = cronParser.parseExpression(groupSchedule);
          nextSyncTime = interval.next().toDate();
        }
      } catch (cronError) {
        logger.warn('Error al calcular próxima sincronización de grupo', {
          groupCode: groupCodeNum,
          error: cronError.message
        });
      }

      // Obtener última sincronización del grupo específico
      const lastGroupSyncTime = sapIntegrationService.lastGroupSyncTime && 
                               sapIntegrationService.lastGroupSyncTime[groupCodeNum];

      res.status(200).json({
        success: true,
        data: {
          groupCode: groupCodeNum,
          lastSyncTime: lastGroupSyncTime,
          nextSyncTime,
          syncSchedule: process.env.SAP_GROUP_SYNC_SCHEDULE || '0 */6 * * *',
          isActive: !!(sapIntegrationService.groupSyncTasks && 
                   sapIntegrationService.groupSyncTasks[groupCodeNum])
        }
      });
    } catch (error) {
      logger.error('Error al obtener estado de sincronización de grupo', {
        error: error.message,
        stack: error.stack,
        groupCode: req.params.groupCode,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado de sincronización de grupo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
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
   *                 description: Programación en formato cron (ej. "0 * /6 * * *" para cada 6 horas)
   *                 example: "0 * /6 * * *"
   *               enabled:
   *                 type: boolean
   *                 description: Indica si la sincronización está habilitada
   *                 example: true
   *     responses:
   *       200:
   *         description: Configuración actualizada exitosamente
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
   *                   example: Configuración de sincronización actualizada exitosamente
   *                 data:
   *                   type: object
   *                   properties:
   *                     groupCode:
   *                       type: integer
   *                       example: 127
   *                     schedule:
   *                       type: string
   *                       example: "0 * /6 * * *"
   *                     enabled:
   *                       type: boolean
   *                       example: true
   *       400:
   *         description: Formato de programación inválido
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos suficientes
   *       500:
   *         description: Error interno del servidor
   */
  async configureGroupSync(req, res) {
    try {
      const { groupCode } = req.params;
      const { schedule, enabled } = req.body;
      
      const groupCodeNum = parseInt(groupCode);
      if (isNaN(groupCodeNum)) {
        return res.status(400).json({
          success: false,
          message: 'El código de grupo debe ser un número'
        });
      }
      
      logger.info('Configurando sincronización de grupo', {
        groupCode: groupCodeNum,
        schedule,
        enabled,
        userId: req.user?.id
      });
      
      // Validar el formato cron
      if (schedule && !cron.validate(schedule)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de programación cron inválido'
        });
      }
      
      // Si se proporcionó un nuevo schedule, actualizar la programación
      if (schedule) {
        // Si la sincronización está habilitada (o no se especificó enabled)
        if (enabled !== false) {
          // Programar o reprogramar la tarea
          sapIntegrationService.scheduleGroupSyncTask(groupCodeNum, schedule);
          
          logger.info('Sincronización de grupo reprogramada', {
            groupCode: groupCodeNum,
            schedule,
            userId: req.user?.id
          });
        }
      }
      
      // Si se especificó enabled como false, detener la sincronización
      if (enabled === false) {
        if (sapIntegrationService.groupSyncTasks && 
            sapIntegrationService.groupSyncTasks[groupCodeNum]) {
          
          sapIntegrationService.groupSyncTasks[groupCodeNum].stop();
          delete sapIntegrationService.groupSyncTasks[groupCodeNum];
          
          logger.info('Sincronización de grupo detenida', {
            groupCode: groupCodeNum,
            userId: req.user?.id
          });
        }
      } else if (enabled === true && !schedule) {
        // Si se especificó enabled como true pero no se proporcionó schedule,
        // usar el schedule por defecto o el actualmente configurado
        const currentSchedule = process.env.SAP_GROUP_SYNC_SCHEDULE || '0 */6 * * *';
        sapIntegrationService.scheduleGroupSyncTask(groupCodeNum, currentSchedule);
        
        logger.info('Sincronización de grupo habilitada con programación actual', {
          groupCode: groupCodeNum,
          schedule: currentSchedule,
          userId: req.user?.id
        });
      }
      
      // Obtener estado actual después de los cambios
      const currentSchedule = schedule || process.env.SAP_GROUP_SYNC_SCHEDULE || '0 */6 * * *';
      const isActive = !!(sapIntegrationService.groupSyncTasks && 
                       sapIntegrationService.groupSyncTasks[groupCodeNum]);
      
      res.status(200).json({
        success: true,
        message: 'Configuración de sincronización actualizada exitosamente',
        data: {
          groupCode: groupCodeNum,
          schedule: currentSchedule,
          enabled: isActive
        }
      });
    } catch (error) {
      logger.error('Error al configurar sincronización de grupo', {
        error: error.message,
        stack: error.stack,
        groupCode: req.params.groupCode,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al configurar sincronización de grupo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
 * Implementación de la sincronización de grupos desde SAP B1
 * @private
 * @param {number} groupCodeNum - Código del grupo a sincronizar
 * @param {boolean} isActive - Filtrar solo productos activos
 * @param {number} limit - Límite de productos por lote
 * @returns {Promise<Object>} Estadísticas de sincronización
 */
async performGroupSyncFromSAP(groupCodeNum, isActive, limit) {
    const stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0
    };
    
    let sessionId = null;
    let client = null;
    
    try {
      // 1. Autenticar con SAP B1
      sessionId = await this.authenticateWithSAP();
      
      // 2. Consultar productos por grupo y filtro de actividad
      const productBatches = await this.fetchProductsFromSAP(sessionId, groupCodeNum, isActive, limit);
      
      // 3. Procesar productos en la base de datos dentro de una transacción
      client = await pool.connect();
      await client.query('BEGIN');
      
      for (const batch of productBatches) {
        for (const sapProduct of batch) {
          try {
            stats.total++;
            
            // Convertir producto SAP al formato de nuestra base de datos
            const mappedProduct = this.mapSapProductToWebApp(sapProduct);
            
            // Verificar si el producto ya existe por código SAP
            const existingProduct = await this.findProductBySapCode(client, sapProduct.ItemCode);
            
            if (existingProduct) {
              // Actualizar producto existente
              await this.updateProduct(client, existingProduct.product_id, mappedProduct);
              stats.updated++;
              
              logger.debug('Producto actualizado desde SAP', {
                sapCode: sapProduct.ItemCode,
                name: sapProduct.ItemName,
                productId: existingProduct.product_id
              });
            } else {
              // Crear nuevo producto
              const newProduct = await this.createProduct(client, mappedProduct);
              stats.created++;
              
              logger.debug('Producto creado desde SAP', {
                sapCode: sapProduct.ItemCode,
                name: sapProduct.ItemName,
                productId: newProduct.product_id
              });
            }
          } catch (productError) {
            stats.errors++;
            logger.error('Error al procesar producto individual desde SAP', {
              itemCode: sapProduct.ItemCode,
              error: productError.message,
              stack: productError.stack
            });
            // Continuar con el siguiente producto sin interrumpir el proceso completo
          }
        }
      }
      
      // Commit si todo ha ido bien
      await client.query('COMMIT');
      
      logger.info('Sincronización de productos desde SAP completada', {
        groupCode: groupCodeNum,
        stats
      });
      
      return stats;
    } catch (error) {
      // Rollback en caso de error
      if (client) {
        try {
          await client.query('ROLLBACK');
          logger.info('Rollback ejecutado después de error', { 
            groupCode: groupCodeNum 
          });
        } catch (rollbackError) {
          logger.error('Error al realizar rollback', {
            error: rollbackError.message,
            groupCode: groupCodeNum
          });
        }
      }
      
      logger.error('Error en sincronización de productos desde SAP', {
        error: error.message,
        stack: error.stack,
        groupCode: groupCodeNum
      });
      
      throw error;
    } finally {
      // Liberar recursos
      if (client) {
        client.release();
      }
      
      // Cerrar sesión SAP
      if (sessionId) {
        try {
          await this.logoutFromSAP(sessionId);
        } catch (logoutError) {
          logger.warn('Error al cerrar sesión SAP', {
            error: logoutError.message
          });
        }
      }
    }
  }
  
  /**
   * Autenticación con SAP Service Layer
   * @private
   * @returns {Promise<string>} Identificador de sesión
   */
  async authenticateWithSAP() {
    try {
      logger.debug('Iniciando autenticación con SAP B1 Service Layer');
      
      // Verificar configuración
      const sapConfig = {
        baseUrl: process.env.SAP_SERVICE_LAYER_URL,
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
        companyDB: process.env.SAP_COMPANY_DB
      };
      
      // Comprobar configuración completa
      if (!sapConfig.baseUrl || !sapConfig.username || !sapConfig.password || !sapConfig.companyDB) {
        throw new Error('Configuración incompleta para conectar con SAP B1. Verifique variables de entorno.');
      }
      
      const response = await axios.post(`${sapConfig.baseUrl}/Login`, {
        CompanyDB: sapConfig.companyDB,
        UserName: sapConfig.username,
        Password: sapConfig.password
      });
  
      if (response.status === 200) {
        // Extraer sessionId de las cookies
        const cookies = response.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
          const sessionCookie = cookies.find(cookie => cookie.startsWith('B1SESSION='));
          if (sessionCookie) {
            const sessionId = sessionCookie.split(';')[0].split('=')[1];
            logger.info('Autenticación exitosa con SAP B1', { 
              sessionId: sessionId ? `${sessionId.substring(0, 5)}...` : undefined 
            });
            return sessionId;
          }
        }
        throw new Error('No se pudo extraer la sesión de la respuesta');
      } else {
        throw new Error(`Error de autenticación: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error en autenticación con SAP B1', {
        error: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      throw new Error(`Error de autenticación con SAP B1: ${error.message}`);
    }
  }
  
  /**
   * Cierra la sesión con SAP B1
   * @private
   * @param {string} sessionId - Identificador de sesión
   * @returns {Promise<void>}
   */
  async logoutFromSAP(sessionId) {
    try {
      logger.debug('Cerrando sesión con SAP B1');
      
      await axios.post(`${process.env.SAP_SERVICE_LAYER_URL}/Logout`, {}, {
        headers: {
          'Cookie': `B1SESSION=${sessionId}`
        }
      });
      
      logger.info('Sesión cerrada exitosamente con SAP B1');
    } catch (error) {
      logger.warn('Error al cerrar sesión con SAP B1', {
        error: error.message
      });
      // No propagamos este error porque es solo de limpieza
    }
  }
  
  /**
   * Obtiene productos de SAP por grupo
   * @private
   * @param {string} sessionId - ID de sesión SAP
   * @param {number} groupCode - Código de grupo de artículos
   * @param {boolean} isActive - Solo productos activos
   * @param {number} batchLimit - Límite por lote
   * @returns {Promise<Array<Array>>} Lotes de productos
   */
  async fetchProductsFromSAP(sessionId, groupCode, isActive, batchLimit) {
    const productBatches = [];
    let hasMoreProducts = true;
    let skip = 0;
    
    try {
      logger.debug('Consultando productos de SAP B1', {
        groupCode,
        isActive,
        batchLimit
      });
      
      // Construir filtro base: siempre filtramos por grupo
      let filter = `ItemsGroupCode eq ${groupCode}`;
      
      // Si solo queremos activos, añadir filtro
      // Ajustar según la estructura específica de SAP B1
      if (isActive) {
        // Este es un ejemplo, la condición exacta dependerá de cómo se marca "activo" en SAP B1
        // Podría ser 'Frozen' para inactivos, o U_Web_Published para publicación, etc.
        if (filter) filter += ' and ';
        filter += `Frozen eq 'N'`;
        
        // Si existe un campo personalizado para publicación web, añadirlo
        if (process.env.SAP_WEB_PUBLISHED_FIELD) {
          filter += ` and ${process.env.SAP_WEB_PUBLISHED_FIELD} eq 'Y'`;
        }
      }
      
      // No exceder más de 5 lotes (5000 productos máximo) por seguridad
      const maxBatches = 5;
      let batchCount = 0;
      
      while (hasMoreProducts && batchCount < maxBatches) {
        // Construir URL con selección de campos específica
        const endpoint = `Items?$select=ItemCode,ItemName,ItemsGroupCode,QuantityOnStock,U_Web_Description,PictureName` +
                         `&$filter=${filter}` +
                         `&$skip=${skip}&$top=${batchLimit}`;
        
        const response = await axios.get(`${process.env.SAP_SERVICE_LAYER_URL}/${endpoint}`, {
          headers: {
            'Cookie': `B1SESSION=${sessionId}`
          }
        });
        
        const data = response.data;
        
        if (!data || !data.value) {
          throw new Error('Formato de respuesta inválido al consultar productos SAP');
        }
        
        const products = data.value;
        productBatches.push(products);
        
        logger.info('Lote de productos obtenido de SAP B1', {
          batchNumber: batchCount + 1,
          count: products.length,
          hasMore: !!data['odata.nextLink']
        });
        
        // Verificar si hay más productos
        hasMoreProducts = !!data['odata.nextLink'] && products.length > 0;
        if (hasMoreProducts) {
          skip += batchLimit;
          batchCount++;
        }
      }
      
      return productBatches;
    } catch (error) {
      logger.error('Error al obtener productos de SAP B1', {
        error: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        groupCode
      });
      throw error;
    }
  }
  
  /**
   * Mapea un producto de SAP B1 al formato de la WebApp
   * @private
   * @param {Object} sapProduct - Producto en formato SAP B1
   * @returns {Object} Producto en formato WebApp
   */
  mapSapProductToWebApp(sapProduct) {
    // Determinar la URL de imagen si existe
    let imageUrl = null;
    if (sapProduct.PictureName) {
      imageUrl = process.env.SAP_IMAGES_BASE_URL 
        ? `${process.env.SAP_IMAGES_BASE_URL}/${sapProduct.PictureName}` 
        : sapProduct.PictureName;
    }
    
    return {
      name: sapProduct.ItemName,
      description: sapProduct.U_Web_Description || sapProduct.ItemName,
      price_list1: 0, // Por defecto, los precios se deben obtener de otra consulta
      price_list2: 0,
      price_list3: 0,
      stock: sapProduct.QuantityOnStock || 0,
      barcode: sapProduct.ItemCode, // ItemCode como barcode
      image_url: imageUrl,
      sap_code: sapProduct.ItemCode,
      sap_group: sapProduct.ItemsGroupCode,
      sap_last_sync: new Date().toISOString(),
      sap_sync_pending: false,
      is_active: true
    };
  }
  
  /**
   * Busca un producto por su código SAP
   * @private
   * @param {Object} client - Cliente de base de datos
   * @param {string} sapCode - Código de producto en SAP
   * @returns {Promise<Object|null>} Producto encontrado o null
   */
  async findProductBySapCode(client, sapCode) {
    try {
      const query = 'SELECT * FROM products WHERE sap_code = $1;';
      const { rows } = await client.query(query, [sapCode]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Error al buscar producto por código SAP', {
        error: error.message,
        sapCode
      });
      throw error;
    }
  }
  
  /**
   * Crea un nuevo producto
   * @private
   * @param {Object} client - Cliente de base de datos
   * @param {Object} product - Datos del producto
   * @returns {Promise<Object>} Producto creado
   */
  async createProduct(client, product) {
    try {
      const query = `
        INSERT INTO products (
          name, description, price_list1, price_list2, price_list3,
          stock, barcode, image_url, sap_code, sap_group, sap_last_sync,
          sap_sync_pending, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;
      
      const values = [
        product.name, 
        product.description, 
        product.price_list1, 
        product.price_list2, 
        product.price_list3,
        product.stock, 
        product.barcode, 
        product.image_url, 
        product.sap_code, 
        product.sap_group, 
        product.sap_last_sync,
        product.sap_sync_pending,
        product.is_active
      ];
      
      const { rows } = await client.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error('Error al crear producto', {
        error: error.message,
        sap_code: product.sap_code,
        name: product.name
      });
      throw error;
    }
  }
  
  /**
   * Actualiza un producto existente
   * @private
   * @param {Object} client - Cliente de base de datos
   * @param {number} productId - ID del producto
   * @param {Object} product - Datos actualizados
   * @returns {Promise<Object>} Producto actualizado
   */
  async updateProduct(client, productId, product) {
    try {
      const query = `
        UPDATE products
        SET 
          name = $1,
          description = $2,
          price_list1 = $3,
          price_list2 = $4,
          price_list3 = $5,
          stock = $6,
          image_url = $7,
          sap_code = $8,
          sap_group = $9,
          sap_last_sync = $10,
          sap_sync_pending = $11,
          is_active = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $13
        RETURNING *;
      `;
      
      const values = [
        product.name, 
        product.description, 
        product.price_list1, 
        product.price_list2, 
        product.price_list3,
        product.stock, 
        product.image_url, 
        product.sap_code, 
        product.sap_group, 
        product.sap_last_sync,
        product.sap_sync_pending,
        product.is_active,
        productId
      ];
      
      const { rows } = await client.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error('Error al actualizar producto', {
        error: error.message,
        productId,
        sap_code: product.sap_code
      });
      throw error;
    }
  }
}

// Crear instancia del controlador
const sapSyncController = new SapSyncController();

// Exportar métodos del controlador
module.exports = {
  startSync: sapSyncController.startSync,
  syncProductToSAP: sapSyncController.syncProductToSAP,
  getSyncStatus: sapSyncController.getSyncStatus,
  syncProductsByGroup: sapSyncController.syncProductsByGroup,
  getGroupSyncStatus: sapSyncController.getGroupSyncStatus,
  configureGroupSync: sapSyncController.configureGroupSync
};