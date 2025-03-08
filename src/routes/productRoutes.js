const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeBody, sanitizeParams } = require('../middleware/security');

/**
 * Obtener productos pendientes de sincronización con SAP
 * @route GET /products/sap/pending
 * @group Products - Operaciones relacionadas con productos
 * @security bearerAuth
 * @returns {ProductsResponse} 200 - Lista de productos pendientes de sincronización
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/products/sap/pending', 
  verifyToken, 
  checkRole([1]), // Solo administradores
  productController.getPendingSyncProducts
);

/**
 * @typedef {object} Product
 * @property {number} product_id - ID del producto
 * @property {string} name - Nombre del producto
 * @property {string} description - Descripción del producto
 * @property {number} price_list1 - Precio lista 1
 * @property {number} price_list2 - Precio lista 2
 * @property {number} price_list3 - Precio lista 3
 * @property {number} stock - Cantidad en stock
 * @property {string} barcode - Código de barras
 * @property {string} image_url - URL de la imagen
 * @property {string} created_at - Fecha de creación - format:date-time
 * @property {string} updated_at - Fecha de última actualización - format:date-time
 */

/**
 * @typedef {object} ProductsResponse
 * @property {string} status - Estado de la respuesta
 * @property {Array<Product>} data - Lista de productos
 */

/**
 * @typedef {object} ProductResponse
 * @property {string} status - Estado de la respuesta
 * @property {Product} data - Producto solicitado
 */

/**
 * @typedef {object} CreateProductRequest
 * @property {string} name.required - Nombre del producto
 * @property {string} description - Descripción del producto
 * @property {number} priceList1.required - Precio lista 1
 * @property {number} priceList2 - Precio lista 2
 * @property {number} priceList3 - Precio lista 3
 * @property {number} stock.required - Cantidad en stock
 * @property {string} barcode - Código de barras
 * @property {string} imageUrl - URL de la imagen
 */

/**
 * @typedef {object} UpdateProductRequest
 * @property {string} name - Nombre del producto
 * @property {string} description - Descripción del producto
 * @property {number} priceList1 - Precio lista 1
 * @property {number} priceList2 - Precio lista 2
 * @property {number} priceList3 - Precio lista 3
 * @property {number} stock - Cantidad en stock
 * @property {string} barcode - Código de barras
 */

/**
 * @typedef {object} UpdateProductImageRequest
 * @property {string} imageUrl.required - URL de la imagen
 */

/**
 * @typedef {object} ProductOperationResponse
 * @property {string} status - Estado de la operación (success/error)
 * @property {string} message - Mensaje descriptivo
 * @property {Product} [data] - Datos del producto (opcional)
 */

// Aplicar middleware de seguridad a todas las rutas
router.use(sanitizeBody, sanitizeParams);

/**
 * Obtener todos los productos
 * @route GET /products
 * @group Products - Operaciones relacionadas con productos
 * @security bearerAuth
 * @returns {ProductsResponse} 200 - Lista de productos obtenida exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/products', 
  verifyToken, 
  checkRole([1, 2]), // Permitir acceso a todos los usuarios autenticados
  productController.getProducts
);

/**
 * Obtener producto por ID
 * @route GET /products/{productId}
 * @group Products - Operaciones relacionadas con productos
 * @param {number} productId.path.required - ID del producto
 * @security bearerAuth
 * @returns {ProductResponse} 200 - Producto obtenido exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 404 - Producto no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/products/:productId', 
  verifyToken, 
  checkRole([1, 2]), // Permitir acceso a todos los usuarios autenticados
  productController.getProduct
);

/**
 * Crear un nuevo producto
 * @route POST /products
 * @group Products - Operaciones relacionadas con productos
 * @param {CreateProductRequest} request.body.required - Datos del producto
 * @security bearerAuth
 * @returns {ProductResponse} 201 - Producto creado exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/products', 
  verifyToken, 
  checkRole([1]), // Solo administradores 
  productController.createProduct
);

/**
 * Actualizar producto
 * @route PUT /products/{productId}
 * @group Products - Operaciones relacionadas con productos
 * @param {number} productId.path.required - ID del producto
 * @param {UpdateProductRequest} request.body.required - Datos a actualizar
 * @security bearerAuth
 * @returns {ProductResponse} 200 - Producto actualizado exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 404 - Producto no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.put('/products/:productId', 
  verifyToken, 
  checkRole([1]), 
  productController.updateProduct
);

/**
 * Actualizar imagen de producto
 * @route PUT /products/{productId}/image
 * @group Products - Operaciones relacionadas con productos
 * @param {number} productId.path.required - ID del producto
 * @param {UpdateProductImageRequest} request.body.required - Nueva URL de imagen
 * @security bearerAuth
 * @returns {ProductResponse} 200 - Imagen actualizada exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 404 - Producto no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.put('/products/:productId/image', 
  verifyToken, 
  checkRole([1]), 
  productController.updateProductImage
);

/**
 * Eliminar producto
 * @route DELETE /products/{productId}
 * @group Products - Operaciones relacionadas con productos
 * @param {number} productId.path.required - ID del producto
 * @security bearerAuth
 * @returns {ProductOperationResponse} 200 - Producto eliminado exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 404 - Producto no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.delete('/products/:productId', 
  verifyToken, 
  checkRole([1]), 
  productController.deleteProduct
);

module.exports = router;