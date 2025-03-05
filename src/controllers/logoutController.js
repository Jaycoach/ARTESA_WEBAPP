const { createContextLogger } = require('../config/logger');
const { TokenRevocation } = require('../middleware/tokenRevocation');
const jwt = require('jsonwebtoken');

// Crear una instancia del logger con contexto
const logger = createContextLogger('LogoutController');

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Revoca el token actual y cierra la sesión del usuario
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
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
 *                   example: Sesión cerrada exitosamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
const logout = async (req, res) => {
  try {
    const token = req.token;
    const userId = req.user?.id;
    const tokenExpiry = req.tokenExpiry;
    
    logger.debug('Iniciando proceso de logout', { userId });
    
    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Datos insuficientes para procesar el logout'
      });
    }

    // Revocar el token actual
    const success = await TokenRevocation.revokeToken(token, userId, tokenExpiry);
    
    if (success) {
      logger.info('Logout exitoso', { userId });
      
      res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    } else {
      logger.warn('Error al revocar token en logout', { userId });
      
      res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión, pero el cliente puede continuar con el proceso de logout'
      });
    }
  } catch (error) {
    logger.error('Error en proceso de logout', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud de logout'
    });
  }
};

/**
 * @swagger
 * /api/auth/logout/all:
 *   post:
 *     summary: Cerrar todas las sesiones
 *     description: Revoca todos los tokens activos del usuario
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todas las sesiones cerradas exitosamente
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
 *                   example: Todas las sesiones han sido cerradas exitosamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    logger.debug('Iniciando proceso de logout de todas las sesiones', { userId });
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Datos insuficientes para procesar el logout'
      });
    }

    // Revocar todos los tokens del usuario
    const success = await TokenRevocation.revokeAllUserTokens(userId, 'user_requested');
    
    if (success) {
      logger.info('Logout de todas las sesiones exitoso', { userId });
      
      res.status(200).json({
        success: true,
        message: 'Todas las sesiones han sido cerradas exitosamente'
      });
    } else {
      logger.warn('Error al revocar todos los tokens en logout', { userId });
      
      res.status(500).json({
        success: false,
        message: 'Error al cerrar todas las sesiones'
      });
    }
  } catch (error) {
    logger.error('Error en proceso de logout de todas las sesiones', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud de logout de todas las sesiones'
    });
  }
};

/**
 * Endpoint administrativo para revocar tokens de usuarios
 * @swagger
 * /api/auth/admin/revoke/{userId}:
 *   post:
 *     summary: Revocar todas las sesiones de un usuario
 *     description: Revoca todos los tokens activos de un usuario específico (solo administradores)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario cuyos tokens se revocarán
 *     responses:
 *       200:
 *         description: Tokens revocados exitosamente
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
 *                   example: Tokens revocados exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
const adminRevokeUserTokens = async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.debug('Solicitud administrativa para revocar tokens de usuario', { 
      targetUserId: userId,
      adminUserId: req.user.id 
    });

    // Revocar todos los tokens del usuario especificado
    const success = await TokenRevocation.revokeAllUserTokens(
      userId, 
      'admin_revoked'
    );
    
    if (success) {
      logger.info('Tokens de usuario revocados por administrador', { 
        targetUserId: userId,
        adminUserId: req.user.id 
      });
      
      res.status(200).json({
        success: true,
        message: 'Tokens revocados exitosamente'
      });
    } else {
      logger.warn('Error al revocar tokens de usuario', { targetUserId: userId });
      
      res.status(500).json({
        success: false,
        message: 'Error al revocar tokens'
      });
    }
  } catch (error) {
    logger.error('Error en proceso de revocación administrativa de tokens', {
      error: error.message,
      stack: error.stack,
      targetUserId: req.params.userId,
      adminUserId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud de revocación de tokens'
    });
  }
};

module.exports = {
  logout,
  logoutAllSessions,
  adminRevokeUserTokens
};