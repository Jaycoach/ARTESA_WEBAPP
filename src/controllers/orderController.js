// src/controllers/orderController.js
const Order = require('../models/Order');

const createOrder = async (req, res) => {
  const { user_id, total_amount, details } = req.body;

  try {
    const order_id = await Order.createOrder(user_id, total_amount, details);
    res.status(201).json({ message: 'Orden creada exitosamente', order_id });
  } catch (error) {
    console.error('Error al crear la orden:', error);
    res.status(500).json({ message: 'Error al crear la orden', error: error.message });
  }
};

module.exports = { createOrder };