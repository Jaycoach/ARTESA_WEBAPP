// src/routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router.post('/products', productController.createProduct);
router.get('/products/:code', productController.getProduct);
router.put('/products/:code/image', productController.updateProductImage);

// Otras rutas como update, delete, etc.

module.exports = router;