// src/services/SapPriceListService.js
const SapBaseService = require('./SapBaseService');
const PriceList = require('../models/PriceList');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('SapPriceListService');

/**
 * Servicio para sincronización de listas de precios desde SAP B1
 */
class SapPriceListService extends SapBaseService {
  constructor() {
    super('SapPriceListService');
    this.serviceType = 'PriceList';
  }

  /**
   * Inicializa el servicio de listas de precios
   * @returns {Promise<SapPriceListService>} Instancia de este servicio
   */
  async initialize() {
    if (this.initialized) return this;

    try {
      // Inicializar servicio base primero
      await super.initialize();
      
      this.logger.info('Servicio de listas de precios SAP inicializado correctamente');
      return this;
    } catch (error) {
      this.logger.error('Error al inicializar servicio de listas de precios SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtener todas las listas de precios desde SAP
   * @returns {Promise<Array>} - Array de listas de precios
   */
  async getPriceListsFromSap() {
    try {
      await this.ensureAuthentication();
      
      const url = `${this.baseUrl}/PriceLists`;
      const response = await this.makeRequest('GET', url);
      
      if (!response.value) {
        throw new Error('Invalid response format from SAP PriceLists endpoint');
      }

      const priceLists = response.value.filter(pl => pl.Active === 'tYES');
      
      logger.info('Price lists retrieved from SAP', { 
        total: response.value.length,
        active: priceLists.length 
      });
      
      return priceLists;
    } catch (error) {
      logger.error('Error getting price lists from SAP', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Obtener items con precios desde SAP para una lista específica
   * @param {number} priceListNo - Número de lista de precios en SAP
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} - Array de items con precios
   */
  async getItemsWithPricesFromSap(priceListNo = null, options = {}) {
    try {
      await this.ensureAuthentication();
      
      const { 
        top = 100, 
        skip = 0, 
        filter = null,
        activeOnly = true 
      } = options;

      let url = `${this.baseUrl}/Items?$select=ItemCode,ItemName,ItemPrices&$top=${top}&$skip=${skip}`;
      
      if (activeOnly) {
        const activeFilter = "Valid eq 'tYES'";
        url += filter ? `&$filter=${filter} and ${activeFilter}` : `&$filter=${activeFilter}`;
      } else if (filter) {
        url += `&$filter=${filter}`;
      }

      const response = await this.makeRequest('GET', url);
      
      if (!response.value) {
        throw new Error('Invalid response format from SAP Items endpoint');
      }

      // Filtrar items que tienen precios y procesar los datos
      const itemsWithPrices = response.value
        .filter(item => item.ItemPrices && item.ItemPrices.length > 0)
        .map(item => ({
          itemCode: item.ItemCode,
          itemName: item.ItemName,
          prices: priceListNo 
            ? item.ItemPrices.filter(price => price.PriceList === priceListNo)
            : item.ItemPrices
        }))
        .filter(item => item.prices.length > 0);

      logger.debug('Items with prices retrieved from SAP', { 
        totalItems: response.value.length,
        itemsWithPrices: itemsWithPrices.length,
        priceListNo,
        top,
        skip
      });
      
      return itemsWithPrices;
    } catch (error) {
      logger.error('Error getting items with prices from SAP', { 
        error: error.message,
        priceListNo,
        options
      });
      throw error;
    }
  }

  /**
   * Obtener precio específico de un producto usando la función de SAP
   * @param {string} itemCode - Código del item
   * @param {number} priceListNo - Número de lista de precios
   * @returns {Promise<Object>} - Precio del producto
   */
  async getItemPriceFromSap(itemCode, priceListNo) {
    try {
      await this.ensureAuthentication();
      
      const url = `${this.baseUrl}/CompanyService_GetItemPrice`;
      const requestBody = {
        ItemPriceParams: {
          ItemCode: itemCode,
          PriceList: priceListNo
        }
      };

      const response = await this.makeRequest('POST', url, requestBody);
      
      logger.debug('Item price retrieved from SAP', { 
        itemCode, 
        priceListNo, 
        price: response.Price 
      });
      
      return {
        itemCode,
        priceListNo,
        price: response.Price || 0,
        currency: response.Currency || 'COP',
        discount: response.Discount || 0
      };
    } catch (error) {
      logger.error('Error getting item price from SAP', { 
        error: error.message,
        itemCode,
        priceListNo
      });
      throw error;
    }
  }

  /**
   * Sincronizar todas las listas de precios desde SAP
   * @param {Object} options - Opciones de sincronización
   * @returns {Promise<Object>} - Resultado de la sincronización
   */
  async syncAllPriceLists(options = {}) {
    try {
      const { 
        batchSize = 50,
        maxItems = null,
        specificPriceList = null 
      } = options;

      logger.info('Starting price lists synchronization from SAP', options);

      // 1. Obtener listas de precios desde SAP
      const sapPriceLists = await this.getPriceListsFromSap();
      
      if (sapPriceLists.length === 0) {
        logger.warn('No active price lists found in SAP');
        return { success: true, message: 'No price lists to sync', stats: {} };
      }

      // 2. Filtrar por lista específica si se proporciona
      const priceListsToSync = specificPriceList 
        ? sapPriceLists.filter(pl => pl.PriceListNo === specificPriceList)
        : sapPriceLists;

      if (priceListsToSync.length === 0) {
        logger.warn('No matching price lists found', { specificPriceList });
        return { success: true, message: 'No matching price lists found', stats: {} };
      }

      const syncStats = {
        priceListsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeactivated: 0,
        errors: []
      };

      // 3. Sincronizar cada lista de precios
      for (const priceList of priceListsToSync) {
        try {
          logger.info('Syncing price list', { 
            priceListNo: priceList.PriceListNo,
            name: priceList.PriceListName 
          });

          const listStats = await this.syncSinglePriceList(priceList, {
            batchSize,
            maxItems
          });

          syncStats.priceListsProcessed++;
          syncStats.itemsCreated += listStats.itemsCreated;
          syncStats.itemsUpdated += listStats.itemsUpdated;
          syncStats.itemsDeactivated += listStats.itemsDeactivated;

        } catch (error) {
          logger.error('Error syncing price list', {
            priceListNo: priceList.PriceListNo,
            error: error.message
          });
          syncStats.errors.push({
            priceList: priceList.PriceListNo,
            error: error.message
          });
        }
      }

      logger.info('Price lists synchronization completed', syncStats);
      
      return {
        success: true,
        message: 'Price lists synchronized successfully',
        stats: syncStats
      };

    } catch (error) {
      logger.error('Error in price lists synchronization', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sincronizar una lista de precios específica
   * @param {Object} priceList - Datos de la lista de precios desde SAP
   * @param {Object} options - Opciones de sincronización
   * @returns {Promise<Object>} - Estadísticas de la sincronización
   */
  async syncSinglePriceList(priceList, options = {}) {
    try {
      const { batchSize = 50, maxItems = null } = options;
      
      const priceListCode = priceList.PriceListName;
      const sapPriceListNo = priceList.PriceListNo;
      
      let totalProcessed = 0;
      let skip = 0;
      let hasMoreItems = true;
      const allValidProductCodes = [];
      
      const stats = {
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeactivated: 0
      };

      // Procesar items en lotes
      while (hasMoreItems && (!maxItems || totalProcessed < maxItems)) {
        const remainingItems = maxItems ? maxItems - totalProcessed : batchSize;
        const currentBatchSize = Math.min(batchSize, remainingItems);

        logger.debug('Processing batch', { 
          priceListCode, 
          skip, 
          batchSize: currentBatchSize 
        });

        const itemsWithPrices = await this.getItemsWithPricesFromSap(sapPriceListNo, {
          top: currentBatchSize,
          skip: skip
        });

        if (itemsWithPrices.length === 0) {
          hasMoreItems = false;
          break;
        }

        // Procesar cada item del lote
        for (const item of itemsWithPrices) {
          try {
            for (const priceData of item.prices) {
              const priceListData = {
                priceListCode: priceListCode,
                priceListName: priceList.PriceListName,
                productCode: item.itemCode,
                productName: item.itemName,
                price: priceData.Price || 0,
                currency: priceData.Currency || 'COP',
                additionalPrice1: priceData.AdditionalPrice1 || 0,
                additionalPrice2: priceData.AdditionalPrice2 || 0,
                factor: priceData.Factor || 1,
                basePriceList: priceData.BasePriceList,
                sapPriceListNo: priceData.PriceList,
                isActive: true
              };

              const result = await PriceList.upsert(priceListData);
              
              if (result) {
                // Verificar si fue creado o actualizado basándose en las fechas
                const isNew = new Date(result.created_at).getTime() === new Date(result.updated_at).getTime();
                if (isNew) {
                  stats.itemsCreated++;
                } else {
                  stats.itemsUpdated++;
                }
              }

              allValidProductCodes.push(item.itemCode);
            }
          } catch (itemError) {
            logger.error('Error processing item', {
              itemCode: item.itemCode,
              priceListCode,
              error: itemError.message
            });
          }
        }

        totalProcessed += itemsWithPrices.length;
        skip += currentBatchSize;

        // Si obtuvimos menos items que el tamaño del lote, no hay más items
        if (itemsWithPrices.length < currentBatchSize) {
          hasMoreItems = false;
        }
      }

      // Limpiar productos que ya no existen en SAP
      const deactivatedCount = await PriceList.cleanupInvalidProducts(
        priceListCode, 
        [...new Set(allValidProductCodes)] // Eliminar duplicados
      );
      stats.itemsDeactivated = deactivatedCount;

      logger.info('Price list synchronization completed', {
        priceListCode,
        totalProcessed,
        stats
      });

      return stats;

    } catch (error) {
      logger.error('Error syncing single price list', {
        priceListNo: priceList?.PriceListNo,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Verificar si existe una lista de precios en SAP
   * @param {number} priceListNo - Número de lista de precios
   * @returns {Promise<Object|null>} - Datos de la lista o null si no existe
   */
  async validatePriceListInSap(priceListNo) {
    try {
        await this.ensureAuthentication();
            
      const url = `${this.baseUrl}/PriceLists(${priceListNo})`;
      const response = await this.makeRequest('GET', url);
      
      if (response && response.Active === 'tYES') {
        logger.debug('Price list validated in SAP', { 
          priceListNo, 
          name: response.PriceListName 
        });
        return response;
      }
      
      logger.warn('Price list not found or inactive in SAP', { priceListNo });
      return null;
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        logger.debug('Price list does not exist in SAP', { priceListNo });
        return null;
      }
      
      logger.error('Error validating price list in SAP', {
        priceListNo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Buscar productos por nombre o código en SAP
   * @param {string} searchTerm - Término de búsqueda
   * @param {number} priceListNo - Número de lista de precios
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<Array>} - Array de productos encontrados
   */
  async searchProductsInSap(searchTerm, priceListNo, options = {}) {
    try {
      await this.ensureAuthentication();
      
      const { top = 20 } = options;
      
      // Crear filtro de búsqueda
      const searchFilter = `(substringof('${searchTerm}', ItemCode) or substringof('${searchTerm}', ItemName)) and Valid eq 'tYES'`;
      
      const url = `${this.baseUrl}/Items?$select=ItemCode,ItemName,ItemPrices&$filter=${encodeURIComponent(searchFilter)}&$top=${top}`;
      
      const response = await this.makeRequest('GET', url);
      
      if (!response.value) {
        return [];
      }

      // Filtrar y formatear resultados
      const products = response.value
        .filter(item => item.ItemPrices && item.ItemPrices.length > 0)
        .map(item => {
          const priceData = item.ItemPrices.find(p => p.PriceList === priceListNo);
          return {
            itemCode: item.ItemCode,
            itemName: item.ItemName,
            price: priceData ? priceData.Price : 0,
            currency: priceData ? priceData.Currency : 'COP',
            hasPrice: !!priceData
          };
        });

      logger.debug('Products searched in SAP', {
        searchTerm,
        priceListNo,
        found: products.length
      });
      
      return products;
    } catch (error) {
      logger.error('Error searching products in SAP', {
        searchTerm,
        priceListNo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener resumen de sincronización de listas de precios
   * @returns {Promise<Object>} - Resumen del estado de sincronización
   */
  async getSyncSummary() {
    try {
      // Obtener listas de SAP
      const sapPriceLists = await this.getPriceListsFromSap();
      
      // Obtener listas locales
      const localPriceLists = await PriceList.getAllPriceLists();
      
      const summary = {
        sapPriceLists: sapPriceLists.map(pl => ({
          priceListNo: pl.PriceListNo,
          name: pl.PriceListName,
          active: pl.Active === 'tYES',
          currency: pl.DefaultPrimeCurrency
        })),
        localPriceLists: localPriceLists,
        syncStatus: {
          totalSapLists: sapPriceLists.length,
          totalLocalLists: localPriceLists.length,
          lastSyncDate: localPriceLists.length > 0 
            ? Math.max(...localPriceLists.map(pl => new Date(pl.last_sync || 0).getTime()))
            : null
        }
      };

      // Identificar listas no sincronizadas
      const syncedListNumbers = localPriceLists.map(ll => ll.sap_price_list_no);
      const unsyncedLists = sapPriceLists.filter(sl => 
        sl.Active === 'tYES' && !syncedListNumbers.includes(sl.PriceListNo)
      );
      
      summary.syncStatus.unsyncedLists = unsyncedLists.map(ul => ({
        priceListNo: ul.PriceListNo,
        name: ul.PriceListName
      }));

      logger.debug('Sync summary generated', {
        sapLists: summary.syncStatus.totalSapLists,
        localLists: summary.syncStatus.totalLocalLists,
        unsynced: summary.syncStatus.unsyncedLists.length
      });
      
      return summary;
    } catch (error) {
      logger.error('Error generating sync summary', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = SapPriceListService;