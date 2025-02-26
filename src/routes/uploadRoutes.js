// src/routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { verifyToken, checkRole } = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');

// Asegurar que el directorio de uploads exista
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer para almacenamiento local
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generar nombre único para evitar colisiones
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    cb(null, fileName);
  }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  // Aceptar solo formatos de imagen comunes
  const allowedTypes = /jpeg|jpg|png|gif|webp/i;
  const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
                 allowedTypes.test(file.mimetype);

  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)'), false);
  }
};

// Configuración de límites para la carga de archivos
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
  files: 1 // Solo un archivo a la vez
};

// Inicializar Multer con la configuración
const upload = multer({ 
  storage,
  fileFilter,
  limits
});

// Middleware para manejar errores de Multer
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Errores específicos de Multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo excede el límite de tamaño (5MB)'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Error en la carga: ${err.message}`
    });
  } else if (err) {
    // Otros errores
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

/**
 * @typedef {object} UploadImageResponse
 * @property {boolean} success - Estado de la operación
 * @property {string} message - Mensaje descriptivo
 * @property {object} data - Datos de la imagen subida
 * @property {string} data.fileName - Nombre del archivo generado
 * @property {string} data.filePath - Ruta relativa del archivo
 * @property {string} data.fileUrl - URL completa para acceder a la imagen
 * @property {number} data.fileSize - Tamaño del archivo en bytes
 */

/**
 * Subir imagen
 * @route POST /upload/images
 * @group Upload - Operaciones relacionadas con archivos
 * @param {file} image.formData.required - Imagen a subir (max 5MB, formatos: jpg, png, gif, webp)
 * @security BearerAuth
 * @consumes multipart/form-data
 * @returns {UploadImageResponse} 200 - Imagen subida correctamente
 * @returns {object} 400 - Formato o tamaño inválido
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 500 - Error interno del servidor
 */
router.post(
  '/images',
  verifyToken,
  checkRole([1, 2]), // Permitir tanto a administradores como usuarios regulares
  (req, res, next) => {
    // Utilizamos single como middleware para procesar un solo archivo
    upload.single('image')(req, res, (err) => {
      if (err) {
        return handleMulterErrors(err, req, res, next);
      }
      next();
    });
  },
  uploadController.uploadImage
);

/**
 * @typedef {object} DeleteImageResponse
 * @property {boolean} success - Estado de la operación
 * @property {string} message - Mensaje descriptivo
 */

/**
 * Eliminar imagen
 * @route DELETE /upload/images/{fileName}
 * @group Upload - Operaciones relacionadas con archivos
 * @param {string} fileName.path.required - Nombre del archivo a eliminar
 * @security BearerAuth
 * @returns {DeleteImageResponse} 200 - Imagen eliminada correctamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 404 - Archivo no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.delete(
  '/images/:fileName',
  verifyToken,
  checkRole([1]), // Solo administradores
  uploadController.deleteImage
);

module.exports = router;