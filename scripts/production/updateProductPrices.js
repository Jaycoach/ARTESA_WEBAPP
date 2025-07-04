// scripts/production/updateProductPrices.js
require('dotenv').config();
const PriceListController = require('../../src/controllers/priceListController');
const { createContextLogger } = require('../../src/config/logger');

const logger = createContextLogger('UpdateProductPricesScript');

/**
 * Script para actualización manual de precios de productos
 */
async function updateProductPrices() {
  try {
    console.log('🚀 Iniciando actualización de precios de productos...');
    logger.info('Starting manual product prices update');

    const priceListController = new PriceListController();
    const result = await priceListController.updateProductPricesFromPriceLists();

    console.log('\n✅ Actualización completada!');
    console.log('📊 Estadísticas:');
    console.log(`   • Productos procesados: ${result.productsProcessed}`);
    console.log(`   • Actualizaciones price_list1: ${result.priceList1Updates}`);
    console.log(`   • Actualizaciones price_list2: ${result.priceList2Updates}`);
    console.log(`   • Actualizaciones price_list3: ${result.priceList3Updates}`);
    console.log(`   • Errores: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      result.errors.forEach(error => {
        console.log(`   • Producto ${error.productId}: ${error.error}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la actualización:', error.message);
    logger.error('Error in updateProductPrices script', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  updateProductPrices();
}

module.exports = updateProductPrices;