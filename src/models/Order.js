const pool = require('../config/db');

class Order {
  // Método para obtener el último ID de orden
  static async getLastOrderId() {
    const query = 'SELECT last_value FROM orders_order_id_seq';
    const result = await pool.query(query);
    return result.rows[0].last_value;
  }

  static async createOrder(user_id, total_amount, details) {
    if (!details || details.length === 0) {
      throw new Error("No se puede insertar una orden sin detalles.");
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar en Orders
      const orderQuery = `
        INSERT INTO Orders (user_id, total_amount)
        VALUES ($1, $2)
        RETURNING order_id;
      `;
      const orderResult = await client.query(orderQuery, [user_id, total_amount]);
      const order_id = orderResult.rows[0].order_id;

      console.log("ID de orden generado:", order_id);
      console.log("Detalles a insertar:", details);

      // Insertar múltiples detalles en una sola consulta
      const detailValues = details.map((detail, index) => {
        const offset = index * 4;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      }).join(', ');

      const detailParams = details.flatMap(detail => [
        order_id,
        detail.product_id,
        detail.quantity,
        detail.unit_price
      ]);

      const detailQuery = `
        INSERT INTO Order_Details (order_id, product_id, quantity, unit_price)
        VALUES ${detailValues};
      `;

      await client.query(detailQuery, detailParams);
      
      await client.query('COMMIT');
      return {
        order_id,
        details_count: details.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error en createOrder:", error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Order;