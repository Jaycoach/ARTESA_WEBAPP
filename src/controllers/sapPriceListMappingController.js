// src/controllers/sapSyncController.js - Agregar nuevo método
const SapPriceListService = require('../services/SapPriceListService');
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('SapSyncController');

/**
 * Sincronizar y actualizar mapeo dinámico de listas de precios desde SAP
 */
async function syncPriceListMapping(req, res) {
  try {
    logger.info('Iniciando sincronización de mapeo de listas de precios...');
    
    // 1. Obtener todas las listas de precios desde SAP
    const sapService = new SapPriceListService();
    await sapService.initialize();

    const sapPriceLists = await sapService.getPriceListsFromSap();
    logger.info(`Obtenidas ${sapPriceLists.length} listas de precios desde SAP`);
    
    // 2. Crear mapa de listas de precios
    const priceListMap = new Map();
    sapPriceLists.forEach(pl => {
      priceListMap.set(pl.PriceListNo, {
        code: pl.PriceListNo.toString(),
        name: pl.PriceListName,
        isGross: pl.IsGrossPrice === 'tYES',
        active: pl.Active === 'tYES'
      });
    });
    
    // 3. Obtener clientes desde SAP con sus listas de precios
    const clientsResponse = await sapService.makeRequest('GET',
      `${sapService.baseUrl}/BusinessPartners?$select=CardCode,CardName,PriceListNum,ListNum&$filter=CardType eq 'C' and Valid eq 'Y'`
    );

    const sapClients = clientsResponse.value;
    logger.info(`Obtenidos ${sapClients.length} clientes desde SAP`);
    
    // 4. Actualizar clientes en la base de datos con mapeo dinámico
    const updateResults = {
      updated: 0,
      notFound: 0,
      errors: 0
    };
    
    for (const sapClient of sapClients) {
      try {
        // Determinar qué lista de precios usar
        let priceListNum = sapClient.PriceListNum || sapClient.ListNum;
        
        if (!priceListNum) {
          logger.warn(`Cliente sin lista de precios: ${sapClient.CardCode}`);
          priceListNum = 1; // Lista por defecto
        }
        
        const priceListInfo = priceListMap.get(priceListNum);
        const priceListCode = priceListInfo ? priceListInfo.code : priceListNum.toString();
        const priceListName = priceListInfo ? priceListInfo.name : 'Desconocida';
        
        // Actualizar cliente en la base de datos
        const updateQuery = `
          UPDATE client_profiles 
          SET 
            price_list = $1,
            price_list_code = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE cardcode_sap = $3
        `;
        
        const result = await pool.query(updateQuery, [
          priceListNum,
          priceListCode,
          sapClient.CardCode
        ]);
        
        if (result.rowCount > 0) {
          updateResults.updated++;
          logger.debug(`Cliente actualizado: ${sapClient.CardCode} -> Lista ${priceListCode} (${priceListName})`);
        } else {
          updateResults.notFound++;
          logger.warn(`Cliente no encontrado en BD: ${sapClient.CardCode}`);
        }
        
      } catch (clientError) {
        updateResults.errors++;
        logger.error(`Error actualizando cliente ${sapClient.CardCode}:`, {
          error: clientError.message
        });
      }
    }
    
    // 5. Verificar resultados
    const verificationQuery = `
      SELECT 
        cp.price_list_code,
        cp.price_list,
        COUNT(*) as cantidad_clientes
      FROM client_profiles cp
      WHERE cp.price_list_code IS NOT NULL
      GROUP BY cp.price_list_code, cp.price_list
      ORDER BY cantidad_clientes DESC
    `;
    
    const verificationResult = await pool.query(verificationQuery);
    
    logger.info('Sincronización de mapeo completada', updateResults);
    
    res.status(200).json({
      success: true,
      message: 'Mapeo de listas de precios sincronizado exitosamente',
      data: {
        sapPriceLists: sapPriceLists.length,
        sapClients: sapClients.length,
        updateResults,
        currentMapping: verificationResult.rows
      }
    });
    
  } catch (error) {
    logger.error('Error en sincronización de mapeo de listas de precios:', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar mapeo de listas de precios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = {
  syncPriceListMapping
};
