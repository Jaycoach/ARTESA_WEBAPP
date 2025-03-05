// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const ROLES = require('../constants/roles');

const verifyToken = (req, res, next) => {
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

      // Verificar el token con el mismo secreto usado en la generación
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Log para debugging
      console.log('Token decodificado:', decoded);
      
      // Agregar información del usuario al request
      req.user = {
          id: decoded.id,
          mail: decoded.mail,
          name: decoded.name,
          rol_id: decoded.rol_id
      };
      
      next();
  } catch (error) {
      console.error('Error de verificación de token:', error);
      return res.status(401).json({
          status: 'error',
          message: 'Token inválido o expirado',
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

    // Log para debugging
    console.log('Rol del usuario:', req.user.rol_id);
    console.log('Roles permitidos:', roleIds);

    // Verificar si el rol del usuario está en los roles permitidos
    if (!roleIds.includes(req.user.rol_id)) {
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