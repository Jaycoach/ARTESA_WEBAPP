    // src/controllers/sapSyncController.js
const { createContextLogger } = require('../config/logger');
const sapIntegrationService = require('../services/SapIntegrationService');
const Product = require('../models/Product');

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
}

// Crear instancia del controlador
const sapSyncController = new SapSyncController();

// Exportar métodos del controlador
module.exports = {
  startSync: sapSyncController.startSync,
  syncProductToSAP: sapSyncController.syncProductToSAP,
  getSyncStatus: sapSyncController.getSyncStatus
};