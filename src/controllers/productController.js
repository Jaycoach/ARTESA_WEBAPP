// src/controllers/productController.js
const Product = require('../models/Product');
const { createContextLogger } = require('../config/logger');
const sapServiceManager = require('../services/SapServiceManager');
const S3Service = require('../services/S3Service');
const path = require('path');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ProductController');

class ProductController {
  /**
   * @swagger
   * /api/products:
   *   post:
   *     summary: Crear un nuevo producto
   *     description: Crea un nuevo producto en el sistema
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductRequest'
   *     responses:
   *       201:
   *         description: Producto creado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductResponse'
   *       400:
   *         description: Datos inválidos o incompletos
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       403:
   *         description: Prohibido - Sin permisos para crear productos
   *       500:
   *         description: Error interno del servidor
   */
  async createProduct(req, res) {
    try {
      const productData = {
        name: req.body.name,
        description: req.body.description,
        priceList1: req.body.priceList1,
        priceList2: req.body.priceList2,
        priceList3: req.body.priceList3,
        stock: req.body.stock,
        barcode: req.body.barcode,
        imageUrl: req.body.imageUrl
      };

      logger.debug('Datos para creación de producto', { productData });

      // Validación básica
      if (!productData.name || !productData.priceList1 || productData.stock === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, precio y stock son campos requeridos'
        });
      }

      const product = await Product.create(productData);
      
      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: product
      });
    } catch (error) {
      logger.error('Error al crear producto', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al crear el producto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/products:
   *   get:
   *     summary: Obtener todos los productos
   *     description: Recupera la lista de todos los productos disponibles
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Lista de productos recuperada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Product'
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       500:
   *         description: Error interno del servidor
   */
  async getProducts(req, res) {
    try {
      // Obtener el userPriceListCode del usuario autenticado
      const userPriceListCode = req.user?.clientProfile?.price_list_code;

      let numericPriceListCode = null;

      // Si el usuario tiene un price_list_code específico, buscar su equivalente numérico
      if (userPriceListCode && userPriceListCode !== 'GENERAL') {
          try {
              const PriceList = require('../models/PriceList');
              const priceListMapping = await PriceList.getPriceListCodeMapping(userPriceListCode);
              numericPriceListCode = priceListMapping?.price_list_code || null;
              
              console.log('🔍 DEBUG: userPriceListCode:', userPriceListCode);
              console.log('🔍 DEBUG: numericPriceListCode:', numericPriceListCode);
          } catch (error) {
              logger.warn('Error getting price list mapping', { 
                  userPriceListCode, 
                  error: error.message 
              });
          }
      }

      const products = await Product.getAll({
          userPriceListCode: numericPriceListCode
      });
      
      res.status(200).json({
        success: true,
        data: products
      });
    } catch (error) {
      logger.error('Error al obtener productos', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener los productos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/products/{productId}:
   *   get:
   *     summary: Obtener un producto por ID
   *     description: Recupera la información detallada de un producto específico
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto a consultar
   *     responses:
   *       200:
   *         description: Producto recuperado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductResponse'
   *       400:
   *         description: ID de producto inválido
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       404:
   *         description: Producto no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  async getProduct(req, res) {
    try {
      const { productId } = req.params;
      
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto requerido'
        });
      }

      const product = await Product.findById(productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      // Asegurar que la URL de respuesta esté limpia
      if (product && product.image_url) {
          product.image_url = product.image_url
              .replace(/&amp;amp;#x2F;/g, '/')
              .replace(/&amp;#x2F;/g, '/')
              .replace(/&#x2F;/g, '/');
      }

      res.status(200).json({
          success: true,
          data: product
      });
    } catch (error) {
      logger.error('Error al obtener producto', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener el producto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/products/{productId}/image:
   *   put:
   *     summary: Actualizar la imagen de un producto
   *     description: Actualiza solo la URL de la imagen de un producto existente
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto cuya imagen se actualizará
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProductImageRequest'
   *     responses:
   *       200:
   *         description: Imagen de producto actualizada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductResponse'
   *       400:
   *         description: Datos inválidos o ID de producto inválido
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       403:
   *         description: Prohibido - Sin permisos para actualizar productos
   *       404:
   *         description: Producto no encontrado
   *       500:
   *         description: Error interno del servidor
   */
    async updateProductImage(req, res) {
    try {
      const { productId } = req.params;
      let imageUrl = null;
      
      logger.debug('Solicitud de actualización de imagen', {
        productId,
        hasFile: !!req.files?.image,
        hasImageUrl: !!req.body.imageUrl,
        userId: req.user?.id
      });

      // AGREGAR ESTE LOGGING ADICIONAL:
      logger.debug('URL de imagen recibida', {
        imageUrl: req.body.imageUrl,
        originalImageUrl: req.body.imageUrl ? req.body.imageUrl.substring(0, 100) : 'No URL provided'
      });

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto requerido'
        });
      }

      // Primero intentamos obtener la imagen del formulario
      if (req.files && req.files.image) {
        const file = req.files.image;
        // Generar nombre único preservando la extensión
        let fileExtension = path.extname(file.name);
        if (!fileExtension) {
          // Determinar extensión basada en MIME type si no tiene extensión
          const mimeToExt = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg'
          };
          fileExtension = mimeToExt[file.mimetype] || '.jpg';
        }

        // Limpiar nombre de archivo y generar clave
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-'); // Limpiar caracteres especiales
        const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const key = `products/${productId}/${uniquePrefix}${fileExtension}`;
        
        // Subir a S3 (o local según configuración)
        imageUrl = await S3Service.uploadFormFile(file, key, { 
          public: true,  // Imágenes de productos públicas
          contentType: file.mimetype
        });

        // Asegurar que la URL sea accesible mediante proxy
        if (imageUrl && !imageUrl.startsWith('/api/images/proxy/')) {
          imageUrl = `/api/images/proxy/${imageUrl}`;
        }
        
        logger.info('Imagen subida exitosamente', { productId, key });
      } 
      // Si no hay archivo, usar la URL en el body
      else if (req.body.imageUrl) {
        imageUrl = req.body.imageUrl;
      } 

      // Validar que tengamos una URL de imagen
      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un archivo de imagen o una URL de imagen'
        });
      }

      // Actualizar la imagen
      const updatedProduct = await Product.updateImage(productId, imageUrl);
      
      if (!updatedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      // Asegurar que la URL de respuesta esté limpia
      if (updatedProduct && updatedProduct.image_url) {
          updatedProduct.image_url = updatedProduct.image_url
              .replace(/&amp;amp;#x2F;/g, '/')
              .replace(/&amp;#x2F;/g, '/')
              .replace(/&#x2F;/g, '/');
      }

      res.status(200).json({
          success: true,
          message: 'Imagen de producto actualizada exitosamente',
          data: updatedProduct
      });
    } catch (error) {
      logger.error('Error al actualizar imagen de producto', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la imagen del producto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * @swagger
   * /api/products/{productId}:
   *   delete:
   *     summary: Eliminar un producto
   *     description: Elimina un producto existente del sistema
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto a eliminar
   *     responses:
   *       200:
   *         description: Producto eliminado exitosamente
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
   *                   example: Producto eliminado exitosamente
   *                 data:
   *                   $ref: '#/components/schemas/Product'
   *       400:
   *         description: ID de producto inválido
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       403:
   *         description: Prohibido - Sin permisos para eliminar productos
   *       404:
   *         description: Producto no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  async deleteProduct(req, res) {
    try {
      const { productId } = req.params;
      
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto requerido'
        });
      }

      const deletedProduct = await Product.delete(productId);
      
      if (!deletedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Producto eliminado exitosamente',
        data: deletedProduct
      });
    } catch (error) {
      logger.error('Error al eliminar producto', {
        error: error.message,
        stack: error.stack,
        productId: req.params.productId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al eliminar el producto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Crear una instancia de la clase ProductController
const productController = new ProductController();

/**
 * Función de ayuda para determinar si es necesario sincronizar con SAP
 * @param {Object} product - Producto existente
 * @param {Object} updateData - Datos de actualización
 * @returns {boolean} - Si se requiere sincronización con SAP
 */
const requiresSapSync = (product, updateData) => {
  // Campos que requieren sincronización con SAP cuando son modificados
  const sapSyncFields = ['description'];
  
  // Si el producto no tiene código SAP, no se requiere sincronización
  if (!product.sap_code) {
    return false;
  }
  
  // Verificar si algún campo que requiere sincronización ha sido modificado
  for (const field of sapSyncFields) {
    if (updateData[field] !== undefined && 
        updateData[field] !== product[field]) {
      return true;
    }
  }
  
  return false;
};

/**
 * Obtiene los productos pendientes de sincronización con SAP
 * @swagger
 * /api/products/sap/pending:
 *   get:
 *     summary: Obtener productos pendientes de sincronización con SAP
 *     description: Recupera la lista de productos que tienen cambios pendientes de sincronizar con SAP
 *     tags: [Products, SAP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de productos pendientes de sincronización
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - Sin permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
const getPendingSyncProducts = async (req, res) => {
  try {
    logger.debug('Obteniendo productos pendientes de sincronización con SAP');
    
    const products = await Product.getPendingSyncProducts();
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    logger.error('Error al obtener productos pendientes de sincronización', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos pendientes de sincronización',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Extiende el método updateProduct para manejar sincronización SAP
 * @swagger
 * /api/products/{productId}:
 *   put:
 *     summary: Actualizar un producto
 *     description: Actualiza la información de un producto existente. Si el producto proviene de SAP, algunos campos serán sincronizados automáticamente.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto a actualizar
 *       - in: query
 *         name: skipSapSync
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Omitir sincronización con SAP (sólo para administradores)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductRequest'
 *     responses:
 *       200:
 *         description: Producto actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       400:
 *         description: Datos inválidos o ID de producto inválido
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para actualizar productos
 *       404:
 *         description: Producto no encontrado
 *       500:
 *         description: Error interno del servidor
 */
const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    // Parámetro para omitir sincronización (sólo para administradores)
    const skipSapSync = req.query.skipSapSync === 'true' && req.user.rol_id === 1;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'ID de producto requerido'
      });
    }

    // Obtener producto actual para verificar si requiere sincronización
    const existingProduct = await Product.findById(productId);
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Mapear datos del cuerpo de la solicitud al formato esperado
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      priceList1: req.body.priceList1,
      priceList2: req.body.priceList2,
      priceList3: req.body.priceList3,
      stock: req.body.stock,
      barcode: req.body.barcode,
      imageUrl: req.body.imageUrl
    };

    // Verificar si requiere sincronización con SAP
    const needsSapSync = requiresSapSync(existingProduct, updateData);
    
    // Actualizar en base de datos con flag de sincronización automática
    const updatedProduct = await Product.update(
      productId, 
      updateData, 
      null, // Sin cliente de transacción
      !skipSapSync // Sincronización automática, a menos que se indique skipSapSync
    );
    
    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado durante actualización'
      });
    }
    
    // Información adicional para la respuesta
    let sapSyncInfo = null;
    
    // Si el producto proviene de SAP, agregar info de sincronización
    if (existingProduct.sap_code) {
      if (needsSapSync) {
        if (skipSapSync) {
          sapSyncInfo = {
            required: true,
            status: 'skipped',
            message: 'Sincronización con SAP omitida por solicitud'
          };
        } else {
          sapSyncInfo = {
            required: true,
            status: 'pending',
            message: 'Cambios programados para sincronización con SAP'
          };
        }
      } else {
        sapSyncInfo = {
          required: false,
          status: 'none',
          message: 'No se requieren cambios en SAP'
        };
      }
    }
    
    logger.info('Producto actualizado exitosamente', {
      productId,
      name: updatedProduct.name,
      needsSapSync,
      skipSapSync
    });
    
    res.status(200).json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: updatedProduct,
      sap: sapSyncInfo
    });
  } catch (error) {
    logger.error('Error al actualizar producto', {
      error: error.message,
      stack: error.stack,
      productId: req.params.productId
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el producto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         product_id:
 *           type: integer
 *           description: Identificador único del producto
 *           example: 1
 *         name:
 *           type: string
 *           description: Nombre del producto
 *           example: Pantalón casual
 *         description:
 *           type: string
 *           description: Descripción detallada del producto
 *           example: Pantalón de algodón de alta calidad
 *         price_list1:
 *           type: number
 *           format: float
 *           description: Precio en la lista 1 (precio normal)
 *           example: 59.99
 *         price_list2:
 *           type: number
 *           format: float
 *           description: Precio en la lista 2 (precio mayorista)
 *           example: 49.99
 *         price_list3:
 *           type: number
 *           format: float
 *           description: Precio en la lista 3 (precio especial)
 *           example: 39.99
 *         stock:
 *           type: integer
 *           description: Cantidad disponible en inventario
 *           example: 100
 *         barcode:
 *           type: string
 *           description: Código de barras único del producto
 *           example: 7501234567890
 *         image_url:
 *           type: string
 *           description: URL de la imagen del producto
 *           example: https://example.com/images/product.jpg
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de última actualización
 *     
 *     ProductResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Operación exitosa
 *         data:
 *           $ref: '#/components/schemas/Product'
 *     
 *     CreateProductRequest:
 *       type: object
 *       required:
 *         - name
 *         - priceList1
 *         - stock
 *       properties:
 *         name:
 *           type: string
 *           description: Nombre del producto
 *           example: Pantalón casual
 *         description:
 *           type: string
 *           description: Descripción detallada del producto
 *           example: Pantalón de algodón de alta calidad
 *         priceList1:
 *           type: number
 *           format: float
 *           description: Precio en la lista 1 (precio normal)
 *           example: 59.99
 *         priceList2:
 *           type: number
 *           format: float
 *           description: Precio en la lista 2 (precio mayorista)
 *           example: 49.99
 *         priceList3:
 *           type: number
 *           format: float
 *           description: Precio en la lista 3 (precio especial)
 *           example: 39.99
 *         stock:
 *           type: integer
 *           description: Cantidad disponible en inventario
 *           example: 100
 *         barcode:
 *           type: string
 *           description: Código de barras único del producto
 *           example: 7501234567890
 *         imageUrl:
 *           type: string
 *           description: URL de la imagen del producto
 *           example: https://example.com/images/product.jpg
 *     
 *     UpdateProductImageRequest:
 *       type: object
 *       required:
 *         - imageUrl
 *       properties:
 *         imageUrl:
 *           type: string
 *           description: Nueva URL de la imagen del producto
 *           example: https://example.com/images/product-updated.jpg
 */

// Exportar correctamente las funciones y métodos
module.exports = {
  requiresSapSync,
  getPendingSyncProducts,
  updateProduct,
  // Bind all class methods to maintain the correct 'this' context
  createProduct: productController.createProduct.bind(productController),
  getProducts: productController.getProducts.bind(productController),
  getProduct: productController.getProduct.bind(productController),
  updateProductImage: productController.updateProductImage.bind(productController),
  deleteProduct: productController.deleteProduct.bind(productController)
};