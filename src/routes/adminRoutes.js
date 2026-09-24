const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');
const { sanitizeBody } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Endpoints para administración del portal
 */

// Configuración para express-fileupload (compartida con backofficeCoreRoutes.js)
const fileUploadOptions = require('../config/adminFileUploadOptions');

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

// Aplicar sanitización de datos
router.use(sanitizeBody);

// Obtener configuración del portal - permitir a todos los usuarios autenticados
router.get('/settings', adminController.getSettings);

// Actualizar configuración del portal - solo administradores (roles 1 y 3)
router.post('/settings',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  fileUpload(fileUploadOptions),
  adminController.updateSettings);
  // Gestión de login de sucursales - solo administradores
router.post('/branches/:branchId/enable-login',
  requirePermission(PERMISSIONS.BRANCH_LOGIN_MANAGE),
  adminController.enableBranchLogin);

router.post('/branches/:branchId/disable-login',
  requirePermission(PERMISSIONS.BRANCH_LOGIN_MANAGE),
  adminController.disableBranchLogin);

module.exports = router;