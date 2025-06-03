const { createContextLogger } = require('../config/logger');
const pool = require('../config/db');

// Crear una instancia del logger con contexto
const logger = createContextLogger('HealthController');

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 3600.123
 *                 environment:
 *                   type: string
 *                   example: "staging"
 *                 database:
 *                   type: string
 *                   example: "connected"
 *       503:
 *         description: Servicio no disponible
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ERROR"
 *                 error:
 *                   type: string
 *                   example: "Database connection failed"
 */
const healthCheck = async (req, res) => {
  try {
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
      version: '1.1.0'
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

/**
 * Health check simplificado para ALB (sin autenticación)
 */
const simpleHealthCheck = (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  healthCheck,
  simpleHealthCheck
};