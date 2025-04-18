// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { createContextLogger } = require('../config/logger');
const ROLES = require('../constants/roles');
const { TokenRevocation } = require('./tokenRevocation');

const logger = createContextLogger('AuthMiddleware');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        status: 'error',
        message: 'No se proporcionó token de acceso'
      });
    }

    // Verificar formato del token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Formato de token inválido. Use: Bearer <token>'
      });
    }

    // Extraer el token
    const token = authHeader.split(' ')[1];

    // Verificar si el token está revocado
    const isRevoked = await TokenRevocation.isTokenRevoked(token);
    if (isRevoked) {
      logger.warn('Intento de uso de token revocado', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'La sesión ha expirado o ha sido revocada. Por favor, inicie sesión nuevamente.',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verificar el token con el mismo secreto usado en la generación
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar si hay una revocación global de tokens para este usuario
    const query = `
    SELECT 1 FROM revoked_tokens 
    WHERE user_id = $1 
    AND token_hash = 'all_tokens' 
    AND revoke_all_before > $2
    AND expires_at > NOW()
    LIMIT 1
  `;
    
    const { rows } = await require('../config/db').query(query, [
      decoded.id, 
      new Date(decoded.iat * 1000) // La fecha de emisión del token en formato JavaScript
    ]);
    
    if (rows.length > 0) {
      logger.warn('Intento de uso de token después de revocación global', {
        userId: decoded.id,
        ip: req.ip
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'La sesión ha expirado debido a un cambio de seguridad. Por favor, inicie sesión nuevamente.',
        code: 'TOKEN_GLOBALLY_REVOKED'
      });
    }
    
    // Agregar información del usuario al request
    req.user = {
      id: decoded.id,
      mail: decoded.mail,
      name: decoded.name,
      rol_id: decoded.rol_id
    };
    
    // Almacenar el token en el objeto request para posible uso posterior
    req.token = token;
    req.tokenExpiry = new Date(decoded.exp * 1000);
    
    next();
  } catch (error) {
    // Manejar específicamente errores de JWT
    if (error.name === 'TokenExpiredError') {
      logger.info('Token expirado', {
        error: error.message,
        expiredAt: error.expiredAt
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'La sesión ha expirado. Por favor, inicie sesión nuevamente.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Token JWT inválido', {
        error: error.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido. Por favor, inicie sesión nuevamente.',
        code: 'INVALID_TOKEN'
      });
    }
    
    logger.error('Error de verificación de token:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(401).json({
      status: 'error',
      message: 'Error de autenticación',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // Verificar que el usuario tenga rol_id
    if (!req.user || !req.user.rol_id) {
      return res.status(403).json({
        status: 'error',
        message: 'Usuario sin rol asignado'
      });
    }

    // Si se pasa el rol como string, convertirlo a su ID correspondiente
    const roleIds = allowedRoles.map(role => {
      if (typeof role === 'string') {
        // Manejar diferentes formatos del nombre del rol
        const roleName = role.toUpperCase();
        
        // Revisar si existe en nuestras constantes de ROLES
        if (ROLES[roleName] !== undefined) {
          return ROLES[roleName];
        } 
        
        // Caso alternativo: convertir directamente según convención conocida
        return roleName === 'ADMIN' ? 1 : (roleName === 'USER' ? 2 : role);
      }
      return role;
    });

    // Verificar si el rol del usuario está en los roles permitidos
    if (!roleIds.includes(req.user.rol_id)) {
      logger.warn('Intento de acceso sin permisos suficientes', {
        userId: req.user.id,
        userRole: req.user.rol_id,
        requiredRoles: roleIds,
        path: req.path
      });
      
      return res.status(403).json({
        status: 'error',
        message: 'No tiene permisos para realizar esta acción'
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  checkRole
};