const express = require('express');
const productController = require('../controllers/productController');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// Rutas protegidas que requieren autenticación
router.post('/secure/products', verifyToken, checkRole([1]), productController.createProduct);
router.put('/secure/products/:productId', verifyToken, checkRole([1]), productController.updateProduct);
router.put('/secure/products/:productId/image', verifyToken, checkRole([1]), productController.updateProductImage);
router.get('/secure/products', verifyToken, checkRole([1, 2]), productController.getProducts);
router.get('/secure/products/:productId', verifyToken, checkRole([1, 2]), productController.getProduct);
router.delete('/secure/products/:productId', verifyToken, checkRole([1]), productController.deleteProduct);

module.exports = router;