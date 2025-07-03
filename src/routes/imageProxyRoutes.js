const express = require('express');
const router = express.Router();
const S3Service = require('../services/S3Service');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('ImageProxy');

/**
 * Endpoint proxy para servir imágenes desde S3
 */
router.get('/proxy/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    
    // Verificar que la clave sea válida (solo imágenes)
    if (!key.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) && !key.match(/(jpg|jpeg|png|gif|webp|svg)$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido'
      });
    }
    
    // Obtener archivo desde S3
    const fileData = await S3Service.getFileContent(key);
    
    // Configurar headers apropiados
    res.set({
      'Content-Type': fileData.contentType,
      'Content-Length': fileData.content.length,
      'Cache-Control': 'public, max-age=31536000', // Cache por 1 año
      'ETag': fileData.etag
    });
    
    // Enviar contenido
    res.send(fileData.content);
    
  } catch (error) {
    logger.error('Error al servir imagen proxy', {
      error: error.message,
      key: req.params.key
    });
    
    res.status(404).json({
      success: false,
      message: 'Imagen no encontrada'
    });
  }
});

module.exports = router;