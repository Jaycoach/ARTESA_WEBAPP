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
          await sapIntegrationService.syncProductsFromSAP(true);
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
  getSyncStatus: sapSyncController.getSyncStatus,
  syncProductsByGroup: sapSyncController.syncProductsByGroup,
  getGroupSyncStatus: sapSyncController.getGroupSyncStatus,
  configureGroupSync: sapSyncController.configureGroupSync
};