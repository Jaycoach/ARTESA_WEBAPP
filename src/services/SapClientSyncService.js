const cron = require('node-cron');
const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');
const sapIntegrationService = require('./SapIntegrationService');

// Crear una instancia del logger con contexto
const logger = createContextLogger('SapClientSyncService');

/**
 * Servicio para sincronizar clientes con SAP Business One y actualizar sus estados
 */
class SapClientSyncService {
  constructor() {
    this.initialized = false;
    this.syncSchedule = '0 */2 6-20 * * *'; // Cada 2 horas desde las 6AM hasta las 8PM
    this.syncTasks = {};
    this.lastSyncTime = null;
  }

  /**
   * Inicializa el servicio y programa tareas
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('Inicializando servicio de sincronización de clientes con SAP B1');
      
      // Inicializar el servicio SAP si no está inicializado
      if (!sapIntegrationService.initialized) {
        await sapIntegrationService.initialize();
      }

      // Iniciar sincronización programada de clientes
      this.scheduleSyncTask();
      
      // Marcar como inicializado
      this.initialized = true;
      logger.info('Servicio de sincronización de clientes con SAP B1 inicializado correctamente');
      
      // Devolver instancia para encadenamiento de métodos
      return this;
    } catch (error) {
      logger.error('Error al inicializar servicio de sincronización de clientes con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Programa tarea para sincronización periódica de clientes
   */
  scheduleSyncTask() {
    // Validar formato de programación cron
    if (!cron.validate(this.syncSchedule)) {
      logger.error('Formato de programación inválido', {
        schedule: this.syncSchedule
      });
      throw new Error(`Formato de programación cron inválido: ${this.syncSchedule}`);
    }

    logger.info('Programando sincronización periódica de clientes', {
      schedule: this.syncSchedule
    });

    // Programar tarea cron
    this.syncTasks.clientSync = cron.schedule(this.syncSchedule, async () => {
      try {
        logger.info('Iniciando sincronización programada de clientes');
        await this.syncClientsWithSAP();
        logger.info('Sincronización programada de clientes completada exitosamente');
      } catch (error) {
        logger.error('Error en sincronización programada de clientes', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Sincroniza clientes de SAP B1 y actualiza su estado
   * @returns {Promise<Object>} Resultados de la sincronización
   */
  async syncClientsWithSAP() {
    const stats = {
      total: 0,
      activated: 0,
      errors: 0,
      skipped: 0
    };

    try {
      logger.info('Iniciando sincronización de clientes con SAP B1');
      
      // Registrar inicio de sincronización
      const syncStartTime = new Date();
      
      // Obtener clientes que necesitan ser verificados (sap_lead_synced = true, is_active = false)
      const query = `
        SELECT cp.*, u.id as user_id, u.is_active
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.cardcode_sap IS NOT NULL 
        AND cp.sap_lead_synced = true
        AND u.is_active = false
      `;
      
      const { rows } = await pool.query(query);
      stats.total = rows.length;
      
      logger.info(`Encontrados ${rows.length} clientes para verificar`);
      
      // Para cada cliente, verificar en SAP su estado
      for (const client of rows) {
        try {
          // Verificar si el cliente todavía existe en SAP
          const cardCode = client.cardcode_sap;
          if (!cardCode) {
            logger.warn('Cliente sin código SAP, saltando', { clientId: client.client_id });
            stats.skipped++;
            continue;
          }
          
          // Consultar el cliente en SAP por su cardCode
          const sapClient = await this.getBusinessPartnerBySapCode(cardCode);
          
          if (!sapClient) {
            logger.warn('Cliente no encontrado en SAP, saltando', { cardCode });
            stats.skipped++;
            continue;
          }
          
          // Verificar si ya no es Lead (CardType != 'L')
          if (sapClient.CardType !== 'L') {
            // Activar al usuario
            await pool.query('UPDATE users SET is_active = true WHERE id = $1', [client.user_id]);
            
            logger.info('Usuario activado exitosamente', {
              userId: client.user_id,
              cardCode,
              cardType: sapClient.CardType
            });
            
            stats.activated++;
          } else {
            logger.debug('Cliente sigue siendo Lead, no se activa', {
              userId: client.user_id,
              cardCode
            });
            stats.skipped++;
          }
        } catch (clientError) {
          logger.error('Error al procesar cliente', {
            error: clientError.message,
            stack: clientError.stack,
            clientId: client.client_id,
            cardCode: client.cardcode_sap
          });
          stats.errors++;
        }
      }
      
      // Actualizar timestamp de última sincronización
      this.lastSyncTime = syncStartTime;
      
      logger.info('Sincronización de clientes completada', {
        total: stats.total,
        activated: stats.activated,
        errors: stats.errors,
        skipped: stats.skipped
      });
      
      return stats;
    } catch (error) {
      logger.error('Error en sincronización de clientes con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
 * Obtiene información de un Business Partner por su CardCode
 * @param {string} cardCode - Código del cliente en SAP
 * @returns {Promise<Object>} - Información del cliente en SAP
 */
async getBusinessPartnerBySapCode(cardCode) {
    try {
      // Verificar que el servicio SAP esté inicializado
      if (!sapIntegrationService.initialized) {
        await sapIntegrationService.initialize();
      }
      
      // Iniciar sesión si es necesario
      if (!sapIntegrationService.sessionId) {
        await sapIntegrationService.login();
      }
      
      logger.debug('Consultando Business Partner en SAP por CardCode', { cardCode });
      
      // Primero intentar buscar por U_AR_ArtesaCode (campo personalizado de Artesa)
      let data = await sapIntegrationService.getBusinessPartnerByArtesaCode(cardCode);
      
      // Si no se encuentra por ArtesaCode, intentar directamente por CardCode
      if (!data) {
        logger.debug('No se encontró por código Artesa, intentando por CardCode', { cardCode });
        
        // Construir endpoint para obtener un Business Partner específico
        const endpoint = `BusinessPartners('${cardCode}')`;
        
        // Realizar petición a SAP
        data = await sapIntegrationService.request('GET', endpoint);
        
        if (!data || !data.CardCode) {
          logger.warn('Business Partner no encontrado o formato inválido', { cardCode });
          return null;
        }
      }
      
      logger.debug('Business Partner obtenido exitosamente', {
        cardCode,
        cardType: data.CardType,
        cardName: data.CardName
      });
      
      return data;
    } catch (error) {
      // Si el error es 404, significa que el BP no existe
      if (error.response && error.response.status === 404) {
        logger.warn('Business Partner no encontrado en SAP', { cardCode });
        return null;
      }
      
      logger.error('Error al obtener Business Partner de SAP', {
        cardCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Exportar instancia única (singleton)
const sapClientSyncService = new SapClientSyncService();
module.exports = sapClientSyncService;