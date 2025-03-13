const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('S3Service');

class S3Service {
  constructor() {
    this.isConfigured = false;
    this.s3 = null;
    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
    this.region = process.env.AWS_REGION;
    this.localMode = process.env.STORAGE_MODE === 'local';
    this.baseUrl = process.env.AWS_S3_BASE_URL || `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
    
    // Inicializar S3 si estamos en modo S3 (no local)
    if (!this.localMode) {
      this.initialize();
    } else {
      logger.info('S3Service inicializado en modo local');
    }
  }

  initialize() {
    try {
      // Verificar configuración
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !this.bucketName || !this.region) {
        logger.warn('Configuración de AWS S3 incompleta, se utilizará almacenamiento local');
        this.localMode = true;
        return;
      }

      // Configurar SDK de AWS
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: this.region
      });

      this.s3 = new AWS.S3();
      this.isConfigured = true;
      logger.info('S3Service inicializado correctamente', { bucket: this.bucketName, region: this.region });
    } catch (error) {
      logger.error('Error al inicializar S3Service', { error: error.message, stack: error.stack });
      this.localMode = true;
    }
  }

  /**
   * Sube un archivo a S3 o al sistema de archivos local según el modo
   * @param {Buffer|Stream} fileContent - Contenido del archivo
   * @param {string} key - Clave (ruta) en S3
   * @param {string} contentType - Tipo de contenido (MIME)
   * @param {Object} [options] - Opciones adicionales
   * @returns {Promise<string>} URL del archivo
   */
  async uploadFile(fileContent, key, contentType, options = {}) {
    try {
      // Normalizar la clave (quitar barras iniciales, etc.)
      key = this.normalizeKey(key);
      
      if (this.localMode) {
        return await this.saveFileLocally(fileContent, key);
      } else {
        return await this.uploadToS3(fileContent, key, contentType, options);
      }
    } catch (error) {
      logger.error('Error al subir archivo', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Sube un archivo de formulario a S3
   * @param {Object} file - Archivo de express-fileupload
   * @param {string} key - Clave (ruta) en S3
   * @param {Object} [options] - Opciones adicionales
   * @returns {Promise<string>} URL del archivo
   */
  async uploadFormFile(file, key, options = {}) {
    try {
      const fileContent = fs.readFileSync(file.tempFilePath);
      return await this.uploadFile(fileContent, key, file.mimetype, options);
    } catch (error) {
      logger.error('Error al subir archivo de formulario', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Sube un archivo a S3
   * @private
   */
  async uploadToS3(fileContent, key, contentType, options = {}) {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      ACL: options.public ? 'public-read' : 'private',
      ...options.s3Params
    };

    await this.s3.upload(params).promise();
    
    // Devolver URL del archivo (pública o firmada según configuración)
    if (options.public) {
      return `${this.baseUrl}/${key}`;
    } else {
      return this.getSignedUrl('getObject', key, options.expires || 3600); // URL firmada válida por 1 hora por defecto
    }
  }

  /**
   * Genera una URL firmada para acceder a un objeto privado
   * @param {string} operation - Operación ('getObject', 'putObject', etc.)
   * @param {string} key - Clave del objeto en S3
   * @param {number} expires - Tiempo de expiración en segundos
   * @returns {Promise<string>} URL firmada
   */
  async getSignedUrl(operation, key, expires = 3600) {
    if (this.localMode) {
      return `/uploads/${key}`;
    }

    key = this.normalizeKey(key);
    
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: expires
    };

    return this.s3.getSignedUrlPromise(operation, params);
  }

  /**
   * Guarda el archivo localmente (modo desarrollo)
   * @private
   */
  async saveFileLocally(fileContent, key) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const fullPath = path.join(uploadDir, key);
    const dirName = path.dirname(fullPath);

    // Asegurar que el directorio existe
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }

    // Guardar el archivo
    fs.writeFileSync(fullPath, fileContent);
    
    logger.debug('Archivo guardado localmente', { path: fullPath });
    
    // Devolver URL relativa para desarrollo
    return `/uploads/${key}`;
  }

  /**
   * Elimina un archivo de S3 o del sistema de archivos local
   * @param {string} key - Clave del archivo
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async deleteFile(key) {
    try {
      key = this.normalizeKey(key);
      
      if (this.localMode) {
        return await this.deleteFileLocally(key);
      } else {
        return await this.deleteFromS3(key);
      }
    } catch (error) {
      logger.error('Error al eliminar archivo', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Elimina un archivo de S3
   * @private
   */
  async deleteFromS3(key) {
    const params = {
      Bucket: this.bucketName,
      Key: key
    };

    await this.s3.deleteObject(params).promise();
    logger.info('Archivo eliminado de S3', { key });
    return true;
  }

  /**
   * Elimina un archivo local
   * @private
   */
  async deleteFileLocally(key) {
    const filePath = path.join(process.cwd(), 'uploads', key);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('Archivo eliminado localmente', { path: filePath });
      return true;
    } else {
      logger.warn('Archivo no encontrado para eliminar', { path: filePath });
      return false;
    }
  }

  /**
   * Verifica si un archivo existe
   * @param {string} key - Clave del archivo
   * @returns {Promise<boolean>} true si existe, false en caso contrario
   */
  async fileExists(key) {
    try {
      key = this.normalizeKey(key);
      
      if (this.localMode) {
        const filePath = path.join(process.cwd(), 'uploads', key);
        return fs.existsSync(filePath);
      } else {
        const params = {
          Bucket: this.bucketName,
          Key: key
        };

        await this.s3.headObject(params).promise();
        return true;
      }
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      logger.error('Error al verificar existencia de archivo', { error: error.message, key });
      throw error;
    }
  }

  /**
   * Normaliza una clave de S3
   * @private
   */
  normalizeKey(key) {
    // Eliminar barras al inicio
    key = key.replace(/^\/+/, '');
    
    // Asegurar que no haya dobles barras
    key = key.replace(/\/+/g, '/');
    
    return key;
  }

  /**
   * Extrae la clave de S3 de una URL
   * @param {string} url - URL del archivo
   * @returns {string|null} Clave del archivo o null si no es válida
   */
  extractKeyFromUrl(url) {
    if (!url) return null;
    
    try {
      if (this.localMode) {
        // Para URLs locales como /uploads/path/to/file.jpg
        if (url.startsWith('/uploads/')) {
          return url.substring('/uploads/'.length);
        }
        return null;
      } else {
        // Para URLs de S3
        const baseUrl = this.baseUrl.replace(/https?:\/\//, '');
        if (url.includes(baseUrl)) {
          const parts = new URL(url);
          const pathWithoutSlash = parts.pathname.substring(1); // Quitar la barra inicial
          return pathWithoutSlash;
        }
        
        // Para URLs firmadas, extraer el parámetro Key
        if (url.includes(`${this.bucketName}.s3.${this.region}.amazonaws.com`)) {
          const urlObj = new URL(url);
          const key = urlObj.pathname.substring(1); // Quitar la barra inicial
          return key;
        }
        
        return null;
      }
    } catch (error) {
      logger.error('Error al extraer clave de URL', { error: error.message, url });
      return null;
    }
  }
}

module.exports = new S3Service();