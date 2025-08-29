// src/routes/productImageRoutes.js
const express = require('express');
const router = express.Router();
const productImageController = require('../controllers/productImageController');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeParams } = require('../middleware/security');

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductImageUploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Imagen principal subida exitosamente"
 *         data:
 *           type: object
 *           properties:
 *             imageType:
 *               type: string
 *               example: "main"
 *             url:
 *               type: string
 *               example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg"
 *             productId:
 *               type: integer
 *               example: 123
 *     
 *     ProductImageResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             imageUrl:
 *               type: string
 *               example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg"
 *             imageType:
 *               type: string
 *               example: "main"
 *             productId:
 *               type: integer
 *               example: 123
 *     
 *     ProductImageListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             productId:
 *               type: integer
 *               example: 123
 *             images:
 *               type: object
 *               properties:
 *                 main:
 *                   type: string
 *                   example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg"
 *                 gallery:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["https://bucket.s3.amazonaws.com/products/123/images/uuid_gallery1.jpg"]
 *                 thumbnail:
 *                   type: string
 *                   example: "https://bucket.s3.amazonaws.com/products/123/images/uuid_thumb.jpg"
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: ProductImages
 *   description: Gestión de imágenes de productos
 */

/**
 * Subir imagen de producto
 * @route POST /api/products/{productId}/images/{imageType}
 * @group ProductImages - Operaciones de imágenes de productos
 * @param {integer} productId.path.required - ID del producto
 * @param {string} imageType.path.required - Tipo de imagen (main, gallery, thumbnail)
 * @param {file} image.formData.required - Archivo de imagen
 * @security bearerAuth
 * @returns {ProductImageUploadResponse} 200 - Imagen subida exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - Sin permisos
 * @returns {object} 404 - Producto no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/products/:productId/images/:imageType',
  verifyToken,
  checkRole([1]), // Solo administradores
  sanitizeParams,
  productImageController.uploadProductImage
);

/**
 * Obtener imagen de producto (visualización)
 * @route GET /api/products/images/{productId}/{imageType}
 * @group ProductImages - Operaciones de imágenes de productos
 * @param {integer} productId.path.required - ID del producto
 * @param {string} imageType.path.required - Tipo de imagen (main, gallery, thumbnail)
 * @param {boolean} download.query - Si descargar o solo obtener URL (default: false)
 * @security bearerAuth
 * @returns {ProductImageResponse} 200 - URL de imagen obtenida exitosamente
 * @returns {file} 200 - Archivo de imagen (si download=true)
 * @returns {object} 404 - Producto o imagen no encontrados
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/products/images/:productId/:imageType',
  verifyToken,
  sanitizeParams,
  productImageController.getProductImage
);

/**
 * Listar todas las imágenes de un producto
 * @route GET /api/products/{productId}/images
 * @group ProductImages - Operaciones de imágenes de productos
 * @param {integer} productId.path.required - ID del producto
 * @security bearerAuth
 * @returns {ProductImageListResponse} 200 - Lista de imágenes obtenida exitosamente
 * @returns {object} 404 - Producto no encontrado
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/products/:productId/images',
  verifyToken,
  sanitizeParams,
  productImageController.listProductImages
);

/**
 * Eliminar imagen de producto
 * @route DELETE /api/products/images/{productId}/{imageType}
 * @group ProductImages - Operaciones de imágenes de productos
 * @param {integer} productId.path.required - ID del producto
 * @param {string} imageType.path.required - Tipo de imagen (main, gallery, thumbnail)
 * @security bearerAuth
 * @returns {object} 200 - Imagen eliminada exitosamente
 * @returns {object} 404 - Producto o imagen no encontrados
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - Sin permisos
 * @returns {object} 500 - Error interno del servidor
 */
router.delete('/products/images/:productId/:imageType',
  verifyToken,
  checkRole([1]), // Solo administradores
  sanitizeParams,
  productImageController.deleteProductImage
);

module.exports = router;
