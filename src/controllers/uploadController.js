// src/controllers/uploadController.js
const path = require('path');
const fs = require('fs');
const { createContextLogger } = require('../config/logger');
const S3Service = require('../services/S3Service');

// Crear una instancia del logger con contexto
const logger = createContextLogger('UploadController');

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Imagen subida exitosamente
 *         data:
 *           type: object
 *           properties:
 *             fileName:
 *               type: string
 *               example: 1623459874123.jpg
 *             relativePath:
 *               type: string
 *               example: /uploads/1623459874123.jpg
 *             imageUrl:
 *               type: string
 *               example: http://localhost:3000/uploads/1623459874123.jpg
 */

class UploadController {
  /**
   * @swagger
   * /api/upload:
   *   post:
   *     summary: Subir una imagen
   *     description: Sube una imagen al servidor y devuelve la URL para acceder a ella
   *     tags: [Uploads]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - image
   *             properties:
   *               image:
   *                 type: string
   *                 format: binary
   *                 description: Archivo de imagen a subir (JPG, PNG, GIF)
   *     responses:
   *       200:
   *         description: Imagen subida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UploadResponse'
   *       400:
   *         description: No se ha subido ningún archivo o el formato no es válido
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       500:
   *         description: Error interno del servidor
   */
  uploadImage = async (req, res) => {
    try {
      if (!req.file && (!req.files || !req.files.image)) {
        logger.warn('Intento de carga sin archivo', { userId: req.user?.id });
        return res.status(400).json({
          success: false,
          message: 'No se ha subido ningún archivo'
        });
      }
  
      // Determinar el archivo (soporta multer y express-fileupload)
      let file;
      let fileName;
      
      if (req.file) {
        // Multer
        file = {
          data: fs.readFileSync(req.file.path),
          mimetype: req.file.mimetype,
          name: req.file.originalname
        };
        fileName = req.file.filename;
      } else {
        // Express-fileupload
        file = req.files.image;
        fileName = file.name;
      }
  
      // Generar una clave única para S3
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const key = `general/${uniquePrefix}-${path.basename(fileName)}`;
      
      // Subir a S3
      const fileUrl = req.file 
        ? await S3Service.uploadFile(file.data, key, file.mimetype, { public: true })
        : await S3Service.uploadFormFile(file, key, { public: true });
  
      // Registrar información sobre el archivo subido
      logger.info('Archivo subido exitosamente', {
        userId: req.user?.id,
        fileName,
        key,
        size: req.file ? req.file.size : file.size,
        mimetype: req.file ? req.file.mimetype : file.mimetype
      });
  
      // Limpiar archivo temporal si se usó multer
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
  
      res.status(200).json({
        success: true,
        message: 'Imagen subida exitosamente',
        data: {
          fileName,
          key,
          imageUrl: fileUrl
        }
      });
    } catch (error) {
      logger.error('Error al subir imagen', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al procesar la imagen',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * @swagger
   * /api/upload/{fileName}:
   *   delete:
   *     summary: Eliminar una imagen
   *     description: Elimina una imagen previamente subida al servidor
   *     tags: [Uploads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Nombre del archivo a eliminar
   *     responses:
   *       200:
   *         description: Imagen eliminada exitosamente
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
   *                   example: Imagen eliminada exitosamente
   *       400:
   *         description: Nombre de archivo no proporcionado
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       403:
   *         description: Prohibido - Sin permisos para eliminar archivos
   *       404:
   *         description: Archivo no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  deleteImage = async (req, res) => {
    try {
      const { fileName } = req.params;
      const { key } = req.query;
      
      if (!fileName && !key) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el nombre del archivo o la clave'
        });
      }
  
      let fileKey = key;
      
      // Si no se proporcionó la clave pero sí el nombre, intentar construir la clave
      if (!fileKey && fileName) {
        fileKey = `general/${fileName}`;
      }
      
      // Eliminar el archivo
      const deleted = await S3Service.deleteFile(fileKey);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Archivo no encontrado'
        });
      }
      
      logger.info('Archivo eliminado exitosamente', {
        userId: req.user?.id,
        fileKey
      });
  
      res.status(200).json({
        success: true,
        message: 'Imagen eliminada exitosamente'
      });
    } catch (error) {
      logger.error('Error al eliminar imagen', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al eliminar la imagen',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}

module.exports = new UploadController();