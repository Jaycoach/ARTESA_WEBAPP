const Product = require('../models/Product');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('ProductController');

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
  createProduct = async (req, res) => {
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
  };

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
  getProducts = async (req, res) => {
    try {
      const products = await Product.getAll();
      
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
  };

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
  getProduct = async (req, res) => {
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
  };

  /**
   * @swagger
   * /api/products/{productId}:
   *   put:
   *     summary: Actualizar un producto
   *     description: Actualiza la información de un producto existente
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductRequest'
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
  updateProduct = async (req, res) => {
    try {
      const { productId } = req.params;
      
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto requerido'
        });
      }

      const updateData = req.body;
      const updatedProduct = await Product.update(productId, updateData);
      
      if (!updatedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: updatedProduct
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
  updateProductImage = async (req, res) => {
    try {
      const { productId } = req.params;
      const { imageUrl } = req.body;
      
      logger.debug('Solicitud de actualización de imagen', {
        productId,
        imageUrl,
        userId: req.user?.id
      });

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'ID de producto requerido'
        });
      }

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'URL de imagen requerida'
        });
      }

      // Verificar que el producto existe
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      // Actualizar la imagen
      const updatedProduct = await Product.updateImage(productId, imageUrl);
      
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
  };

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
  deleteProduct = async (req, res) => {
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
  };
}

module.exports = new ProductController();