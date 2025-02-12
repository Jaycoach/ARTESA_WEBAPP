// src/models/Order.js
const pool = require('../config/db');

class Order {
  // Crear una nueva orden
  static async createOrder(user_id, total_amount, details) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); // Iniciar transacción

      // Insertar en Orders
      const orderQuery = `
        INSERT INTO Orders (user_id, total_amount)
        VALUES ($1, $2)
        RETURNING order_id;
      `;
      const orderResult = await client.query(orderQuery, [user_id, total_amount]);
      const order_id = orderResult.rows[0].order_id;

      // Insertar en Order_Details
      const detailQuery = `
        INSERT INTO Order_Details (order_id, product_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4);
      `;
      for (const detail of details) {
        await client.query(detailQuery, [order_id, detail.product_id, detail.quantity, detail.unit_price]);
      }

      await client.query('COMMIT'); // Confirmar transacción
      return order_id;
    } catch (error) {
      await client.query('ROLLBACK'); // Revertir transacción en caso de error
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Order;