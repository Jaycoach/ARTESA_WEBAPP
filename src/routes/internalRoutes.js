const express = require('express');
const router = express.Router();
const sapServiceManager = require('../services/SapServiceManager');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('InternalRoutes');

/**
 * Middleware que valida la clave interna del servidor.
 * Solo permite llamadas con X-Internal-Key válido.
 */
const validateInternalKey = (req, res, next) => {
  const internalKey = req.headers['x-internal-key'];
  const expectedKey = process.env.INTERNAL_SYNC_KEY;

  if (!expectedKey) {
    logger.error('INTERNAL_SYNC_KEY no está configurada en el entorno');
    return res.status(500).json({ success: false, message: 'Configuración interna incompleta' });
  }

  if (!internalKey || internalKey !== expectedKey) {
    logger.warn('Intento de acceso a ruta interna con clave inválida', {
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
  }

  next();
};

/**
 * POST /api/internal/sync-orders
 * Ejecuta la sincronización de órdenes con SAP.
 * Solo accesible con X-Internal-Key válido.
 */
router.post('/sync-orders', validateInternalKey, async (req, res) => {
  try {
    logger.info('Sincronización interna de órdenes iniciada', { ip: req.ip });

    if (!sapServiceManager.initialized) {
      await sapServiceManager.initialize();
    }

    const result = await sapServiceManager.syncOrders();

    logger.info('Sincronización interna de órdenes completada', result);

    return res.status(200).json({
      success: true,
      message: 'Sincronización completada',
      data: result
    });
  } catch (error) {
    logger.error('Error en sincronización interna de órdenes', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: 'Error en sincronización',
      error: error.message
    });
  }
});

module.exports = router;