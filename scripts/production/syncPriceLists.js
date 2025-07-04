// scripts/syncPriceLists.js
require('dotenv').config();
const SapPriceListService = require('../src/services/SapPriceListService');
const { createContextLogger } = require('../src/config/logger');

const logger = createContextLogger('SyncPriceListsScript');

/**
 * Script para sincronización manual de listas de precios desde SAP
 */
async function syncPriceLists() {
  try {
    console.log('🚀 Iniciando sincronización de listas de precios desde SAP...');
    logger.info('Starting manual price lists synchronization');

    // Verificar configuración SAP
    if (!process.env.SAP_SERVICE_LAYER_URL) {
      throw new Error('SAP_SERVICE_LAYER_URL no está configurado en las variables de entorno');
    }

    // Obtener parámetros de línea de comandos
    const args = process.argv.slice(2);
    const options = {};

    // Parsear argumentos
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      
      switch (key) {
        case 'priceList':
          options.specificPriceList = parseInt(value);
          break;
        case 'batchSize':
          options.batchSize = parseInt(value);
          break;
        case 'maxItems':
          options.maxItems = parseInt(value);
          break;
        case 'help':
          showHelp();
          process.exit(0);
          break;
      }
    }

    // Valores por defecto
    options.batchSize = options.batchSize || 50;

    console.log('📋 Opciones de sincronización:', {
      priceList: options.specificPriceList || 'Todas las listas',
      batchSize: options.batchSize,
      maxItems: options.maxItems || 'Sin límite'
    });

    // Mostrar resumen antes de sincronizar
    console.log('\n📊 Obteniendo resumen actual...');
    const summary = await SapPriceListService.getSyncSummary();
    
    console.log('📈 Estado actual:');
    console.log(`   • Listas en SAP: ${summary.syncStatus.totalSapLists}`);
    console.log(`   • Listas locales: ${summary.syncStatus.totalLocalLists}`);
    console.log(`   • Listas no sincronizadas: ${summary.syncStatus.unsyncedLists.length}`);
    
    if (summary.syncStatus.unsyncedLists.length > 0) {
      console.log('   • Listas pendientes:');
      summary.syncStatus.unsyncedLists.forEach(list => {
        console.log(`     - ${list.name} (${list.priceListNo})`);
      });
    }

    console.log('\n⚡ Iniciando sincronización...');
    const startTime = Date.now();

    // Ejecutar sincronización
    const result = await SapPriceListService.syncAllPriceLists(options);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Mostrar resultados
    console.log('\n✅ Sincronización completada!');
    console.log(`⏱️  Duración: ${duration} segundos`);
    console.log('\n📊 Estadísticas:');
    console.log(`   • Listas procesadas: ${result.stats.priceListsProcessed}`);
    console.log(`   • Items creados: ${result.stats.itemsCreated}`);
    console.log(`   • Items actualizados: ${result.stats.itemsUpdated}`);
    console.log(`   • Items desactivados: ${result.stats.itemsDeactivated}`);
    
    if (result.stats.errors.length > 0) {
      console.log(`   • Errores: ${result.stats.errors.length}`);
      console.log('\n❌ Errores encontrados:');
      result.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. Lista ${error.priceList}: ${error.error}`);
      });
    }

    console.log('\n🎉 Sincronización completada exitosamente');
    logger.info('Manual price lists synchronization completed', result.stats);

  } catch (error) {
    console.error('\n❌ Error durante la sincronización:');
    console.error(error.message);
    
    if (process.env.NODE_ENV === 'development') {
      console.error('\n🔍 Stack trace:');
      console.error(error.stack);
    }
    
    logger.error('Error in manual price lists synchronization', {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  }
}

/**
 * Mostrar ayuda del script
 */
function showHelp() {
  console.log(`
🔧 Script de Sincronización de Listas de Precios

USO:
  node scripts/syncPriceLists.js [opciones]

OPCIONES:
  --priceList <número>    Sincronizar solo una lista específica (ej: --priceList 1)
  --batchSize <número>    Tamaño del lote para procesamiento (default: 50)
  --maxItems <número>     Máximo número de items a procesar por lista
  --help                  Mostrar esta ayuda

EJEMPLOS:
  # Sincronizar todas las listas
  node scripts/syncPriceLists.js

  # Sincronizar solo la lista 1 (ORO)
  node scripts/syncPriceLists.js --priceList 1

  # Sincronizar con lotes de 100 items
  node scripts/syncPriceLists.js --batchSize 100

  # Sincronizar máximo 500 items por lista
  node scripts/syncPriceLists.js --maxItems 500

  # Combinación de opciones
  node scripts/syncPriceLists.js --priceList 2 --batchSize 25 --maxItems 200

LISTAS DISPONIBLES (según tu SAP):
  1 - ORO
  2 - PLATA  
  3 - BRONCE
  4-10 - Lista de precios 04-10

VARIABLES DE ENTORNO REQUERIDAS:
  - SAP_SERVICE_LAYER_URL
  - SAP_USERNAME
  - SAP_PASSWORD
  - SAP_COMPANY_DB
  `);
}

// Ejecutar script si es llamado directamente
if (require.main === module) {
  syncPriceLists();
}

module.exports = syncPriceLists;