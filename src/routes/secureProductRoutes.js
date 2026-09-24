/**
 * @deprecated Desde 2026-09-23 (D6, feature/backoffice-core). Desmontado de app.js:
 * 0 peticiones a /api/secure/* en Producción (25-mar a 23-sep-2026) y en Staging
 * (29-may-2025 a 23-sep-2026); 0 referencias en el frontend (git grep). Duplicaba
 * 1:1 los mismos endpoints/controllers de productRoutes.js (/api/products). Se
 * conserva el archivo (no se borra) por si hiciera falta reactivarlo; ver
 * docs/CHANGELOG-backoffice-core.md.
 */
const express = require('express');
const productController = require('../controllers/productController');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Rutas protegidas que requieren autenticación
router.post('/secure/products', verifyToken, checkRole([1]), productController.createProduct);
router.put('/secure/products/:productId', verifyToken, checkRole([1, 3]), productController.updateProduct);
router.put('/secure/products/:productId/image', verifyToken, checkRole([1, 3]), productController.updateProductImage);
router.get('/secure/products', verifyToken, checkRole([1, 2, 3]), productController.getProducts);
router.get('/secure/products/:productId', verifyToken, checkRole([1, 2, 3]), productController.getProduct);
router.delete('/secure/products/:productId', verifyToken, checkRole([1]), productController.deleteProduct);

module.exports = router;