// models/Product.js
const pool = require('../config/db');

class Product {
  static async create(product) {
    const { code, description, priceList1, priceList2, priceList3, barcode, imageUrl } = product;
    const query = `
      INSERT INTO products (code, description, price_list1, price_list2, price_list3, barcode, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [code, description, priceList1, priceList2, priceList3, barcode, imageUrl];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findByCode(code) {
    const query = 'SELECT * FROM products WHERE code = $1;';
    const { rows } = await pool.query(query, [code]);
    return rows[0];
  }

  static async updateImage(code, imageUrl) {
    const query = 'UPDATE products SET image_url = $1 WHERE code = $2 RETURNING *;';
    const { rows } = await pool.query(query, [imageUrl, code]);
    return rows[0];
  }

  // Pendientes los métodos para actualizar, borrar, etc
}

module.exports = Product;