const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { createOrder } = require('../controllers/orderController');

const router = express.Router();

/**
 * @typedef {object} OrderDetail
 * @property {number} product_id.required - ID del producto
 * @property {number} quantity.required - Cantidad del producto
 * @property {number} unit_price.required - Precio unitario
 */

/**
 * @typedef {object} CreateOrderRequest
 * @property {number} user_id.required - ID del usuario
 * @property {number} total_amount.required - Monto total de la orden
 * @property {Array<OrderDetail>} details.required - Detalles de la orden
 */

/**
 * @typedef {object} CreateOrderResponse
 * @property {string} message - Mensaje de éxito
 * @property {object} order_id - ID de la orden creada
 * @property {number} details_count - Cantidad de detalles en la orden
 */

/**
 * Crear una nueva orden
 * @route POST /orders
 * @group Orders - Operaciones relacionadas con órdenes
 * @param {CreateOrderRequest} request.body.required - Datos de la orden
 * @security BearerAuth
 * @returns {CreateOrderResponse} 201 - Orden creada exitosamente
 * @returns {object} 400 - Datos inválidos
 * @returns {object} 401 - No autorizado
 * @returns {object} 500 - Error interno del servidor
 */
router.post('/orders', verifyToken, createOrder);

module.exports = router;