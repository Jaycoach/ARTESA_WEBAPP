// src/controllers/priceListController.js
const PriceList = require('../models/PriceList');
const SapPriceListService = require('../services/SapPriceListService');
const { createContextLogger } = require('../config/logger');
const { validationResult } = require('express-validator');

const logger = createContextLogger('PriceListController');

/**
 * Controlador para manejo de listas de precios
 */
class PriceListController {
  /**
   * Obtener todas las listas de precios disponibles
   */
  async getAllPriceLists(req, res) {
    try {
      logger.debug('Getting all price lists');
      
      const priceLists = await PriceList.getAllPriceLists();
      
      res.status(200).json({
        success: true,
        count: priceLists.length,
        data: priceLists
      });
    } catch (error) {
      logger.error('Error getting all price lists', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener listas de precios',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener productos de una lista de precios específica
   */
  async getPriceListProducts(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { priceListCode } = req.params;
      const { 
        page = 1, 
        limit = 50, 
        search = null,
        orderBy = 'product_code',
        orderDirection = 'ASC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      logger.debug('Getting price list products', {
        priceListCode,
        page,
        limit,
        search
      });

      const result = await PriceList.getByPriceListCode(priceListCode, {
        limit: parseInt(limit),
        offset,
        search,
        orderBy,
        orderDirection: orderDirection.toUpperCase()
      });

      res.status(200).json({
        success: true,
        priceListCode,
        count: result.data.length,
        pagination: result.pagination,
        data: result.data
      });
    } catch (error) {
      logger.error('Error getting price list products', {
        priceListCode: req.params.priceListCode,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos de la lista de precios',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener precio específico de un producto
   */
  async getProductPrice(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { priceListCode, productCode } = req.params;
      
      logger.debug('Getting product price', {
        priceListCode,
        productCode
      });

      const productPrice = await PriceList.getProductPrice(priceListCode, productCode);

      if (!productPrice) {
        return res.status(404).json({
          success: false,
          message: 'Precio no encontrado para el producto en la lista especificada'
        });
      }

      res.status(200).json({
        success: true,
        data: productPrice
      });
    } catch (error) {
      logger.error('Error getting product price', {
        priceListCode: req.params.priceListCode,
        productCode: req.params.productCode,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener precio del producto',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener precios de múltiples productos
   */
  async getMultipleProductPrices(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { priceListCode } = req.params;
      const { productCodes } = req.body;

      if (!Array.isArray(productCodes) || productCodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de códigos de productos'
        });
      }

      logger.debug('Getting multiple product prices', {
        priceListCode,
        productCount: productCodes.length
      });

      const prices = await PriceList.getMultipleProductPrices(priceListCode, productCodes);

      // Crear mapa de precios para respuesta estructurada
      const priceMap = {};
      prices.forEach(price => {
        priceMap[price.product_code] = {
          price: price.price,
          currency: price.currency,
          productName: price.product_name || price.local_product_name,
          lastUpdate: price.updated_at
        };
      });

      // Identificar productos sin precio
      const productsWithoutPrice = productCodes.filter(code => !priceMap[code]);

      res.status(200).json({
        success: true,
        priceListCode,
        requestedProducts: productCodes.length,
        foundPrices: prices.length,
        productsWithoutPrice,
        data: priceMap
      });
    } catch (error) {
      logger.error('Error getting multiple product prices', {
        priceListCode: req.params.priceListCode,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener precios de productos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener estadísticas de una lista de precios
   */
  async getPriceListStatistics(req, res) {
    try {
      const { priceListCode } = req.params;
      
      logger.debug('Getting price list statistics', { priceListCode });

      const statistics = await PriceList.getStatistics(priceListCode);

      res.status(200).json({
        success: true,
        priceListCode,
        data: statistics
      });
    } catch (error) {
      logger.error('Error getting price list statistics', {
        priceListCode: req.params.priceListCode,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas de la lista de precios',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Sincronizar listas de precios desde SAP
   */
  async syncPriceListsFromSap(req, res) {
    try {
      const {
        priceListNo = null,
        batchSize = 50,
        maxItems = null
      } = req.body;

      logger.info('Starting price lists sync from SAP', {
        priceListNo,
        batchSize,
        maxItems,
        userId: req.user?.id
      });

      const sapPriceListService = new SapPriceListService();
      const result = await sapPriceListService.syncAllPriceLists({
        specificPriceList: priceListNo,
        batchSize: parseInt(batchSize),
        maxItems: maxItems ? parseInt(maxItems) : null
      });

      res.status(200).json({
        success: true,
        message: 'Sincronización completada',
        data: result
      });
    } catch (error) {
      logger.error('Error syncing price lists from SAP', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar listas de precios desde SAP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * Buscar productos en SAP por término
   */
  async searchProductsInSap(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { searchTerm, priceListNo } = req.query;

      if (!searchTerm || searchTerm.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      if (!priceListNo) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el número de lista de precios'
        });
      }

      logger.debug('Searching products in SAP', {
        searchTerm,
        priceListNo
      });

      const sapPriceListService = new SapPriceListService();
      const products = await sapPriceListService.searchProductsInSap(
        searchTerm,
        parseInt(priceListNo),
        { top: 20 }
      );

      res.status(200).json({
        success: true,
        searchTerm,
        priceListNo: parseInt(priceListNo),
        count: products.length,
        data: products
      });
    } catch (error) {
      logger.error('Error searching products in SAP', {
        searchTerm: req.query.searchTerm,
        priceListNo: req.query.priceListNo,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al buscar productos en SAP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Validar lista de precios en SAP
   */
  async validatePriceListInSap(req, res) {
    try {
      const { priceListNo } = req.params;

      if (!priceListNo || isNaN(parseInt(priceListNo))) {
        return res.status(400).json({
          success: false,
          message: 'Número de lista de precios inválido'
        });
      }

      logger.debug('Validating price list in SAP', { priceListNo });

      const sapPriceListService = new SapPriceListService();
      const priceListData = await sapPriceListService.validatePriceListInSap(parseInt(priceListNo));

      if (!priceListData) {
        return res.status(404).json({
          success: false,
          message: 'Lista de precios no encontrada o inactiva en SAP'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Lista de precios válida',
        data: {
          priceListNo: priceListData.PriceListNo,
          name: priceListData.PriceListName,
          active: priceListData.Active === 'tYES',
          currency: priceListData.DefaultPrimeCurrency
        }
      });
    } catch (error) {
      logger.error('Error validating price list in SAP', {
        priceListNo: req.params.priceListNo,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al validar lista de precios en SAP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * Obtener resumen de sincronización
   */
  async getSyncSummary(req, res) {
    try {
      logger.debug('Getting sync summary');
      
      const sapPriceListService = new SapPriceListService();
      const summary = await sapPriceListService.getSyncSummary();
      
      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting sync summary', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener resumen de sincronización',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Crear una instancia de la clase
const priceListControllerInstance = new PriceListController();

module.exports = {
  getAllPriceLists: (req, res) => priceListControllerInstance.getAllPriceLists(req, res),
  getPriceListProducts: (req, res) => priceListControllerInstance.getPriceListProducts(req, res),
  getProductPrice: (req, res) => priceListControllerInstance.getProductPrice(req, res),
  getMultipleProductPrices: (req, res) => priceListControllerInstance.getMultipleProductPrices(req, res),
  getPriceListStatistics: (req, res) => priceListControllerInstance.getPriceListStatistics(req, res),
  validatePriceListInSap: (req, res) => priceListControllerInstance.validatePriceListInSap(req, res),
  syncPriceListsFromSap: (req, res) => priceListControllerInstance.syncPriceListsFromSap(req, res),
  getSyncSummary: (req, res) => priceListControllerInstance.getSyncSummary(req, res),
  searchProductsInSap: (req, res) => priceListControllerInstance.searchProductsInSap(req, res)
};