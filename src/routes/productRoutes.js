// src/routes/productRoutes.js
const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router.post('/products', productController.createProduct);
router.get('/products/:productId', productController.getProduct);
router.put('/products/:productId/image', productController.updateProductImage);

module.exports = router;