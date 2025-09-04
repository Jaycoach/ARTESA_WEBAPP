// src/controllers/productImageController.js
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const S3Service = require('../services/S3Service');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ProductImageController');

// Directorio donde se guardarán los archivos subidos
const uploadDir = path.join(__dirname, '../uploads/product-images');

// Asegurarse de que el directorio existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Guarda un archivo de imagen de producto en el sistema y devuelve la URL
 * @param {Object} file - Objeto de archivo de express-fileupload
 * @param {string} productId - ID del producto
 * @param {string} imageType - Tipo de imagen (main, gallery, thumbnail)
 * @returns {Promise<string|null>} - URL del archivo guardado o null si no hay archivo
 */
const saveProductImage = async (file, productId, imageType) => {
  if (!file) return null;
  
  try {
    // Estrategia mejorada para manejar posibles arrays
    const fileToSave = Array.isArray(file) ? file[0] : file;
    
    logger.debug('Procesando imagen de producto para guardar', {
      name: fileToSave.name,
      size: fileToSave.size,
      mimetype: fileToSave.mimetype,
      productId,
      imageType
    });
    
    // Validar el archivo - solo imágenes
    const allowedMimeTypes = [
      'image/jpeg', 
      'image/png', 
      'image/gif',
      'image/webp'
    ];
    
    if (!allowedMimeTypes.includes(fileToSave.mimetype)) {
      throw new Error(`Tipo de archivo no permitido: ${fileToSave.mimetype}. Solo se permiten imágenes.`);
    }
    
    // Verificar tamaño (max 10MB para imágenes)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileToSave.size > maxSize) {
      throw new Error(`Archivo demasiado grande. Tamaño máximo: ${maxSize / (1024 * 1024)}MB`);
    }
    
    // Generar nombre único
    const fileExtension = path.extname(fileToSave.name);
    const uniqueFilename = `${uuidv4()}_${imageType}${fileExtension}`;
    
    // Determinar el modo de almacenamiento
    if (process.env.STORAGE_MODE === 's3') {
      // Subir a S3 usando la nueva estructura
      const key = `images/${uniqueFilename}`;
      const imageUrl = await S3Service.uploadFile(
        fileToSave.data,
        key,
        fileToSave.mimetype,
        {
          metadata: {
            'product-id': productId.toString(),
            'image-type': imageType,
            'uploaded-by': 'product-image-controller'
          }
        }
      );
      
      logger.info('Imagen de producto subida a S3', {
        productId,
        imageType,
        key,
        url: imageUrl
      });
      
      return imageUrl;
    } else {
      // Guardar localmente
      const productDir = path.join(uploadDir, productId.toString());
      if (!fs.existsSync(productDir)) {
        fs.mkdirSync(productDir, { recursive: true });
      }
      
      const filePath = path.join(productDir, uniqueFilename);
      await fileToSave.mv(filePath);
      
      // Construir URL relativa
      const relativeUrl = `/uploads/product-images/${productId}/${uniqueFilename}`;
      
      logger.info('Imagen de producto guardada localmente', {
        productId,
        imageType,
        path: filePath,
        url: relativeUrl
      });
      
      return relativeUrl;
    }
  } catch (error) {
    logger.error('Error al guardar imagen de producto', {
      error: error.message,
      productId,
      imageType
    });
    throw error;
  }
};

class ProductImageController {
  /**
   * @swagger
   * /api/products/{productId}/images/{imageType}:
   *   post:
   *     summary: Subir imagen de producto
   *     description: Sube una imagen específica (principal, galería, thumbnail) a un producto
   *     tags: [ProductImages]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto
   *       - in: path
   *         name: imageType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [main, gallery, thumbnail]
   *         description: Tipo de imagen
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
   *                 description: Archivo de imagen a subir (JPEG, PNG, GIF, WebP)
   *     responses:
   *       200:
   *         description: Imagen subida exitosamente
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
   *                   example: "Imagen principal subida exitosamente"
   *                 data:
   *                   type: object
   *                   properties:
   *                     imageType:
   *                       type: string
   *                       example: "main"
   *                     url:
   *                       type: string
   *                       example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg"
   *                     productId:
   *                       type: integer
   *                       example: 123
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Prohibido - No tiene permisos
   *       404:
   *         description: Producto no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  async uploadProductImage(req, res) {
    try {
      const { productId, imageType } = req.params;
      
      if (!productId || !imageType) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID del producto y el tipo de imagen'
        });
      }
      
      // Validar tipo de imagen
      const validImageTypes = ['main', 'gallery', 'thumbnail'];
      if (!validImageTypes.includes(imageType)) {
        return res.status(400).json({
          success: false,
          message: `Tipo de imagen no válido. Tipos permitidos: ${validImageTypes.join(', ')}`
        });
      }
      
      if (!req.files || !req.files.image) {
        return res.status(400).json({
          success: false,
          message: 'No se ha proporcionado ningún archivo de imagen'
        });
      }
      
      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      // Verificar permisos (administradores y admins funcionales pueden subir imágenes)
      if (req.user.rol_id !== 1 && req.user.rol_id !== 3) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para subir imágenes de productos'
        });
      }
      
      const file = req.files.image;
      
      // Si es imagen principal, eliminar la anterior si existe
      if (imageType === 'main' && product.image_url) {
        if (process.env.STORAGE_MODE === 's3') {
          const oldKey = S3Service.extractKeyFromUrl(product.image_url);
          if (oldKey) {
            try {
              await S3Service.deleteFile(oldKey);
              logger.debug('Imagen principal anterior eliminada de S3', { 
                productId,
                key: oldKey 
              });
            } catch (error) {
              logger.warn('Error al eliminar imagen anterior de S3', {
                error: error.message,
                key: oldKey
              });
            }
          }
        } else {
          // Para almacenamiento local, eliminar archivo anterior
          const oldPath = path.join(__dirname, '..', product.image_url);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
            logger.debug('Imagen principal anterior eliminada localmente', { 
              productId,
              path: oldPath
            });
          }
        }
      }
      
      // Guardar nueva imagen
      const imageUrl = await saveProductImage(file, productId, imageType);
      
      // Actualizar el producto si es imagen principal
      if (imageType === 'main') {
        const updateData = {
          imageUrl: imageUrl
        };
        
        const updatedProduct = await Product.update(productId, updateData);
        
        if (!updatedProduct) {
          return res.status(500).json({
            success: false,
            message: 'Error al actualizar producto con nueva imagen'
          });
        }
      }
      
      // Para galería o thumbnails, registrar en tabla product_images si existe
      if (imageType !== 'main' && product.sap_code) {
        try {
          await ProductImage.createOrUpdate(product.sap_code, imageUrl);
        } catch (error) {
          logger.warn('Error al registrar imagen en product_images', {
            error: error.message,
            productId,
            sapCode: product.sap_code
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: `Imagen ${imageType} subida exitosamente`,
        data: {
          imageType,
          url: imageUrl,
          productId: parseInt(productId)
        }
      });
    } catch (error) {
      logger.error('Error al subir imagen de producto', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId,
        imageType: req.params.imageType
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al subir imagen',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/products/images/{productId}/{imageType}:
   *   get:
   *     summary: Obtener imagen de producto
   *     description: Obtiene la URL de una imagen específica de un producto o devuelve el contenido directamente
   *     tags: [ProductImages]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto
   *       - in: path
   *         name: imageType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [main, gallery, thumbnail]
   *         description: Tipo de imagen
   *       - in: query
   *         name: download
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Si true, descarga el archivo. Si false, devuelve la URL firmada.
   *     responses:
   *       200:
   *         description: Imagen obtenida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     imageUrl:
   *                       type: string
   *                       example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg"
   *                     imageType:
   *                       type: string
   *                       example: "main"
   *                     productId:
   *                       type: integer
   *                       example: 123
   *           image/*:
   *             schema:
   *               type: string
   *               format: binary
   *       404:
   *         description: Producto o imagen no encontrados
   *       401:
   *         description: No autorizado
   *       500:
   *         description: Error interno del servidor
   */
  async getProductImage(req, res) {
    try {
      const { productId, imageType } = req.params;
      const { download = false } = req.query;
      
      logger.debug('Obteniendo imagen de producto', { 
        productId, 
        imageType,
        download 
      });
      
      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      // Obtener la URL de la imagen según el tipo
      let imageUrl;
      if (imageType === 'main') {
        imageUrl = product.image_url;
      } else {
        // Para galería o thumbnails, buscar en product_images si el producto tiene SAP code
        if (product.sap_code) {
          const productImage = await ProductImage.getByProductCode(product.sap_code);
          imageUrl = productImage?.image_url;
        }
      }
      
      if (!imageUrl) {
        return res.status(404).json({
          success: false,
          message: `La imagen ${imageType} no existe para este producto`
        });
      }

      // Si no se requiere descarga, devolver la URL
      if (!download || download === 'false') {
        // Para S3, generar URL firmada
        if (process.env.STORAGE_MODE === 's3') {
          const key = S3Service.extractKeyFromUrl(imageUrl);
          if (key) {
            // Verificar que el archivo existe
            const exists = await S3Service.fileExists(key);
            if (!exists) {
              logger.warn('Imagen no encontrada en S3', { key, productId, imageType });
              return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
              });
            }

            // Generar URL firmada para visualización (24 horas)
            const signedUrl = await S3Service.getSignedUrl('getObject', key, 86400);
            
            return res.status(200).json({
              success: true,
              data: {
                imageUrl: signedUrl,
                imageType,
                productId: parseInt(productId),
                expiresIn: 86400 // 24 horas
              }
            });
          }
          
        }
        
        // Para almacenamiento local o URL directa
        return res.status(200).json({
          success: true,
          data: {
            imageUrl: imageUrl,
            imageType,
            productId: parseInt(productId)
          }
        });
      }

      // Si se requiere descarga/visualización directa
      if (process.env.STORAGE_MODE === 's3') {
        const key = S3Service.extractKeyFromUrl(imageUrl);
        
        // Si no se pudo extraer la clave con el método estándar,
        // intentar con la estructura antigua para compatibilidad
        let finalKey = key;
        if (!finalKey && imageUrl.includes('products/') && imageUrl.includes('/images/')) {
          try {
            const urlObj = new URL(imageUrl);
            const pathname = urlObj.pathname;
            const parts = pathname.split('/');
            const filename = parts[parts.length - 1];
            if (filename) {
              finalKey = `images/${filename}`;
              logger.info('Convertido de estructura antigua a nueva', { 
                originalUrl: imageUrl.substring(0, 100),
                newKey: finalKey 
              });
            }
          } catch (conversionError) {
            logger.warn('Error al convertir estructura de URL', { 
              error: conversionError.message,
              url: imageUrl.substring(0, 100)
            });
          }
        }

        if (!finalKey) {
          logger.warn('No se pudo determinar la clave S3 de la imagen', { imageUrl });
          return res.status(404).json({
            success: false,
            message: 'No se pudo determinar la ubicación de la imagen'
          });
        }
        
        // Verificar que el archivo existe
        const exists = await S3Service.fileExists(finalKey);
        if (!exists) {
          logger.warn('Imagen no encontrada en S3', { key: finalKey, productId, imageType });
          return res.status(404).json({
            success: false,
            message: 'Imagen no encontrada'
          });
        }

        // Obtener metadatos para el content-type
        const metadata = await S3Service.getObjectMetadata(finalKey);
        const contentType = metadata.ContentType || 'image/jpeg';
        
        // Generar URL firmada y redirigir
        const signedUrl = await S3Service.getSignedUrl('getObject', finalKey, 3600);
        
        // Para visualización en el frontend, redirigir a la URL firmada
        return res.redirect(signedUrl);
      } else {
        // Para almacenamiento local
        const imagePath = path.join(__dirname, '..', imageUrl);
        
        if (!fs.existsSync(imagePath)) {
          return res.status(404).json({
            success: false,
            message: 'Imagen no encontrada'
          });
        }
        
        // Servir el archivo directamente
        return res.sendFile(path.resolve(imagePath));
      }
    } catch (error) {
      logger.error('Error al obtener imagen de producto', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId,
        imageType: req.params.imageType
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener imagen',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/products/{productId}/images:
   *   get:
   *     summary: Listar todas las imágenes de un producto
   *     description: Obtiene una lista de todas las imágenes disponibles para un producto
   *     tags: [ProductImages]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto
   *     responses:
   *       200:
   *         description: Lista de imágenes obtenida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     productId:
   *                       type: integer
   *                       example: 123
   *                     images:
   *                       type: object
   *                       properties:
   *                         main:
   *                           type: string
   *                           example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg"
   *                         gallery:
   *                           type: array
   *                           items:
   *                             type: string
   *                           example: ["https://bucket.s3.amazonaws.com/products/123/images/uuid_gallery1.jpg"]
   *                         thumbnail:
   *                           type: string
   *                           example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_thumb.jpg"
   *       404:
   *         description: Producto no encontrado
   *       401:
   *         description: No autorizado
   *       500:
   *         description: Error interno del servidor
   */
  async listProductImages(req, res) {
    try {
      const { productId } = req.params;
      
      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      const images = {
        main: null,
        gallery: [],
        thumbnail: null
      };
      
      // Imagen principal del producto
      if (product.image_url) {
        if (process.env.STORAGE_MODE === 's3') {
          let key = S3Service.extractKeyFromUrl(product.image_url);
          
          // Compatibilidad con estructura antigua
          if (!key && product.image_url.includes('products/') && product.image_url.includes('/images/')) {
            try {
              const urlObj = new URL(product.image_url);
              const parts = urlObj.pathname.split('/');
              const filename = parts[parts.length - 1];
              if (filename) {
                key = `images/${filename}`;
              }
            } catch (error) {
              logger.warn('Error al convertir URL antigua en listProductImages', { error: error.message });
            }
          }
          
          if (key) {
            const exists = await S3Service.fileExists(key);
            if (exists) {
              images.main = await S3Service.getSignedUrl('getObject', key, 86400);
            }
          }
        } else {
          images.main = product.image_url;
        }
      }
      
      // Buscar imágenes adicionales en product_images si tiene SAP code
      if (product.sap_code) {
        const productImage = await ProductImage.getByProductCode(product.sap_code);
        if (productImage && productImage.image_url) {
          if (process.env.STORAGE_MODE === 's3') {
            const key = S3Service.extractKeyFromUrl(productImage.image_url);
            if (key) {
              const exists = await S3Service.fileExists(key);
              if (exists) {
                const signedUrl = await S3Service.getSignedUrl('getObject', key, 86400);
                images.gallery.push(signedUrl);
              }
            }
          } else {
            images.gallery.push(productImage.image_url);
          }
        }
      }
      
      res.status(200).json({
        success: true,
        data: {
          productId: parseInt(productId),
          images: images
        }
      });
    } catch (error) {
      logger.error('Error al listar imágenes de producto', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al listar imágenes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/products/images/{productId}/{imageType}:
   *   delete:
   *     summary: Eliminar imagen de producto
   *     description: Elimina una imagen específica de un producto
   *     tags: [ProductImages]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto
   *       - in: path
   *         name: imageType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [main, gallery, thumbnail]
   *         description: Tipo de imagen
   *     responses:
   *       200:
   *         description: Imagen eliminada exitosamente
   *       404:
   *         description: Producto o imagen no encontrados
   *       401:
   *         description: No autorizado
   *       403:
   *         description: No tiene permisos
   *       500:
   *         description: Error interno del servidor
   */
  async deleteProductImage(req, res) {
    try {
      const { productId, imageType } = req.params;
      
      // Verificar permisos (administradores y admins funcionales pueden subir imágenes)
      if (req.user.rol_id !== 1 && req.user.rol_id !== 3) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para eliminar imágenes de productos'
        });
      }
      
      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      let imageUrl;
      if (imageType === 'main') {
        imageUrl = product.image_url;
      } else if (product.sap_code) {
        const productImage = await ProductImage.getByProductCode(product.sap_code);
        imageUrl = productImage?.image_url;
      }
      
      if (!imageUrl) {
        return res.status(404).json({
          success: false,
          message: `La imagen ${imageType} no existe para este producto`
        });
      }
      
      // Eliminar archivo
      if (process.env.STORAGE_MODE === 's3') {
        const key = S3Service.extractKeyFromUrl(imageUrl);
        if (key) {
          await S3Service.deleteFile(key);
          logger.info('Imagen eliminada de S3', { productId, imageType, key });
        }
      } else {
        const imagePath = path.join(__dirname, '..', imageUrl);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          logger.info('Imagen eliminada localmente', { productId, imageType, path: imagePath });
        }
      }
      
      // Actualizar base de datos
      if (imageType === 'main') {
        await Product.update(productId, { imageUrl: null });
      } else if (product.sap_code) {
        // Para imágenes de galería/thumbnail, eliminar registro de product_images
        await pool.query('DELETE FROM product_images WHERE sap_code = $1', [product.sap_code]);
      }
      
      res.status(200).json({
        success: true,
        message: `Imagen ${imageType} eliminada exitosamente`
      });
    } catch (error) {
      logger.error('Error al eliminar imagen de producto', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId,
        imageType: req.params.imageType
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al eliminar imagen',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Crear instancia del controlador
const productImageController = new ProductImageController();

module.exports = {
  uploadProductImage: productImageController.uploadProductImage,
  getProductImage: productImageController.getProductImage,
  listProductImages: productImageController.listProductImages,
  deleteProductImage: productImageController.deleteProductImage
};
