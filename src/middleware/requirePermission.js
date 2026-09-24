const { createContextLogger } = require('../config/logger');
const { PERMISSIONS, roleHasPermission } = require('../constants/permissions');

const logger = createContextLogger('RequirePermissionMiddleware');

const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS));

/**
 * Middleware de autorización por capacidad (no por rol directo).
 * Falla al MONTAR la ruta (no en tiempo de request) si la capacidad no existe
 * en PERMISSIONS — un error de tipeo tumba el arranque en Staging en vez de
 * convertirse en un 403 silencioso en producción.
 * @param {string} permission - una de las claves de PERMISSIONS (src/constants/permissions.js)
 * @returns {Function} Middleware de Express
 */
const requirePermission = (permission) => {
  if (!VALID_PERMISSIONS.has(permission)) {
    throw new Error(`requirePermission: capacidad desconocida "${permission}"`);
  }

  const middleware = (req, res, next) => {
    try {
      if (!req.user) {
        logger.warn('Intento de acceso sin autenticación', { ip: req.ip, path: req.path, permission });
        return res.status(401).json({
          success: false,
          message: 'No autorizado',
          errorCode: 'AUTH_MISSING_TOKEN'
        });
      }

      if (!roleHasPermission(req.user.rol_id, permission)) {
        logger.warn('Intento de acceso sin la capacidad requerida', {
          userId: req.user.id,
          userRole: req.user.rol_id,
          permission,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          message: 'Acceso prohibido. No tiene los permisos necesarios.',
          errorCode: 'AUTH_INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    } catch (error) {
      logger.error('Error en middleware de permisos', { error: error.message, stack: error.stack, permission });
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Nombra la función para que la cadena de middlewares de una ruta sea auditable
  // (por ejemplo, con router.stack[i].route.stack.map(s => s.name)), en vez de 'anon'.
  Object.defineProperty(middleware, 'name', { value: `requirePermission(${permission})` });

  return middleware;
};

module.exports = requirePermission;
