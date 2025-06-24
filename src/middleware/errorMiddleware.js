// src/middleware/errorMiddleware.js
const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('ErrorMiddleware');

/**
 * Middleware para manejar errores 404 (rutas no encontradas)
 * @param {object} req - Objeto de solicitud Express
 * @param {object} res - Objeto de respuesta Express
 * @param {function} next - Función para pasar al siguiente middleware
 */
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada - ${req.originalUrl}`);
  logger.warn(`Ruta no encontrada: ${req.originalUrl}`, {
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    suspiciousActivity: req.originalUrl.includes('.env') || req.originalUrl.includes('config')
  });
  res.status(404);
  next(error);
};

/**
 * Middleware para manejar cualquier error en la aplicación
 * @param {object} err - Objeto de error
 * @param {object} req - Objeto de solicitud Express
 * @param {object} res - Objeto de respuesta Express
 * @param {function} next - Función para pasar al siguiente middleware
 */
const errorHandler = (err, req, res, next) => {
  // Determinar el código de estado (usar 500 si el status code ya está en 200)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Registrar el error
  logger.error(`Error: ${err.message}`, {
    statusCode,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Responder al cliente
  res.status(statusCode).json({
    status: 'error',
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = {
  notFound,
  errorHandler
};