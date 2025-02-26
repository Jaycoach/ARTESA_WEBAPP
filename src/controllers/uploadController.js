// src/controllers/uploadController.js
const path = require('path');
const fs = require('fs');
const { createContextLogger } = require('../config/logger');

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
      if (!req.file) {
        logger.warn('Intento de carga sin archivo', { userId: req.user?.id });
        return res.status(400).json({
          success: false,
          message: 'No se ha subido ningún archivo'
        });
      }

      // Registrar información sobre el archivo subido
      logger.info('Archivo subido exitosamente', {
        userId: req.user?.id,
        fileName: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Crear URL relativa y absoluta para la imagen
      const relativePath = `/uploads/${req.file.filename}`;
      const imageUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

      res.status(200).json({
        success: true,
        message: 'Imagen subida exitosamente',
        data: {
          fileName: req.file.filename,
          relativePath,
          imageUrl
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
      
      if (!fileName) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el nombre del archivo'
        });
      }

      // Validar que el nombre de archivo no contenga caracteres peligrosos
      const sanitizedFileName = path.basename(fileName);
      const filePath = path.join(process.cwd(), 'uploads', sanitizedFileName);

      // Verificar si el archivo existe
      if (!fs.existsSync(filePath)) {
        logger.warn('Intento de eliminar archivo inexistente', {
          userId: req.user?.id,
          fileName: sanitizedFileName
        });
        
        return res.status(404).json({
          success: false,
          message: 'Archivo no encontrado'
        });
      }

      // Eliminar el archivo
      fs.unlinkSync(filePath);
      
      logger.info('Archivo eliminado exitosamente', {
        userId: req.user?.id,
        fileName: sanitizedFileName
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