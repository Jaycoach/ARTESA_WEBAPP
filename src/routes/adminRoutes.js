const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { sanitizeBody } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Endpoints para administración del portal
 */

// Configuración para express-fileupload
const fileUploadOptions = {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  useTempFiles: true,
  tempFileDir: './tmp/',
  createParentPath: true,
  abortOnLimit: true,
  responseOnLimit: 'El archivo excede el límite de 5MB.'
};

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

// Aplicar sanitización de datos
router.use(sanitizeBody);

// Obtener configuración del portal - permitir a todos los usuarios autenticados
router.get('/settings', adminController.getSettings);

// Actualizar configuración del portal - solo administradores (roles 1 y 3)
router.post('/settings', 
  authorize([1, 3]), // Solo administradores pueden actualizar
  fileUpload(fileUploadOptions), 
  adminController.updateSettings);
  // Gestión de login de sucursales - solo administradores
router.post('/branches/:branchId/enable-login', 
  authorize([1]), // Solo administradores principales
  adminController.enableBranchLogin);

router.post('/branches/:branchId/disable-login', 
  authorize([1]), // Solo administradores principales
  adminController.disableBranchLogin);

module.exports = router;