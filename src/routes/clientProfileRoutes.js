// Rutas para el perfil de cliente
const express = require('express');
const router = express.Router();
const clientProfileController = require('../controllers/clientProfileController');
const { authMiddleware } = require('../middleware/authMiddleware');
const fileUpload = require('express-fileupload');

// Middleware para manejar la subida de archivos
router.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB por archivo
  createParentPath: true
}));

// Crear un nuevo perfil de cliente (protegido por autenticación)
router.post('/client-profile', authMiddleware, clientProfileController.create);

// Obtener el perfil de un cliente por su ID de usuario (protegido por autenticación)
router.get('/client-profile/:userId', authMiddleware, clientProfileController.getByUserId);

// Actualizar el perfil de un cliente (protegido por autenticación)
router.put('/client-profile/:userId', authMiddleware, clientProfileController.update);

// Eliminar un perfil (protegido por autenticación)
router.delete('/client-profile/:userId', authMiddleware, clientProfileController.delete);

// Obtener un archivo específico del perfil (protegido por autenticación)
router.get('/client-profile/:userId/file/:fileType', authMiddleware, clientProfileController.getFile);

module.exports = router;