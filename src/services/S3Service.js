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
      
      // Log adicional para entornos no-desarrollo
      if (process.env.NODE_ENV !== 'development') {
        logger.warn('Usando almacenamiento local en entorno no-desarrollo', {
          environment: process.env.NODE_ENV,
          storageMode: process.env.STORAGE_MODE,
          recommendation: 'Considerar usar S3 para este entorno'
        });
      }
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
      
      // Log específico para verificación en staging/producción
      if (process.env.NODE_ENV === 'staging') {
        logger.info('S3 SDK inicializado para pruebas', {
          endpoint: `https://s3.${this.region}.amazonaws.com`,
          bucket: this.bucketName,
          testMode: true
        });
      }
      
      logger.info('S3Service inicializado correctamente', { bucket: this.bucketName, region: this.region });
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
      // Log para staging/pruebas
      if (process.env.NODE_ENV === 'staging') {
        logger.info('Iniciando subida de archivo a S3', {
          key: key,
          contentType: contentType,
          bucket: this.bucketName,
          mode: this.localMode ? 'local' : 's3',
          public: options.public || false
        });
      }
      
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
    // Validar que el archivo tenga un mimetype válido
    if (!file.mimetype || file.mimetype === 'application/octet-stream') {
      // Intentar determinar el tipo basado en la extensión
      const ext = path.extname(file.name).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      file.mimetype = mimeTypes[ext] || 'application/octet-stream';
    }
    
    const fileContent = fs.readFileSync(file.tempFilePath);
    return await this.uploadFile(fileContent, key, file.mimetype, {
      ...options,
      originalName: file.name
    });
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
      Metadata: {
        'original-name': path.basename(key),
        'content-type': contentType
      },
      //ACL: options.public ? 'public-read' : 'private',
      ...options.s3Params
    };

    const uploadResult = await this.s3.upload(params).promise();
    
    // Log para staging
    if (process.env.NODE_ENV === 'staging') {
      logger.info('Archivo subido exitosamente a S3', {
        bucket: this.bucketName,
        key: key,
        location: uploadResult.Location,
        etag: uploadResult.ETag,
        public: options.public || false
      });
    }
    
    // Devolver URL del archivo (pública o firmada según configuración)
    if (options.public) {
      return `${this.baseUrl}/${key}`;
    } else {
      // Generar URL firmada con tiempo ajustado para Colombia
      return this.getSignedUrl('getObject', key, options.expires || 3600);
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
    
    // Obtener configuración de zona horaria desde variables de entorno
    const timezoneOffset = parseInt(process.env.S3_TIMEZONE_OFFSET || '-5');
    const safetyMargin = parseInt(process.env.S3_URL_SAFETY_MARGIN || '21600'); // 6 horas por defecto
    
    // Calcular tiempo ajustado: tiempo original + compensación de zona horaria + margen de seguridad
    const timezoneCompensation = Math.abs(timezoneOffset * 3600); // Convertir horas a segundos
    const adjustedExpires = expires + timezoneCompensation + safetyMargin;
    
    // Log para staging para monitorear el comportamiento
    if (process.env.NODE_ENV === 'staging') {
      logger.debug('Generando URL firmada con ajuste de zona horaria', {
        originalExpires: expires,
        timezoneOffset,
        timezoneCompensation,
        safetyMargin,
        adjustedExpires,
        totalHours: (adjustedExpires / 3600).toFixed(2)
      });
    }
    
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: adjustedExpires
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
   * Lista archivos en S3 o directorio local
   * @param {string} prefix - Prefijo para filtrar archivos (opcional)
   * @param {number} maxKeys - Número máximo de archivos a retornar
   * @returns {Promise<Array>} Lista de archivos
   */
  async listFiles(prefix = '', maxKeys = 1000) {
    try {
      if (this.localMode) {
        return await this.listFilesLocally(prefix);
      } else {
        return await this.listFilesFromS3(prefix, maxKeys);
      }
    } catch (error) {
      logger.error('Error al listar archivos', { error: error.message, prefix });
      throw error;
    }
  }

  /**
   * Lista archivos desde S3
   * @private
   */
  async listFilesFromS3(prefix = '', maxKeys = 1000) {
    const params = {
      Bucket: this.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys
    };

    const result = await this.s3.listObjectsV2(params).promise();
    
    return {
      files: result.Contents.map(file => ({
        key: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
        etag: file.ETag,
        url: `${this.baseUrl}/${file.Key}`
      })),
      totalCount: result.KeyCount,
      isTruncated: result.IsTruncated,
      prefix: prefix
    };
  }

  /**
   * Lista archivos localmente
   * @private
   */
  async listFilesLocally(prefix = '') {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const searchPath = prefix ? path.join(uploadDir, prefix) : uploadDir;
    
    if (!fs.existsSync(searchPath)) {
      return {
        files: [],
        totalCount: 0,
        isTruncated: false,
        prefix: prefix
      };
    }

    const files = [];
    const walkDir = (dir, relativePath = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativeFilePath = path.join(relativePath, entry.name).replace(/\\/g, '/');
        
        if (entry.isDirectory()) {
          walkDir(fullPath, relativeFilePath);
        } else {
          const stats = fs.statSync(fullPath);
          files.push({
            key: relativeFilePath,
            size: stats.size,
            lastModified: stats.mtime,
            url: `/uploads/${relativeFilePath}`
          });
        }
      }
    };

    walkDir(searchPath, prefix);
    
    return {
      files: files,
      totalCount: files.length,
      isTruncated: false,
      prefix: prefix
    };
  }

  /**
   * Verifica si un archivo existe
   * @param {string} key - Clave del archivo
   * @returns {Promise<boolean>} True si existe
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
      return false;
    }
  }

  /**
   * Busca archivos duplicados basándose en el tamaño y nombre
   * @param {string} prefix - Prefijo para filtrar búsqueda
   * @returns {Promise<Array>} Lista de posibles duplicados
   */
  async findDuplicates(prefix = '') {
    try {
      const { files } = await this.listFiles(prefix);
      
      // Agrupar por tamaño y nombre base
      const groups = {};
      
      files.forEach(file => {
        const baseName = path.basename(file.key);
        const size = file.size;
        const groupKey = `${baseName}_${size}`;
        
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(file);
      });
      
      // Filtrar solo grupos con más de un archivo
      const duplicates = Object.values(groups)
        .filter(group => group.length > 1)
        .map(group => ({
          baseName: path.basename(group[0].key),
          size: group[0].size,
          count: group.length,
          files: group
        }));
      
      return duplicates;
    } catch (error) {
      logger.error('Error al buscar duplicados', { error: error.message, prefix });
      throw error;
    }
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
 * Verifica si un archivo es una imagen válida
 * @param {Object} file - Objeto de archivo (express-fileupload)
 * @returns {boolean} - true si es una imagen válida
 */
isValidImage(file) {
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  return validMimeTypes.includes(file.mimetype);
}

/**
 * Verifica si un archivo excede el tamaño máximo
 * @param {Object} file - Objeto de archivo (express-fileupload)
 * @param {number} maxSizeMB - Tamaño máximo en MB
 * @returns {boolean} - true si excede el tamaño máximo
 */
exceedsMaxSize(file, maxSizeMB) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size > maxSizeBytes;
}

/**
 * Carga un archivo específicamente para banners
 * @param {Object} file - Objeto de archivo (express-fileupload)
 * @param {string} [customName] - Nombre personalizado (opcional)
 * @returns {Promise<string>} - URL de la imagen subida
 */
async uploadBannerImage(file, customName) {
  try {
    // Validar que sea una imagen
    if (!this.isValidImage(file)) {
      throw new Error('El archivo no es una imagen válida');
    }
    
    // Validar tamaño (máximo 5MB)
    if (this.exceedsMaxSize(file, 5)) {
      throw new Error('La imagen excede el tamaño máximo de 5MB');
    }
    
    // Generar nombre de archivo único
    const fileName = customName || `banner-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const key = `banners/${fileName}`;
    
    // Subir archivo
    const imageUrl = await this.uploadFormFile(file, key, { 
      public: true,
      contentType: file.mimetype
    });
    
    return imageUrl;
  } catch (error) {
    logger.error('Error al subir imagen de banner', {
      error: error.message,
      fileName: file.name
    });
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
  /**
   * Verifica que S3 esté correctamente configurado para el entorno actual
   * @returns {Object} Estado de la configuración
   */
  getConfigurationStatus() {
    const status = {
      environment: process.env.NODE_ENV,
      storageMode: process.env.STORAGE_MODE,
      localMode: this.localMode,
      configured: this.isConfigured,
      bucket: this.bucketName,
      region: this.region,
      baseUrl: this.baseUrl,
      credentials: {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID ? 
          process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'No configurado'
      },
      ready: false
    };
    
    // Determinar si está listo para usar
    if (!this.localMode) {
      status.ready = this.isConfigured && 
                     !!this.bucketName && 
                     !!this.region && 
                     !!process.env.AWS_ACCESS_KEY_ID && 
                     !!process.env.AWS_SECRET_ACCESS_KEY;
    } else {
      status.ready = true; // Modo local siempre está listo
    }
    
    // Log de estado para staging
    if (process.env.NODE_ENV === 'staging') {
      logger.info('Estado de configuración S3 solicitado', {
        ready: status.ready,
        mode: status.localMode ? 'local' : 's3',
        hasCredentials: status.credentials.hasAccessKey && status.credentials.hasSecretKey
      });
    }
    
    return status;
  }
  /**
   * Obtiene información sobre la configuración de zona horaria actual
   * @returns {Object} Información de configuración
   */
  getTimezoneConfiguration() {
    const timezoneOffset = parseInt(process.env.S3_TIMEZONE_OFFSET || '-5');
    const safetyMargin = parseInt(process.env.S3_URL_SAFETY_MARGIN || '21600');
    
    return {
      timezone: process.env.TZ || 'America/Bogota',
      offsetHours: timezoneOffset,
      safetyMarginHours: (safetyMargin / 3600).toFixed(2),
      totalExtraTime: Math.abs(timezoneOffset) + (safetyMargin / 3600)
    };
  }
}

module.exports = new S3Service();