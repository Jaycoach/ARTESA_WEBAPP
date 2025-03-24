const { createContextLogger } = require('../config/logger');
const SapBaseService = require('./SapBaseService');
const SapProductService = require('./SapProductService');
const SapClientService = require('./SapClientService');
const SapOrderService = require('./SapOrderService');

/**
 * Gestor centralizado para todos los servicios de integración con SAP
 * Permite inicializar y controlar todos los servicios desde un único punto
 */
class SapServiceManager {
  constructor() {
    this.logger = createContextLogger('SapServiceManager');
    this.initialized = false;
    
    // Referencias a los servicios específicos
    this.productService = SapProductService;
    this.clientService = SapClientService;
    this.orderService = SapOrderService;
  }

  /**
   * Inicializa todos los servicios de SAP
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.logger.info('Inicializando gestor de servicios SAP');

      // Verificación explícita de la conexión con SAP
      try {
        const testResult = await this.productService.login();
        if (testResult) {
          this.logger.info('Conexión con SAP B1 verificada exitosamente');
        } else {
          this.logger.warn('No se pudo verificar la conexión con SAP B1, algunos servicios podrían no funcionar correctamente');
        }
      } catch (connError) {
        this.logger.error('Error al verificar conexión con SAP B1', {
          error: connError.message,
          stack: connError.stack
        });
        // No lanzamos error para permitir que la aplicación funcione sin SAP
      }
      
      // Verificar configuración SAP
      if (!process.env.SAP_SERVICE_LAYER_URL) {
        this.logger.warn('No se ha configurado la URL de SAP Service Layer, la integración con SAP no estará disponible');
        return;
      }
      
      // Inicializar servicios
      const initTasks = [];
      
      // Inicializar servicio de productos
      initTasks.push(
        this.productService.initialize()
          .then(() => {
            this.logger.info('Servicio de productos SAP inicializado correctamente');
          })
          .catch(error => {
            this.logger.error('Error al inicializar servicio de productos SAP', {
              error: error.message,
              stack: error.stack
            });
          })
      );
      
      // Inicializar servicio de clientes
      initTasks.push(
        this.clientService.initialize()
          .then(() => {
            this.logger.info('Servicio de clientes SAP inicializado correctamente');
          })
          .catch(error => {
            this.logger.error('Error al inicializar servicio de clientes SAP', {
              error: error.message,
              stack: error.stack
            });
          })
      );
      
      // Inicializar servicio de órdenes
      initTasks.push(
        this.orderService.initialize()
          .then(() => {
            this.logger.info('Servicio de órdenes SAP inicializado correctamente');
          })
          .catch(error => {
            this.logger.error('Error al inicializar servicio de órdenes SAP', {
              error: error.message,
              stack: error.stack
            });
          })
      );
      
      // Esperar a que todos los servicios se inicialicen
      await Promise.allSettled(initTasks);
      
      this.initialized = true;
      this.logger.info('Gestor de servicios SAP inicializado correctamente');
    } catch (error) {
      this.logger.error('Error al inicializar gestor de servicios SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sincroniza productos desde SAP
   * @param {boolean} fullSync - Indica si es sincronización completa
   * @returns {Promise<object>} - Resultado de la sincronización
   */
  async syncProducts(fullSync = false) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.productService.syncProductsFromSAP(fullSync);
  }

  /**
   * Sincroniza productos de un grupo específico desde SAP
   * @param {number} groupCode - Código del grupo
   * @returns {Promise<object>} - Resultado de la sincronización
   */
  async syncProductsByGroup(groupCode) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.productService.syncProductsByGroupCode(groupCode);
  }

  /**
   * Sincroniza clientes con SAP
   * @returns {Promise<object>} - Resultado de la sincronización
   */
  async syncClients() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.clientService.syncClientsWithSAP();
  }

  /**
   * Sincroniza órdenes pendientes a SAP
   * @returns {Promise<object>} - Resultado de la sincronización
   */
  async syncOrders() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.orderService.syncOrdersToSAP();
  }

  /**
   * Actualiza estado de órdenes desde SAP
   * @returns {Promise<object>} - Resultado de la actualización
   */
  async updateOrderStatus() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.orderService.updateOrderStatusFromSAP();
  }

  /**
   * Verifica órdenes entregadas y facturadas desde SAP
   * @returns {Promise<object>} - Resultado de la verificación
   */
  async checkDeliveredOrders() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Obtener órdenes entregadas completamente
    const deliveredResult = await this.orderService.checkDeliveredOrdersFromSAP();
    
    // Obtener órdenes con entrega parcial
    const partialDeliveredResult = await this.orderService.checkPartialDeliveredOrdersFromSAP();
    
    // Obtener órdenes facturadas
    const invoicedResult = await this.orderService.checkInvoicedOrdersFromSAP();
    
    return {
      delivered: deliveredResult,
      partialDelivered: partialDeliveredResult,
      invoiced: invoicedResult,
      summary: {
        total: deliveredResult.total + partialDeliveredResult.total + invoicedResult.total,
        updated: deliveredResult.updated + partialDeliveredResult.updated + invoicedResult.updated,
        errors: deliveredResult.errors + partialDeliveredResult.errors + invoicedResult.errors,
        unchanged: deliveredResult.unchanged + partialDeliveredResult.unchanged + invoicedResult.unchanged
      }
    };
  }

  /**
   * Crea un lead en SAP
   * @param {object} clientProfile - Perfil del cliente
   * @returns {Promise<object>} - Resultado de la creación
   */
  async createOrUpdateLead(clientProfile) {
    if (!this.initialized) {
      await this.initialize();
    }
    // Asegúrate de que el servicio de clientes esté inicializado
    if (!this.clientService.initialized) {
      await this.clientService.initialize();
    }
    return this.clientService.createOrUpdateBusinessPartnerLead(clientProfile);
  }

  /**
   * Actualiza la descripción de un producto en SAP
   * @param {string} sapCode - Código SAP del producto
   * @param {string} description - Nueva descripción
   * @returns {Promise<object>} - Resultado de la actualización
   */
  async updateProductDescription(sapCode, description) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.productService.updateProductDescriptionInSAP(sapCode, description);
  }

  /**
   * Cierra la sesión de todos los servicios SAP
   */
  async logout() {
    if (!this.initialized) return;

    try {
      this.logger.info('Cerrando sesiones de servicios SAP');
      
      await Promise.allSettled([
        this.productService.logout(),
        this.clientService.logout(),
        this.orderService.logout()
      ]);
      
      this.logger.info('Sesiones de servicios SAP cerradas correctamente');
    } catch (error) {
      this.logger.error('Error al cerrar sesiones de servicios SAP', {
        error: error.message
      });
    }
  }

  /**
   * Obtiene el estado de sincronización de todos los servicios
   * @returns {object} - Estado de sincronización
   */
  getSyncStatus() {
    return {
      initialized: this.initialized,
      products: {
        lastSyncTime: this.productService.lastSyncTime,
        syncSchedule: this.productService.syncSchedule,
        groupSchedules: this.productService.groupSyncTasks
          ? Object.keys(this.productService.groupSyncTasks).map(groupCode => ({
              groupCode,
              lastSyncTime: this.productService.lastGroupSyncTime?.[groupCode] || null
            }))
          : []
      },
      clients: {
        lastSyncTime: this.clientService.lastSyncTime,
        syncSchedule: this.clientService.syncSchedule
      },
      orders: {
        lastSyncTime: this.orderService.lastSyncTime,
        syncSchedule: this.orderService.syncSchedule
      }
    };
  }
  /**
   * Sincroniza completamente todos los perfiles de cliente con SAP
   * @returns {Promise<object>} - Resultado de la sincronización completa
   */
  async syncAllClients() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.clientService.syncAllClientsWithSAP();
  }
}

// Exportar instancia única (singleton)
const sapServiceManager = new SapServiceManager();
module.exports = sapServiceManager;