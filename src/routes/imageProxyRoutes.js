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
    let contentType = (fileData.contentType || 'image/jpeg').split(';')[0];
    
    // Limpiar charset de imágenes (no es necesario)
    if (contentType.includes('image/')) {
      contentType = contentType.split(';')[0];
    }
    
    // Determinar tipo basado en extensión del archivo
    if (key.match(/png$/i)) contentType = 'image/png';
    else if (key.match(/jpe?g$/i)) contentType = 'image/jpeg';
    else if (key.match(/gif$/i)) contentType = 'image/gif';
    else if (key.match(/webp$/i)) contentType = 'image/webp';
    else if (key.match(/svg$/i)) contentType = 'image/svg+xml';
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': fileData.content.length,
      'Cache-Control': 'public, max-age=31536000',
      'ETag': fileData.etag,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
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