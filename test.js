const path = require('path');
const Product = require(path.join(__dirname, 'src', 'models', 'Product'));

async function testFindById() {
  try {
    const product = await Product.findById(1);
    console.log(product); // Debería mostrar el producto con ID 1
  } catch (error) {
    console.error('Error:', error);
  }
}

testFindById();