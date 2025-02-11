// src/controllers/productController.js
const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProductImage = async (req, res) => {
  try {
    const product = await Product.updateImage(req.params.productId, req.body.imageUrl);
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};