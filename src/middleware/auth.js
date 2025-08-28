// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { createContextLogger } = require('../config/logger');
const BranchAuth = require('../models/BranchAuth');
const ROLES = require('../constants/roles');
const { TokenRevocation } = require('./tokenRevocation');

const logger = createContextLogger('AuthMiddleware');

// Función para verificar tokens de sucursales
const verifyBranchToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Token de autorización requerido. Use: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que es un token de sucursal
    if (decoded.type !== 'branch') {
      return res.status(401).json({
        status: 'error',
        message: 'Tipo de token inválido para esta operación'
      });
    }
    
    // Verificar que la sucursal existe y está activa
    const branch = await BranchAuth.findById(decoded.branch_id);
    if (!branch || !branch.is_login_enabled) {
      return res.status(401).json({
        status: 'error',
        message: 'Sucursal no encontrada o deshabilitada'
      });
    }
    
    req.branch = {
      branch_id: decoded.branch_id,
      email: decoded.email,
      manager_name: decoded.manager_name,
      branch_name: decoded.branch_name,
      client_id: decoded.client_id,
      client_name: decoded.client_name,
      type: 'branch'
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token de sucursal expirado', {
        error: error.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'El token ha expirado. Por favor, inicie sesión nuevamente.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Token de sucursal inválido', {
        error: error.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido. Por favor, inicie sesión nuevamente.',
        code: 'INVALID_TOKEN'
      });
    }
    
    logger.error('Error de verificación de token de sucursal:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(401).json({
      status: 'error',
      message: 'Error de autenticación de sucursal',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Función para verificar cualquier tipo de token (usuario o sucursal)
const verifyAnyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Token de autorización requerido. Use: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type === 'branch') {
      // Es un token de sucursal
      const branch = await BranchAuth.findById(decoded.branch_id);
      if (!branch || !branch.is_login_enabled) {
        return res.status(401).json({
          status: 'error',
          message: 'Sucursal no encontrada o deshabilitada'
        });
      }
      
      req.branch = {
        branch_id: decoded.branch_id,
        email: decoded.email,
        manager_name: decoded.manager_name,
        branch_name: decoded.branch_name,
        client_id: decoded.client_id,
        client_name: decoded.client_name,
        type: 'branch'
      };
      req.authType = 'branch';
    } else {
      // Es un token de usuario normal
      req.user = {
        id: decoded.id,
        mail: decoded.mail,
        name: decoded.name,
        rol_id: decoded.rol_id
      };
      req.authType = 'user';
    }
    
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Token inválido o expirado',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

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

    // ✅ CAMBIO: Verificar el token ANTES de verificar revocación
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar si el token está revocado
    const isRevoked = await TokenRevocation.isTokenRevoked(token);
    if (isRevoked) {
      logger.warn('Intento de uso de token revocado', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: decoded.id
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'La sesión ha expirado o ha sido revocada. Por favor, inicie sesión nuevamente.',
        code: 'TOKEN_REVOKED'
      });
    }

    // ✅ SOLUCIÓN: Verificación mejorada de revocación global
    const query = `
      SELECT revoke_all_before, revoked_at
      FROM revoked_tokens 
      WHERE user_id = $1 
      AND (token_hash = 'all_tokens' OR token_hash LIKE 'all_tokens_%')
      AND expires_at > NOW()
      ORDER BY revoked_at DESC
      LIMIT 1
    `;

    const { rows } = await require('../config/db').query(query, [decoded.id]);

    if (rows.length > 0) {
      const revokeAllBefore = new Date(rows[0].revoke_all_before);
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      
      logger.debug('Verificación de revocación global', {
        context: 'AuthMiddleware',
        userId: decoded.id,
        tokenIssuedAt: tokenIssuedAt.toISOString(),
        revokeAllBefore: revokeAllBefore.toISOString(),
        tokenIatSeconds: decoded.iat,
        currentTime: new Date().toISOString(),
        timeDifferenceMs: revokeAllBefore.getTime() - tokenIssuedAt.getTime(),
        isRevoked: tokenIssuedAt <= revokeAllBefore,
        timestamp: new Date().toISOString()
      });
      
      if (tokenIssuedAt < revokeAllBefore) { 
        logger.warn('Token anterior a revocación global detectado', {
          userId: decoded.id,
          ip: req.ip,
          tokenIssuedAt: tokenIssuedAt.toISOString(),
          revokeAllBefore: revokeAllBefore.toISOString()
        });
        
        return res.status(401).json({
          status: 'error',
          message: 'La sesión ha expirado debido a un cambio de seguridad. Por favor, inicie sesión nuevamente.',
          code: 'TOKEN_GLOBALLY_REVOKED'
        });
      }
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
        return roleName === 'ADMIN' ? 1 : (roleName === 'USER' ? 2 : (roleName === 'FUNCTIONAL_ADMIN' ? 3 : role));
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
  checkRole,
  verifyBranchToken,
  verifyAnyToken
};