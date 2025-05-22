const ClientBranch = require('../models/ClientBranch');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ClientBranchController');

/**
 * Controlador para las sucursales de cliente
 */
class ClientBranchController {
  /**
   * Obtiene todas las sucursales de un cliente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  async getBranchesByClientId(req, res) {
    try {
      const { clientId } = req.params;
      
      logger.debug('Solicitando sucursales para cliente', { clientId });
      
      const branches = await ClientBranch.getByClientId(clientId);
      
      res.status(200).json({
        success: true,
        data: branches
      });
    } catch (error) {
      logger.error('Error al obtener sucursales por cliente', {
        error: error.message,
        stack: error.stack,
        clientId: req.params.clientId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener sucursales',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Obtiene todas las sucursales de un cliente por ID de usuario
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  async getBranchesByUserId(req, res) {
    try {
      const { userId } = req.params;
      
      logger.debug('Solicitando sucursales para usuario', { userId });
      
      // Verificar permisos - solo el propio usuario o un administrador pueden ver sus sucursales
      if (parseInt(userId) !== req.user.id && req.user.rol_id !== 1) {
        logger.warn('Intento de acceso no autorizado a sucursales de usuario', {
          targetUserId: userId,
          requestingUserId: req.user.id
        });
        
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver estas sucursales'
        });
      }
      
      const branches = await ClientBranch.getByUserId(userId);
      
      res.status(200).json({
        success: true,
        data: branches
      });
    } catch (error) {
      logger.error('Error al obtener sucursales por usuario', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener sucursales',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Crear instancia del controlador
const clientBranchController = new ClientBranchController();

// Exportar métodos del controlador
module.exports = {
  getBranchesByClientId: clientBranchController.getBranchesByClientId,
  getBranchesByUserId: clientBranchController.getBranchesByUserId
};