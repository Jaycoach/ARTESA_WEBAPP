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
 * @security bearerAuth
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
 * @security bearerAuth
 * @returns {DeleteImageResponse} 200 - Imagen eliminada correctamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 404 - Archivo no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.delete(
  '/:fileName',
  verifyToken,
  checkRole([1]), // Solo administradores
  uploadController.deleteImage
);
/**
 * @swagger
 * /api/upload/test-s3:
 *   post:
 *     summary: Probar configuración de S3
 *     description: Realiza una prueba completa de la configuración de AWS S3
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración de S3 verificada exitosamente
 *       500:
 *         description: Error en la configuración de S3
 */
router.post('/test-s3',
  verifyToken,
  checkRole([1]), // Solo administradores
  uploadController.testS3Configuration
);
/**
 * @swagger
 * /api/upload/s3-status:
 *   get:
 *     summary: Estado de configuración S3
 *     description: Obtiene el estado actual de la configuración de S3
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado obtenido exitosamente
 */
router.get('/s3-status',
  verifyToken,
  checkRole([1, 2]), // Administradores y usuarios normales
  uploadController.getS3Status
);
/**
 * @swagger
 * /api/upload/list:
 *   get:
 *     summary: Listar archivos en S3 o almacenamiento local
 *     description: Obtiene una lista de todos los archivos almacenados con opción de filtrado
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: prefix
 *         schema:
 *           type: string
 *         description: Prefijo para filtrar archivos (ej. 'client-profiles/', 'products/')
 *       - in: query
 *         name: maxKeys
 *         schema:
 *           type: integer
 *           default: 1000
 *         description: Número máximo de archivos a retornar
 *     responses:
 *       200:
 *         description: Lista de archivos obtenida exitosamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/list',
  verifyToken,
  checkRole([1, 2]), // Administradores y usuarios normales
  uploadController.listFiles
);

/**
 * @swagger
 * /api/upload/duplicates:
 *   get:
 *     summary: Buscar archivos duplicados
 *     description: Identifica posibles archivos duplicados basándose en nombre y tamaño
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: prefix
 *         schema:
 *           type: string
 *         description: Prefijo para filtrar búsqueda
 *     responses:
 *       200:
 *         description: Lista de duplicados encontrada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/duplicates',
  verifyToken,
  checkRole([1]), // Solo administradores
  uploadController.findDuplicates
);

/**
 * @swagger
 * /api/upload/bulk-delete:
 *   delete:
 *     summary: Eliminar múltiples archivos
 *     description: Elimina varios archivos de una vez proporcionando sus claves
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de claves de archivos a eliminar
 *     responses:
 *       200:
 *         description: Archivos eliminados exitosamente
 *       400:
 *         description: Lista de claves no proporcionada
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/bulk-delete',
  verifyToken,
  checkRole([1]), // Solo administradores
  uploadController.bulkDeleteFiles
);

/**
 * @swagger
 * /api/upload/verify-iam:
 *   post:
 *     summary: Verificar credenciales IAM para S3
 *     description: Verifica que las credenciales IAM tengan los permisos necesarios para operar con S3
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credenciales IAM verificadas exitosamente
 *       500:
 *         description: Error en las credenciales IAM
 */
router.post('/verify-iam',
  verifyToken,
  checkRole([1]), // Solo administradores
  uploadController.verifyIAMCredentials
);
module.exports = router;