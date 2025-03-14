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

// Aplicar middleware de autorización para administradores (roles 1 y 3)
router.use(authorize([1, 3]));

// Aplicar sanitización de datos
router.use(sanitizeBody);

// Obtener configuración del portal
router.get('/settings', adminController.getSettings);

// Actualizar configuración del portal (con soporte para subir archivos)
router.post('/settings', fileUpload(fileUploadOptions), adminController.updateSettings);

module.exports = router;