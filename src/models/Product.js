// models/Product.js
const pool = require('../config/db');

class Product {
  static async create(product) {
    const { name, description, priceList1, priceList2, priceList3, stock, barcode, imageUrl } = product;
    const query = `
      INSERT INTO products (name, description, price_list1, price_list2, price_list3, stock, barcode, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [name, description, priceList1, priceList2, priceList3, stock, barcode, imageUrl];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findById(productId) {
    const query = 'SELECT * FROM products WHERE product_id = $1;';
    const { rows } = await pool.query(query, [productId]);
    return rows[0];
  }

  static async updateImage(productId, imageUrl) {
    const query = 'UPDATE products SET image_url = $1 WHERE product_id = $2 RETURNING *;';
    const { rows } = await pool.query(query, [imageUrl, productId]);
    return rows[0];
  }

  // Otros métodos como update, delete, etc.
}

module.exports = Product;