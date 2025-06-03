const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('HealthRoutes');

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Endpoints para verificar el estado del sistema
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check del sistema
 *     description: Verifica el estado de la aplicación y sus dependencias
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Sistema funcionando correctamente
 *   options:
 *     summary: Preflight para health check
 *     description: Maneja solicitudes OPTIONS para CORS
 *     tags: [Health]
 *     responses:
 *       204:
 *         description: Preflight exitoso
 */

// Health check completo con verificación de base de datos
const healthCheck = async (req, res) => {
  try {
    console.log('\n=== HEALTH CHECK ===');
    console.log('Method:', req.method);
    console.log('Origin:', req.headers.origin || 'Sin origin');
    console.log('User-Agent:', req.headers['user-agent']?.substring(0, 50) || 'No disponible');
    console.log('===================\n');

    const startTime = Date.now();
    
    // Verificar conexión a la base de datos
    let dbStatus = 'connected';
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (dbError) {
      logger.error('Error en health check - base de datos', {
        error: dbError.message
      });
      dbStatus = 'disconnected';
    }
    
    const responseTime = Date.now() - startTime;
    
    const healthData = {
      status: dbStatus === 'connected' ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
      responseTime: `${responseTime}ms`,
      version: '1.1.0',
      cors_debug: {
        origin: req.headers.origin,
        allowed_origins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || []
      }
    };
    
    // Si hay problemas críticos, devolver 503
    if (dbStatus === 'disconnected') {
      logger.warn('Health check falló - base de datos desconectada');
      return res.status(503).json({
        ...healthData,
        status: 'ERROR',
        error: 'Database connection failed'
      });
    }
    
    // Todo está bien
    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Error en health check', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Internal server error'
    });
  }
};

// Health check simplificado para ALB
const simpleHealthCheck = (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

// Manejar OPTIONS para CORS preflight
const handleOptions = (req, res) => {
  console.log('\n=== OPTIONS REQUEST ===');
  console.log('Path:', req.path);
  console.log('Origin:', req.headers.origin);
  console.log('Access-Control-Request-Method:', req.headers['access-control-request-method']);
  console.log('Access-Control-Request-Headers:', req.headers['access-control-request-headers']);
  console.log('=====================\n');
  
  res.status(204).end();
};

// Rutas
router.get('/health', healthCheck);
router.options('/health', handleOptions);
router.get('/health/simple', simpleHealthCheck);
router.options('/health/simple', handleOptions);

module.exports = router;