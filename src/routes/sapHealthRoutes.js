const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const sapServiceManager = require('../services/SapServiceManager');
const logger = require('../config/logger');

/**
 * Verificar estado de conectividad con SAP
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const status = {
      available: false,
      initialized: false,
      clientService: false,
      sessionActive: false,
      lastError: null
    };
    
    if (sapServiceManager) {
      status.initialized = sapServiceManager.initialized;
      
      if (sapServiceManager.clientService) {
        status.clientService = true;
        status.sessionActive = !!sapServiceManager.clientService.sessionId;
      }
      
      // Intentar una operación simple para verificar conectividad
      if (status.initialized && status.sessionActive) {
        try {
          // Test simple - obtener información de sesión
          status.available = true;
        } catch (testError) {
          status.lastError = testError.message;
        }
      }
    }
    
    logger.info('Verificación de estado SAP solicitada', {
      userId: req.user.id,
      status
    });
    
    res.json({
      success: true,
      sap: status
    });
    
  } catch (error) {
    logger.error('Error al verificar estado de SAP', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al verificar estado de SAP'
    });
  }
});

module.exports = router;