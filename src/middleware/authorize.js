const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('AuthorizeMiddleware');

/**
 * Middleware para autorizar acceso basado en roles
 * @param {Array<number>} roles - Array de IDs de roles permitidos
 * @returns {Function} Middleware de Express
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        logger.warn('Intento de acceso sin autenticación', {
          ip: req.ip,
          path: req.path
        });
        
        return res.status(401).json({
          success: false,
          message: 'No autorizado',
          errorCode: 'AUTH_MISSING_TOKEN'
        });
      }
      
      // Si no se especifican roles, permitir a cualquier usuario autenticado
      if (roles.length === 0) {
        return next();
      }
      
      // Verificar que el usuario tenga alguno de los roles permitidos
      if (!roles.includes(req.user.rol_id)) {
        logger.warn('Intento de acceso con rol no autorizado', {
          userId: req.user.id,
          userRole: req.user.rol_id,
          requiredRoles: roles,
          path: req.path
        });
        
        return res.status(403).json({
          success: false,
          message: 'Acceso prohibido. No tiene los permisos necesarios.',
          errorCode: 'AUTH_INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Usuario autenticado y con rol permitido
      next();
    } catch (error) {
      logger.error('Error en middleware de autorización', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

module.exports = authorize;