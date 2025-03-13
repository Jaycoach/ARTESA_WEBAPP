/**
 * Utilidad para gestionar URLs de S3 en la base de datos,
 * permitiendo actualizar automáticamente URLs expiradas
 */
const S3Service = require('../services/S3Service');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('S3UrlManager');

class S3UrlManager {
  /**
 * Actualiza URLs firmadas expiradas o próximas a expirar
 * @param {string} url - URL actual del documento
 * @param {string} keyField - Campo de clave ("fotocopiaCedula", "fotocopiaRut", etc.)
 * @returns {Promise<string>} URL actualizada (o la misma si no requiere actualización)
 */
static async refreshUrl(url, keyField) {
    if (!url) return url;
    
    try {
      // Si no es una URL de S3 o es pública, devolverla tal cual
      if (!url.includes('s3.amazonaws.com') || !url.includes('Signature=')) {
        return url;
      }
      
      // Extraer fecha de expiración de la URL
      const urlObj = new URL(url);
      const expiresParam = urlObj.searchParams.get('Expires');
      
      if (!expiresParam) {
        // Si no se puede determinar la expiración, regenerar la URL
        const key = S3Service.extractKeyFromUrl(url);
        if (!key) return url;
        
        logger.debug('Regenerando URL sin fecha de expiración', { keyField, key });
        return await S3Service.getSignedUrl('getObject', key);
      }
      
      const expiresDate = new Date(parseInt(expiresParam) * 1000);
      const now = new Date();
      
      // Si la URL expira en menos de 1 hora, actualizarla
      if ((expiresDate - now) < (60 * 60 * 1000)) {
        const key = S3Service.extractKeyFromUrl(url);
        if (!key) return url;
        
        logger.debug('Actualizando URL próxima a expirar', { 
          keyField, 
          key, 
          expiresIn: Math.round((expiresDate - now) / 1000) + ' segundos' 
        });
        
        return await S3Service.getSignedUrl('getObject', key);
      }
      
      // La URL sigue siendo válida
      return url;
    } catch (error) {
      logger.error('Error al refrescar URL', { 
        error: error.message,
        url: url.substring(0, 100) + '...' // Log truncado por seguridad
      });
      return url; // Devolver la URL original en caso de error
    }
  }
  
  /**
   * Procesa un objeto para refrescar todas las URLs de S3
   * @param {Object} obj - Objeto que puede contener URLs de S3
   * @param {Array<string>} fields - Lista de campos a verificar
   * @returns {Promise<Object>} Objeto con URLs actualizadas
   */
  static async refreshAllUrls(obj, fields) {
    if (!obj) return obj;
    
    const result = { ...obj };
    
    for (const field of fields) {
      if (obj[field]) {
        result[field] = await this.refreshUrl(obj[field], field);
      }
    }
    
    return result;
  }
}