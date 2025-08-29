// src/controllers/testSapDataController.js
const SapServiceManager = require('../services/SapServiceManager');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('TestSapDataController');

/**
 * Endpoint temporal para probar datos de SAP
 */
async function testSapData(req, res) {
  try {
    logger.info('Iniciando prueba de datos SAP...');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    // Inicializar servicio SAP
    const sapService = await SapServiceManager.getInstance();
    await sapService.initialize();
    
    results.tests.sapConnection = { status: 'success', message: 'Conexión SAP establecida' };
    
    try {
      // 1. Verificar BusinessPartners (clientes)
      const bpResponse = await sapService.get('/BusinessPartners', {
        $select: 'CardCode,CardName,PriceListNum,ListNum',
        $filter: 'CardType eq \'C\'',
        $top: 3
      });
      
      results.tests.businessPartners = {
        status: 'success',
        count: bpResponse.value.length,
        sample: bpResponse.value.map(bp => ({
          CardCode: bp.CardCode,
          CardName: bp.CardName,
          PriceListNum: bp.PriceListNum,
          ListNum: bp.ListNum
        }))
      };
    } catch (bpError) {
      results.tests.businessPartners = {
        status: 'error',
        error: bpError.message
      };
    }
    
    try {
      // 2. Verificar PriceLists
      const priceListResponse = await sapService.get('/PriceLists', {
        $select: 'PriceListNo,PriceListName,IsGrossPrice,Active',
        $top: 5
      });
      
      results.tests.priceLists = {
        status: 'success',
        count: priceListResponse.value.length,
        sample: priceListResponse.value
      };
    } catch (plError) {
      results.tests.priceLists = {
        status: 'error',
        error: plError.message
      };
    }
    
    try {
      // 3. Verificar Items
      const itemsResponse = await sapService.get('/Items', {
        $select: 'ItemCode,ItemName,Valid',
        $top: 3
      });
      
      results.tests.items = {
        status: 'success',
        count: itemsResponse.value.length,
        sample: itemsResponse.value
      };
    } catch (itemError) {
      results.tests.items = {
        status: 'error',
        error: itemError.message
      };
    }
    
    try {
      // 4. Cliente específico
      const specificClient = await sapService.get('/BusinessPartners', {
        $select: 'CardCode,CardName,PriceListNum,ListNum',
        $filter: 'CardCode eq \'CI900459737\'',
        $top: 1
      });
      
      results.tests.specificClient = {
        status: 'success',
        found: specificClient.value.length > 0,
        data: specificClient.value[0] || null
      };
    } catch (scError) {
      results.tests.specificClient = {
        status: 'error',
        error: scError.message
      };
    }
    
    logger.info('Prueba de datos SAP completada exitosamente');
    
    res.status(200).json({
      success: true,
      message: 'Prueba de datos SAP completada',
      data: results
    });
    
  } catch (error) {
    logger.error('Error en prueba de datos SAP:', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al probar datos SAP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = {
  testSapData
};
