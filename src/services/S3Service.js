// Reemplazar por:
const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand, 
  ListObjectsV2Command 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
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
    // Configuración específica para staging
    if (process.env.NODE_ENV === 'staging') {
      this.baseUrl = `https://${this.bucketName}.s3.amazonaws.com`;
    }
    
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
      this.s3 = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

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
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
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

    const upload = new Upload({
      client: this.s3,
      params: params
    });
    const uploadResult = await upload.done();
    
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
    // Limitar tiempo de expiración para evitar URLs muy largas
    const maxExpires = 3600; // Máximo 1 hora
    const finalExpiresTime = Math.min(adjustedExpires, maxExpires);
  
    // Configurar opciones para URLs más cortas compatible con AWS SDK V3
    // Configuración adicional para URLs más cortas
    const usePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    const useCustomDomain = process.env.S3_CUSTOM_DOMAIN;

    // Configurar opciones para URLs más cortas compatible con AWS SDK V3
    // IMPORTANTE: Usar adjustedExpires que ya incluye el ajuste de zona horaria colombiana
    const urlOptions = {
      expiresIn: finalExpiresTime, // Usar tiempo limitado para URLs más cortas
      signatureVersion: 'v4',
      // Configuraciones para URLs más cortas
      useAccelerateEndpoint: false,
      s3ForcePathStyle: usePathStyle,
      // Reducir headers en la firma para URLs más cortas
      unhoistableHeaders: new Set(),
      // Optimizar algoritmo de firma
      algorithm: 'AWS4-HMAC-SHA256'
    };

    // Log para monitorear el comportamiento de las URLs incluyendo zona horaria
    if (process.env.NODE_ENV === 'staging') {
      logger.debug('Configuración de URL firmada para AWS SDK V3 con zona horaria', {
        originalExpires: expires,
        adjustedExpires: adjustedExpires,
        finalExpiresIn: urlOptions.expiresIn,
        timezoneOffset: timezoneOffset,
        key: key,
        operation: operation,
        totalHoursOriginal: (expires / 3600).toFixed(2),
        totalHoursFinal: (urlOptions.expiresIn / 3600).toFixed(2)
      });
    }
    
    const params = {
      Bucket: this.bucketName,
      Key: key
    };

    const commandMap = {
      'getObject': GetObjectCommand,
      'putObject': PutObjectCommand
    };

    if (!commandMap[operation]) {
      throw new Error(`Operación no soportada: ${operation}`);
    }

    const command = new commandMap[operation](params);
    // Configurar opciones de firma optimizadas para URLs más cortas
    const signingOptions = {
      expiresIn: urlOptions.expiresIn,
      signableHeaders: new Set(['host']), // Solo headers esenciales
      unhoistableHeaders: new Set(), // Evitar headers innecesarios
      // Evitar parámetros de query innecesarios
      signQuery: true
    };

    // Log para debugging en staging
    if (process.env.NODE_ENV === 'staging') {
      logger.debug('Opciones de firma optimizadas', {
        expiresIn: signingOptions.expiresIn,
        signableHeadersCount: signingOptions.signableHeaders.size,
        key: key.substring(0, 50) // Solo primeros 50 caracteres por seguridad
      });
    }
    
    try {
      // Usar solo los parámetros esenciales para evitar conflictos
      const signedUrl = await getSignedUrl(this.s3, command, {
        expiresIn: urlOptions.expiresIn
      });
      
      // Verificar longitud de URL antes de retornar
      if (signedUrl.length > 250) {
        logger.warn('URL generada excede límite recomendado', {
          urlLength: signedUrl.length,
          key: key,
          operation: operation,
          truncatedUrl: signedUrl.substring(0, 100) + '...[truncated]',
          timezoneAdjusted: true,
          colombianHours: (urlOptions.expiresIn / 3600).toFixed(2)
        });
        
        // Intentar generar URL con tiempo de expiración más corto pero manteniendo ajuste de zona horaria
        const shorterExpires = Math.min(3600 + timezoneCompensation + safetyMargin, urlOptions.expiresIn);
        const shorterUrl = await getSignedUrl(this.s3, command, { 
          expiresIn: shorterExpires, // Mantener ajuste de zona horaria even con tiempo reducido
          signableHeaders: new Set(['host'])
        });
        
        if (shorterUrl.length <= 250) {
          logger.info('URL acortada exitosamente manteniendo zona horaria colombiana', {
            originalLength: signedUrl.length,
            newLength: shorterUrl.length,
            originalHours: (urlOptions.expiresIn / 3600).toFixed(2),
            newHours: (shorterExpires / 3600).toFixed(2),
            timezoneOffset: timezoneOffset
          });
          return shorterUrl;
        }
      }
      
      return signedUrl;
    } catch (error) {
      logger.error('Error generando URL firmada con ajuste de zona horaria', {
        error: error.message,
        key: key,
        operation: operation,
        timezoneOffset: timezoneOffset,
        adjustedExpires: adjustedExpires
      });
      throw error;
    }
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

    // Reemplazar por:
    await this.s3.send(new DeleteObjectCommand(params));
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

    const result = await this.s3.send(new ListObjectsV2Command(params));
    
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
   * Obtiene contenido de archivo desde S3
   * @private
   */
  async getFileContentFromS3(key) {
    const params = {
      Bucket: this.bucketName,
      Key: key
    };

    const result = await this.s3.send(new GetObjectCommand(params));
    
    return {
      content: result.Body,
      contentType: result.ContentType || 'application/octet-stream',
      fileName: path.basename(key),
      lastModified: result.LastModified,
      etag: result.ETag
    };
  }

  /**
   * Obtiene contenido de archivo local
   * @private
   */
  async getFileContentLocally(key) {
    const filePath = path.join(process.cwd(), 'uploads', key);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Archivo no encontrado en sistema local');
    }

    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);

    // Verificar que el archivo leído sea un Buffer válido
    if (!Buffer.isBuffer(content)) {
      throw new Error('Error al leer archivo local: no es un buffer válido');
    }

    logger.debug('Archivo local leído correctamente', {
      isBuffer: Buffer.isBuffer(content),
      size: content.length,
      key: key
    });
    
    // Determinar tipo de contenido basado en extensión
    const ext = path.extname(key).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain'
    };

    return {
      content: content,
      contentType: mimeTypes[ext] || 'application/octet-stream',
      fileName: path.basename(key),
      lastModified: stats.mtime
    };
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

        await this.s3.send(new HeadObjectCommand(params));
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
   * Obtiene metadatos de un archivo
   * @param {string} key - Clave del archivo
   * @returns {Promise<Object>} Metadatos del archivo
   */
  async getObjectMetadata(key) {
    try {
      key = this.normalizeKey(key);
      
      if (this.localMode) {
        const filePath = path.join(process.cwd(), 'uploads', key);
        if (!fs.existsSync(filePath)) {
          throw new Error('Archivo no encontrado en sistema local');
        }
        
        const stats = fs.statSync(filePath);
        const ext = path.extname(key).toLowerCase();
        
        // Determinar tipo de contenido basado en extensión
        const mimeTypes = {
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.txt': 'text/plain'
        };
        
        return {
          ContentType: mimeTypes[ext] || 'application/octet-stream',
          ContentLength: stats.size,
          LastModified: stats.mtime,
          Metadata: {}
        };
      } else {
        const params = {
          Bucket: this.bucketName,
          Key: key
        };

        const result = await this.s3.send(new HeadObjectCommand(params));
        return result;
      }
    } catch (error) {
      logger.error('Error al obtener metadatos del archivo', { error: error.message, key });
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
        const urlObj = new URL(url);
        
        // Caso 1: URL directa del bucket (sin firma)
        const baseUrl = this.baseUrl.replace(/https?:\/\//, '');
        if (url.includes(baseUrl)) {
          const parts = new URL(url);
          const pathWithoutSlash = parts.pathname.substring(1); // Quitar la barra inicial
          return pathWithoutSlash;
        }
        
        // Caso 2: URL firmada formato: bucket.s3.region.amazonaws.com
        if (url.includes(`${this.bucketName}.s3.${this.region}.amazonaws.com`) || 
            url.includes(`${this.bucketName}.s3.amazonaws.com`)) {
          let key = urlObj.pathname.substring(1); // Quitar la barra inicial
          
          // Caso especial: Compatibilidad con estructura antigua de productos
          // Si la clave extraída empieza con 'products/', usar solo el nombre del archivo
          if (key && key.startsWith('products/') && key.includes('/images/')) {
            const parts = key.split('/');
            const filename = parts[parts.length - 1]; // Obtener solo el nombre del archivo
            logger.info('Convirtiendo estructura antigua a nueva en extractKeyFromUrl', {
              oldKey: key,
              newKey: `images/${filename}`
            });
            return `images/${filename}`;
          }
          
          return key;
        }
        
        // Caso 3: URL firmada formato: s3.region.amazonaws.com/bucket
        if (url.includes('s3.amazonaws.com') || url.includes(`s3.${this.region}.amazonaws.com`)) {
          const pathParts = urlObj.pathname.split('/');
          // Formato: /bucket/key/path
          if (pathParts.length > 2 && pathParts[1] === this.bucketName) {
            return pathParts.slice(2).join('/'); // Todo después del bucket
          }
        }
        
        logger.debug('No se pudo extraer clave de URL', { 
          url: url.substring(0, 100), 
          bucket: this.bucketName, 
          region: this.region 
        });
        return null;
      }
    } catch (error) {
      logger.error('Error al extraer clave de URL', { error: error.message, url: url.substring(0, 100) });
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

  /**
   * Obtiene el tipo MIME basado en la extensión del archivo
   * @param {string} extension - Extensión del archivo
   * @returns {string} Tipo MIME
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
  /**
   * Obtiene el contenido completo de un archivo desde S3
   * @param {string} key - Clave del archivo en S3
   * @returns {Object} Objeto con content, contentType, etag
   */
  async getFileContent(key) {
    if (this.localMode) {
      const localPath = path.join('uploads', key);
      if (!fs.existsSync(localPath)) {
        throw new Error('Archivo no encontrado');
      }
      
      const content = fs.readFileSync(localPath);
      const ext = path.extname(key).toLowerCase();
      const contentType = this.getContentType(ext);
      
      return {
        content,
        contentType,
        etag: '"local-file"'
      };
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3.send(command);
      
      // Convertir stream a buffer de forma correcta
      let content;
      if (response.Body instanceof Buffer) {
        content = response.Body;
      } else {
        // Para streams
        const chunks = [];
        const reader = response.Body.getReader ? response.Body.getReader() : response.Body;
        
        if (response.Body.getReader) {
          // ReadableStream (navegador)
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) chunks.push(value);
          }
          content = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
          let offset = 0;
          for (const chunk of chunks) {
            content.set(chunk, offset);
            offset += chunk.length;
          }
          content = Buffer.from(content);
        } else {
          // Stream de Node.js
          for await (const chunk of response.Body) {
            chunks.push(chunk);
          }
          content = Buffer.concat(chunks);
        }
      }

      return {
        content,
        contentType: response.ContentType || 'application/octet-stream',
        etag: response.ETag
      };
    } catch (error) {
      logger.error('Error al obtener contenido de archivo', {
        error: error.message,
        key,
        bucket: this.bucketName
      });
      throw new Error('Archivo no encontrado');
    }
  }

  /**
   * Determina el tipo de contenido basado en la extensión
   * @param {string} ext - Extensión del archivo
   * @returns {string} Tipo MIME
   */
  getContentType(ext) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg', 
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = new S3Service();