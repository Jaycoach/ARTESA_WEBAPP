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
          
          if (sapClient.CardType !== 'cLid') {
            // Iniciar transacción para actualizar datos y activar usuario
            const dbClient = await pool.connect();
            try {
              await dbClient.query('BEGIN');
          
              // Procesar el FederalTaxID para extraer nit_number y verification_digit
              const taxInfo = this.processFederalTaxID(sapClient.FederalTaxID);

              // Primero actualizar datos del cliente con la información de SAP
              const updateClientQuery = `
                UPDATE client_profiles
                SET 
                  cardcode_sap = $1,
                  tax_id = $2,
                  nit_number = $3,
                  verification_digit = $4,
                  company_name = $5,
                  updated_at = CURRENT_TIMESTAMP
                WHERE client_id = $6
              `;

              await dbClient.query(updateClientQuery, [
                sapClient.CardCode, // Actualiza el cardcode_sap con el CardCode de SAP
                taxInfo.tax_id || client.tax_id, // Actualiza el tax_id con FederalTaxID procesado
                taxInfo.nit_number || client.nit_number, // Actualiza nit_number
                taxInfo.verification_digit || client.verification_digit, // Actualiza verification_digit
                sapClient.CardName || client.company_name, // Actualiza el company_name con CardName de SAP
                client.client_id
              ]);
          
              // Luego activar al usuario
              await dbClient.query('UPDATE users SET is_active = true WHERE id = $1', [client.user_id]);
              
              await dbClient.query('COMMIT');
              
              logger.info('Cliente sincronizado y usuario activado exitosamente', {
                userId: client.user_id,
                clientId: client.client_id,
                cardCode: sapClient.CardCode,
                cardType: sapClient.CardType,
                oldTaxId: client.tax_id,
                newTaxId: taxInfo.tax_id,
                dataUpdated: true
              });
              
              stats.activated++;
            } catch (updateError) {
              await dbClient.query('ROLLBACK');
              logger.error('Error al actualizar y activar cliente', {
                error: updateError.message,
                stack: updateError.stack,
                clientId: client.client_id,
                userId: client.user_id
              });
              stats.errors++;
            } finally {
              dbClient.release();
            }
          } else {
            // Actualizar datos del cliente aunque siga siendo Lead
            try {
              // Procesar el FederalTaxID para extraer nit_number y verification_digit
              const taxInfo = this.processFederalTaxID(sapClient.FederalTaxID);

              // Solo actualizamos los datos para mantener sincronización, sin activar el usuario
              await pool.query(`
                UPDATE client_profiles
                SET 
                  cardcode_sap = $1,
                  tax_id = $2,
                  nit_number = $3, 
                  verification_digit = $4,
                  company_name = $5,
                  updated_at = CURRENT_TIMESTAMP
                WHERE client_id = $6
              `, [
                sapClient.CardCode,
                taxInfo.tax_id || client.tax_id,
                taxInfo.nit_number || client.nit_number,
                taxInfo.verification_digit || client.verification_digit,
                sapClient.CardName || client.company_name,
                client.client_id
              ]);
          
              logger.debug('Cliente actualizado pero sigue siendo Lead, no se activa', {
                userId: client.user_id,
                clientId: client.client_id,
                cardCode: sapClient.CardCode,
                oldTaxId: client.tax_id,
                newTaxId: taxInfo.tax_id,
                dataUpdated: true
              });
              
              stats.skipped++;
            } catch (updateLeadError) {
              logger.error('Error al actualizar datos de cliente Lead', {
                error: updateLeadError.message,
                clientId: client.client_id,
                userId: client.user_id
              });
              stats.errors++;
            }
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
   * Procesa el FederalTaxID para extraer nit_number y verification_digit
   * @param {string} federalTaxID - Valor de FederalTaxID desde SAP (formato: "123456789-0")
   * @returns {Object} - Objeto con tax_id, nit_number y verification_digit
   */
  processFederalTaxID(federalTaxID) {
    if (!federalTaxID) {
      return { tax_id: null, nit_number: null, verification_digit: null };
    }
    
    // Verificar si ya tiene el formato con guión
    if (federalTaxID.includes('-')) {
      const [nitNumber, verificationDigit] = federalTaxID.split('-');
      return {
        tax_id: federalTaxID,
        nit_number: nitNumber,
        verification_digit: verificationDigit
      };
    } 
    
    // Si no tiene guión, intentar extraer el último dígito como dígito de verificación
    const nitLength = federalTaxID.length;
    if (nitLength > 1) {
      const nitNumber = federalTaxID.substring(0, nitLength - 1);
      const verificationDigit = federalTaxID.substring(nitLength - 1);
      const formattedTaxId = `${nitNumber}-${verificationDigit}`;
      return {
        tax_id: formattedTaxId,
        nit_number: nitNumber,
        verification_digit: verificationDigit
      };
    }
    
    // Si no se puede parsear, devolver el valor original como tax_id
    return {
      tax_id: federalTaxID,
      nit_number: federalTaxID,
      verification_digit: null
    };
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
          
          // Construir endpoint para obtener un Business Partner específico con todos los campos relevantes
          const endpoint = `BusinessPartners('${cardCode}')?$select=CardCode,CardName,CardType,FederalTaxID,U_AR_ArtesaCode,Phone1,EmailAddress,Address`;
          
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