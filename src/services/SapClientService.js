const SapBaseService = require('./SapBaseService');
const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Servicio para integración de clientes con SAP Business One
 * Extiende el servicio base para proporcionar funcionalidades específicas de clientes
 */
class SapClientService extends SapBaseService {
  constructor() {
    super('SapClientService');
    this.syncSchedule = '0 */2 6-20 * *'; // Cada 2 horas desde las 6AM hasta las 8PM
    this.syncTasks = {};
  }

  /**
   * Inicializa el servicio y programa tareas
   */
  async initialize() {
    if (this.initialized) return this;
  
    try {
      // Inicializar servicio base primero
      await super.initialize();
      
      // Iniciar sincronización programada de clientes
      this.scheduleSyncTask();
      
      // Programar sincronización diaria completa
      this.scheduleDailySyncTask();
      
      return this;
    } catch (error) {
      this.logger.error('Error al inicializar servicio de clientes SAP', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Programa tarea para sincronización diaria completa de todos los perfiles
   */
  scheduleDailySyncTask() {
    // Programar para ejecutarse a las 3 AM todos los días
    const dailySyncSchedule = '0 3 * * *';
    
    // Validar formato de programación cron
    if (!cron.validate(dailySyncSchedule)) {
      this.logger.error('Formato de programación inválido para sincronización diaria', {
        schedule: dailySyncSchedule
      });
      return;
    }
  
    this.logger.info('Programando sincronización diaria completa de perfiles', {
      schedule: dailySyncSchedule
    });
  
    // Programar tarea cron
    this.syncTasks.dailyClientSync = cron.schedule(dailySyncSchedule, async () => {
      try {
        this.logger.info('Iniciando sincronización diaria completa de perfiles');
        await this.syncAllClientsWithSAP();
        // Sincronizar también clientes institucionales
        await this.syncInstitutionalClients();
        this.logger.info('Sincronización diaria completa de perfiles finalizada exitosamente');
      } catch (error) {
        this.logger.error('Error en sincronización diaria completa de perfiles', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Programa tarea para sincronización periódica de clientes
   */
  scheduleSyncTask() {
    // Validar formato de programación cron
    if (!cron.validate(this.syncSchedule)) {
      this.logger.error('Formato de programación inválido', {
        schedule: this.syncSchedule
      });
      throw new Error(`Formato de programación cron inválido: ${this.syncSchedule}`);
    }

    this.logger.info('Programando sincronización periódica de clientes', {
      schedule: this.syncSchedule
    });

    // Programar tarea cron
    this.syncTasks.clientSync = cron.schedule(this.syncSchedule, async () => {
      try {
        this.logger.info('Iniciando sincronización programada de clientes');
        await this.syncClientsWithSAP();
        this.logger.info('Sincronización programada de clientes completada exitosamente');
      } catch (error) {
        this.logger.error('Error en sincronización programada de clientes', {
          error: error.message,
          stack: error.stack
        });
      }
    });
  }
  /**
   * Busca un Business Partner prioritariamente por U_AR_ArtesaCode y luego por CardCode
   * @param {string} code - Código a buscar (puede ser CardCode o ArtesaCode)
   * @returns {Promise<Object|null>} - Business Partner encontrado o null
   */
  async getBusinessPartnerByAnyCode(code) {
    try {
      this.logger.debug('Buscando Business Partner por cualquier código', { code });
      
      // Primero intentar buscar por ArtesaCode
      const bpByArtesaCode = await this.getBusinessPartnerByArtesaCode(code);
      if (bpByArtesaCode) {
        this.logger.info('Business Partner encontrado por código Artesa', { 
          code,
          cardCode: bpByArtesaCode.CardCode
        });
        return bpByArtesaCode;
      }
      
      // Si no se encuentra, intentar por CardCode
      const bpByCardCode = await this.getBusinessPartnerBySapCode(code);
      if (bpByCardCode) {
        this.logger.info('Business Partner encontrado por CardCode', { 
          code,
          cardCode: bpByCardCode.CardCode
        });
        return bpByCardCode;
      }
      
      this.logger.warn('Business Partner no encontrado con ningún código', { code });
      return null;
    } catch (error) {
      this.logger.error('Error al buscar Business Partner por cualquier código', {
        code,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Crea o actualiza un socio de negocios tipo Lead en SAP B1
   * @param {Object} clientProfile - Datos del perfil de cliente
   * @returns {Promise<Object>} - Resultado de la operación en SAP
   */
  async createOrUpdateBusinessPartnerLead(clientProfile) {
    try {
      this.logger.info('Inicio de createOrUpdateBusinessPartnerLead', {
        clientProfile: JSON.stringify({
          client_id: clientProfile.client_id,
          nit_number: clientProfile.nit_number,
          verification_digit: clientProfile.verification_digit,
          razonSocial: clientProfile.razonSocial || clientProfile.company_name,
          nombre: clientProfile.nombre || clientProfile.contact_name
        })
      });
      
      // Crear CardCode único con formato requerido
      let cardCode = `CI${clientProfile.nit_number}`;

      // Validar que el NIT no esté ya en uso por otro cliente
      const existingByNIT = await this.checkExistingBusinessPartnerByNIT(
        clientProfile.nit_number, 
        clientProfile.verification_digit,
        clientProfile.client_id
      );

      if (existingByNIT && existingByNIT.client_id !== clientProfile.client_id) {
        throw new Error(`El NIT ${clientProfile.nit_number}-${clientProfile.verification_digit} ya está siendo utilizado por otro cliente`);
      }

      // Validar requisitos mínimos
      if (!clientProfile.nit_number || clientProfile.verification_digit === undefined) {
        const errorMsg = 'El NIT y dígito de verificación son requeridos para crear un Lead en SAP';
        this.logger.error(errorMsg, {
          nit_number: clientProfile.nit_number,
          verification_digit: clientProfile.verification_digit
        });
        throw new Error(errorMsg);
      }

      this.logger.debug('Creando/actualizando socio de negocios tipo Lead en SAP B1', {
        clientId: clientProfile.client_id,
        nit: clientProfile.nit_number,
        verification_digit: clientProfile.verification_digit
      });

      // Verificar si ya existe en SAP antes de decidir crear o actualizar
      let isUpdate = false;
      let existingPartner = null;

      // Asegurar que tenemos sesión activa antes de hacer consultas
      if (!this.sessionId) {
        this.logger.debug('No hay sesión activa, iniciando login con SAP');
        await this.login();
      }

      if (clientProfile.cardcode_sap) {
        // Si tenemos cardcode_sap, verificar que aún existe en SAP
        try {
          // Buscar si existe el BusinessPartner por múltiples criterios
          existingPartner = await this.findExistingBusinessPartner(clientProfile, cardCode);
          isUpdate = !!existingPartner;

          if (isUpdate) {
            this.logger.info('BusinessPartner existente encontrado', {
              clientId: clientProfile.client_id,
              foundBy: existingPartner._foundBy,
              existingCardCode: existingPartner.CardCode,
              requestedCardCode: cardCode
            });
            
            // Si el CardCode encontrado es diferente al generado, usar el existente
            if (existingPartner.CardCode !== cardCode) {
              this.logger.warn('CardCode generado difiere del existente, usando el existente', {
                generated: cardCode,
                existing: existingPartner.CardCode
              });
              // No reasignar cardCode aquí, usar businessPartnerData.CardCode más adelante
            }
          } else {
            this.logger.info('No se encontró BusinessPartner existente, procederá con creación', {
              cardCode,
              clientId: clientProfile.client_id
            });
          }
        } catch (error) {
          this.logger.warn('El CardCode guardado no existe en SAP, verificando por NIT', {
            cardcode_sap: clientProfile.cardcode_sap,
            error: error.message
          });
          // Si el cardcode_sap guardado no existe, verificar por NIT
          try {
            existingPartner = await this.getBusinessPartnerBySapCode(cardCode);
            isUpdate = !!existingPartner;
            if (isUpdate) {
              this.logger.info('Encontrado BusinessPartner existente por NIT (cardcode_sap inválido)', {
                cardCode,
                invalidCardcodeSap: clientProfile.cardcode_sap,
                existingCardCode: existingPartner.CardCode
              });
            }
          } catch (nitError) {
            // No existe por ningún código, proceder con creación
            isUpdate = false;
          }
        }
      } else {
        // Si no tenemos cardcode_sap, verificar si existe por NIT
        try {
          existingPartner = await this.getBusinessPartnerBySapCode(cardCode);
          isUpdate = !!existingPartner;
          if (isUpdate) {
            this.logger.info('Encontrado BusinessPartner existente por NIT', {
              cardCode,
              existingCardCode: existingPartner.CardCode
            });
          }
        } catch (error) {
          // No existe, proceder con creación
          isUpdate = false;
        }
      }
      
      // Formatear teléfono (asegurar que solo tenga dígitos numéricos)
      let phone = clientProfile.telefono || clientProfile.contact_phone || '';
      phone = phone.replace(/\D/g, '').substring(0, 20); // SAP puede aceptar más dígitos

      // Obtener el nombre correcto para SAP
      const businessPartnerName = clientProfile.razonSocial || 
      clientProfile.company_name || 
      clientProfile.nombre || 
      clientProfile.contact_name || 
      'Sin nombre';

      this.logger.info('Datos para crear BusinessPartner en SAP', {
      cardCode,
      businessPartnerName,
      nit: `${clientProfile.nit_number}-${clientProfile.verification_digit}`,
      phone,
      email: clientProfile.email || clientProfile.contact_email || '',
      address: clientProfile.direccion || clientProfile.address || '',
      isUpdate
      });
      
      // Validar que tenemos SessionId antes de proceder
      if (!this.sessionId) {
        logger.debug('No hay SessionId, intentando login antes de crear BP');
        await this.login();
        if (!this.sessionId) {
          throw new Error('No se pudo establecer sesión con SAP');
        }
      }

      // Preparar datos para SAP
      const businessPartnerData = {
        CardCode: cardCode,
        CardName: businessPartnerName,
        CardType: 'cLid',  // Lead - cambiar a 'cLid' que es el correcto para Leads
        PriceListNum: 1, // Siempre 1
        GroupCode: 102, // Grupo Por defecto
        FederalTaxID: `${clientProfile.nit_number}-${clientProfile.verification_digit}`,
        Phone1: phone,
        EmailAddress: clientProfile.email || clientProfile.contact_email || '',
        Address: clientProfile.direccion || clientProfile.address || '',
        U_AR_ArtesaCode: cardCode // Añadir campo personalizado
      };

      this.logger.debug('Objeto BusinessPartner a enviar a SAP', {
        CardCode: businessPartnerData.CardCode,
        CardName: businessPartnerData.CardName,
        CardType: businessPartnerData.CardType,
        FederalTaxID: businessPartnerData.FederalTaxID,
        isUpdate
      });

      // Verificar sesión antes de hacer la petición crítica
      if (!this.sessionId) {
        this.logger.warn('Sesión perdida antes de crear/actualizar BP, relogueando');
        await this.login();
      }

      // Si es actualización, usamos PATCH, si es creación usamos POST
      const method = isUpdate ? 'PATCH' : 'POST';

      const endpoint = isUpdate 
      ? `BusinessPartners('${existingPartner ? existingPartner.CardCode : cardCode}')` 
      : 'BusinessPartners';

    this.logger.info('Enviando solicitud a SAP', {
      method,
      endpoint,
      cardCode: businessPartnerData.CardCode,
      isUpdate,
      sessionActive: !!this.sessionId
    });

    const response = await this.request(method, endpoint, businessPartnerData);

    if (!response) {
      throw new Error('No se recibió respuesta de SAP');
    }

    this.logger.info('BusinessPartner procesado exitosamente en SAP', {
      cardCode: businessPartnerData.CardCode,
      method,
      isUpdate,
      responseCardCode: response.CardCode
    });

    return {
      success: true,
      cardCode: response.CardCode || businessPartnerData.CardCode,
      artesaCode: businessPartnerData.U_AR_ArtesaCode,
      isNew: !isUpdate,
      sapResponse: {
        CardCode: response.CardCode || businessPartnerData.CardCode,
        CardName: response.CardName,
        CardType: response.CardType
      }
    };
    
    } catch (error) {
      this.logger.error('Error al crear/actualizar socio de negocios Lead en SAP', {
        error: error.message,
        stack: error.stack,
        clientId: clientProfile.client_id,
        nit: clientProfile.nit_number,
        verification_digit: clientProfile.verification_digit,
        sessionActive: !!this.sessionId
      });
      
      // Devolvemos un objeto con success: false en lugar de lanzar el error
      // para que el controlador pueda manejarlo mejor
      return {
        success: false,
        error: error.message,
        details: {
          clientId: clientProfile.client_id,
          nit: `${clientProfile.nit_number}-${clientProfile.verification_digit}`,
          sessionActive: !!this.sessionId
        }
      };
    }
  }

  /**
   * Realiza una sincronización completa de todos los perfiles de clientes con SAP
   * @returns {Promise<Object>} Estadísticas de la sincronización
   */
  async syncAllClientsWithSAP() {
    const stats = {
      total: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };

    try {
      this.logger.info('Iniciando sincronización completa de todos los perfiles con SAP B1');
      
      // Registrar inicio de sincronización
      const syncStartTime = new Date();
      
      // Obtener todos los perfiles que tienen código SAP o código de perfil
      const query = `
        SELECT cp.*, u.id as user_id, u.is_active, u.name, u.mail
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE (cp.cardcode_sap IS NOT NULL OR cp.clientprofilecode_sap IS NOT NULL)
      `;
      
      const { rows } = await pool.query(query);
      stats.total = rows.length;
      
      this.logger.info(`Encontrados ${rows.length} perfiles para sincronizar con SAP`);
      
      // Para cada perfil, verificar y actualizar datos desde SAP
      for (const profile of rows) {
        try {
          // Buscar el cliente en SAP prioritariamente por clientprofilecode_sap 
          // que corresponde al campo U_AR_ArtesaCode en SAP
          let sapClient = null;
          
          if (profile.clientprofilecode_sap) {
            sapClient = await this.getBusinessPartnerByArtesaCode(profile.clientprofilecode_sap);
          }
          
          // Si no se encontró, intentar con cardcode_sap
          if (!sapClient && profile.cardcode_sap) {
            sapClient = await this.getBusinessPartnerBySapCode(profile.cardcode_sap);
          }
          
          // Si todavía no se encontró, intentar generando un código a partir del NIT
          if (!sapClient && profile.nit_number) {
            const generatedCode = `CI${profile.nit_number}`;
            if (generatedCode !== profile.cardcode_sap && generatedCode !== profile.clientprofilecode_sap) {
              sapClient = await this.getBusinessPartnerByAnyCode(generatedCode);
            }
          }
          
          // Si no encontramos el cliente en SAP, saltamos
          if (!sapClient) {
            this.logger.warn('Cliente no encontrado en SAP, saltando', { 
              client_id: profile.client_id,
              cardcode_sap: profile.cardcode_sap,
              clientprofilecode_sap: profile.clientprofilecode_sap,
              mail: profile.mail,
              name: profile.name
            });
            stats.skipped++;
            continue;
          }
          
          // Procesar datos del cliente de SAP
          const taxInfo = this.processFederalTaxID(sapClient.FederalTaxID);
          
          // Iniciar transacción para actualizar datos
          const dbClient = await pool.connect();
          try {
            await dbClient.query('BEGIN');
            
            // Recolectar todos los cambios desde SAP
            const updates = {};
            const changesDetected = [];
            
            // Verificar y actualizar campos principales
            if (sapClient.CardCode && sapClient.CardCode !== profile.cardcode_sap) {
              updates.cardcode_sap = sapClient.CardCode;
              changesDetected.push('cardcode_sap');
            }
            
            if (taxInfo.tax_id && taxInfo.tax_id !== profile.tax_id) {
              updates.tax_id = taxInfo.tax_id;
              changesDetected.push('tax_id');
            }
            
            if (taxInfo.nit_number && taxInfo.nit_number !== profile.nit_number) {
              updates.nit_number = taxInfo.nit_number;
              changesDetected.push('nit_number');
            }
            
            if (taxInfo.verification_digit && taxInfo.verification_digit !== profile.verification_digit) {
              updates.verification_digit = taxInfo.verification_digit;
              changesDetected.push('verification_digit');
            }
            
            if (sapClient.CardName && sapClient.CardName !== profile.company_name) {
              updates.company_name = sapClient.CardName;
              changesDetected.push('company_name');
            }
            
            if (sapClient.Phone1 && sapClient.Phone1 !== profile.contact_phone) {
              updates.contact_phone = sapClient.Phone1;
              changesDetected.push('contact_phone');
            }
            
            if (sapClient.EmailAddress && sapClient.EmailAddress !== profile.contact_email) {
              updates.contact_email = sapClient.EmailAddress;
              changesDetected.push('contact_email');
            }
            
            if (sapClient.Address && sapClient.Address !== profile.address) {
              updates.address = sapClient.Address;
              changesDetected.push('address');
            }
            
            if (sapClient.City && sapClient.City !== profile.city) {
              updates.city = sapClient.City;
              changesDetected.push('city');
            }
            
            if (sapClient.Country && sapClient.Country !== profile.country) {
              updates.country = sapClient.Country;
              changesDetected.push('country');
            }
            
            // Asegurar que siempre se actualice sap_lead_synced
            updates.sap_lead_synced = true;
            updates.updated_at = new Date().toISOString();
            
            // Si hay cambios para actualizar, ejecutar la actualización
            if (Object.keys(updates).length > 0) {
              const setClauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
              const values = Object.values(updates);
              
              const updateQuery = `
                UPDATE client_profiles
                SET ${setClauses.join(', ')}
                WHERE client_id = $${values.length + 1}
                RETURNING *
              `;
              
              values.push(profile.client_id);
              
              const updateResult = await dbClient.query(updateQuery, values);
              
              this.logger.info('Datos de perfil actualizados desde SAP', {
                clientId: profile.client_id,
                userId: profile.user_id,
                cardCode: sapClient.CardCode,
                changesDetected: changesDetected.join(', '),
                cardType: sapClient.CardType
              });
            }
            
            // Si el cliente ya no es Lead en SAP (CardType !== 'cLid'), activar el usuario si no está activo
            if (sapClient.CardType !== 'cLid' && !profile.is_active) {
              await dbClient.query('UPDATE users SET is_active = true WHERE id = $1', [profile.user_id]);
              // Actualizar cardtype_sap en el perfil
              await dbClient.query(
                'UPDATE client_profiles SET cardtype_sap = $1, updated_at = CURRENT_TIMESTAMP WHERE client_id = $2',
                [sapClient.CardType, profile.client_id]
              );

              logger.info('CardType actualizado en perfil', {
                clientId: profile.client_id,
                userId: profile.user_id,
                oldCardType: profile.cardtype_sap,
                newCardType: sapClient.CardType
              });
              this.logger.info('Usuario activado porque ya no es Lead en SAP', {
                userId: profile.user_id,
                clientId: profile.client_id,
                cardCode: sapClient.CardCode,
                cardType: sapClient.CardType
              });
            }
            
            await dbClient.query('COMMIT');
            
            stats.updated++;
          } catch (updateError) {
            await dbClient.query('ROLLBACK');
            stats.errors++;
            
            this.logger.error('Error al actualizar datos de perfil desde SAP', {
              error: updateError.message,
              stack: updateError.stack,
              clientId: profile.client_id,
              userId: profile.user_id
            });
          } finally {
            dbClient.release();
          }
        } catch (clientError) {
          stats.errors++;
          
          this.logger.error('Error al procesar perfil para sincronización', {
            error: clientError.message,
            stack: clientError.stack,
            clientId: profile.client_id,
            userId: profile.user_id
          });
        }
      }
      
      // Actualizar timestamp de última sincronización
      this.lastSyncTime = syncStartTime;
      
      this.logger.info('Sincronización completa de perfiles finalizada', {
        total: stats.total,
        updated: stats.updated,
        errors: stats.errors,
        skipped: stats.skipped
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en sincronización completa de perfiles con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Consulta un Business Partner por su código de artesa (U_AR_ArtesaCode)
   * @param {string} artesaCode - Código Artesa del cliente
   * @returns {Promise<Object|null>} - Datos del Business Partner o null si no existe
   */
  async getBusinessPartnerByArtesaCode(artesaCode) {
    try {
      // Verificar que hay un código válido
      if (!artesaCode) {
        this.logger.warn('Se intentó consultar un BP sin proporcionar código Artesa');
        return null;
      }
      
      this.logger.debug('Consultando Business Partner por código Artesa', { artesaCode });
      
      // Construir la consulta con filtro para el campo personalizado U_AR_ArtesaCode
      const endpoint = `BusinessPartners?$filter=U_AR_ArtesaCode eq '${artesaCode}'&$select=CardCode,CardName,CardType,FederalTaxID,Phone1,EmailAddress,Address,City,Country,ContactPerson,U_AR_ArtesaCode`;
      
      // Realizar la consulta a SAP
      const result = await this.request('GET', endpoint);
      
      // Verificar si se encontraron resultados
      if (!result || !result.value || result.value.length === 0) {
        this.logger.debug('No se encontró Business Partner con el código Artesa proporcionado', { artesaCode });
        return null;
      }
      
      // Devolver el primer resultado (debería ser único)
      const businessPartner = result.value[0];
      
      this.logger.info('Business Partner encontrado por código Artesa', {
        artesaCode,
        cardCode: businessPartner.CardCode,
        cardType: businessPartner.CardType,
        cardName: businessPartner.CardName
      });
      
      return businessPartner;
    } catch (error) {
      this.logger.error('Error al consultar Business Partner por código Artesa', {
        artesaCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Obtiene todos los clientes de SAP cuyo CardCode comience con "CI"
   * @returns {Promise<Array>} Lista de clientes con CardCode que inicia con "CI"
   */
  async getClientsByCardCodePrefix() {
    try {
      this.logger.info('Obteniendo clientes con CardCode que inicia con "CI" desde SAP');
      
      // Endpoint para obtener clientes cuyo CardCode comience con "CI" y sean tipo Customer
      const endpoint = `BusinessPartners?$filter=startswith(CardCode,'CI') and CardType eq 'C'&$select=CardCode,CardName,CardType,GroupCode,FederalTaxID,Phone1,EmailAddress,Address,City,Country,ContactPerson,U_AR_ArtesaCode`;
      
      const result = await this.request('GET', endpoint);
      
      if (!result || !result.value) {
        this.logger.warn('No se obtuvieron resultados o formato inesperado');
        return [];
      }
      
      this.logger.info(`Se encontraron ${result.value.length} clientes con CardCode que inicia con "CI"`);
      return result.value;
    } catch (error) {
      this.logger.error('Error al obtener clientes con CardCode CI', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sincroniza todos los clientes cuyo CardCode comience con "CI" e inserta como inactivos
   * @returns {Promise<Object>} Estadísticas de sincronización
   */
  async syncCIClients() {
    const stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };

    try {
      this.logger.info('Iniciando sincronización de clientes con CardCode que inicia con "CI"');
      
      // Obtener clientes de SAP cuyo CardCode comience con "CI"
      const sapClients = await this.getClientsByCardCodePrefix();
      
      if (!sapClients || sapClients.length === 0) {
        this.logger.warn('No se encontraron clientes con CardCode que inicie con "CI"');
        return stats;
      }

      stats.total = sapClients.length;

      for (const sapClient of sapClients) {
        const client = await pool.connect();
        
        try {
          await client.query('BEGIN');
          
          // Verificar si ya existe el cliente por CardCode
          const existingClientQuery = `
            SELECT cp.*, u.is_active 
            FROM client_profiles cp 
            LEFT JOIN users u ON cp.user_id = u.id 
            WHERE cp.cardcode_sap = $1
          `;
          const { rows: existingClients } = await client.query(existingClientQuery, [sapClient.CardCode]);
          
          if (existingClients.length > 0) {
            // Cliente ya existe, actualizar datos si es necesario
            const updateQuery = `
              UPDATE client_profiles 
              SET 
                company_name = $1,
                contact_phone = $2,
                contact_email = $3,
                address = $4,
                updated_at = CURRENT_TIMESTAMP
              WHERE cardcode_sap = $5
            `;
            
            await client.query(updateQuery, [
              sapClient.CardName,
              sapClient.Phone1,
              sapClient.EmailAddress,
              sapClient.Address,
              sapClient.CardCode
            ]);
            
            stats.updated++;
            this.logger.debug('Cliente actualizado', { cardCode: sapClient.CardCode });
          } else {
            // Cliente nuevo, crear usuario inactivo y perfil
            
            // 1. Crear usuario inactivo
            const userInsertQuery = `
              INSERT INTO users (name, mail, password, rol_id, is_active, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              RETURNING id
            `;
            
            // Generar username único basado en CardCode
            const username = sapClient.CardName || sapClient.CardCode;
            // Email temporal o usar el de SAP si existe
            // Validar que tenga email válido, si no, saltear este cliente
            if (!sapClient.EmailAddress || sapClient.EmailAddress.trim() === '') {
              this.logger.warn('Cliente CI sin email válido, saltando sincronización', { 
                cardCode: sapClient.CardCode 
              });
              stats.skipped++;
              continue;
            }
            const email = sapClient.EmailAddress;
            // Hash temporal para activación posterior
            const tempPassword = '$2b$10$temporary.hash.for.inactive.user'; // Hash temporal
            const roleId = 2; // Role USER
            const isActive = true; // ACTIVO - solo se inactiva por razones de seguridad
            
            const { rows: [newUser] } = await client.query(userInsertQuery, [
              username, email, tempPassword, roleId, isActive
            ]);
            
            // 2. Crear perfil de cliente
            const profileInsertQuery = `
              INSERT INTO client_profiles (
                user_id, 
                cardcode_sap,
                clientprofilecode_sap,
                company_name, 
                contact_phone, 
                contact_email, 
                address,
                nit_number,
                verification_digit
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING client_id
            `;
            
            // Extraer NIT del FederalTaxID si existe
            let nitNumber = null;
            let verificationDigit = null;
            if (sapClient.FederalTaxID) {
              const nitParts = sapClient.FederalTaxID.split('-');
              if (nitParts.length === 2) {
                nitNumber = nitParts[0];
                verificationDigit = parseInt(nitParts[1]);
              }
            }
            
            const { rows: [newProfile] } = await client.query(profileInsertQuery, [
              newUser.id,
              sapClient.CardCode,
              sapClient.CardCode,
              sapClient.CardName,
              sapClient.Phone1,
              sapClient.EmailAddress,
              sapClient.Address,
              nitNumber,
              verificationDigit
            ]);
            
            // 3. Sincronizar sucursales - siempre al menos una
            await this.syncClientBranchesForCI(sapClient.CardCode, newProfile.client_id);
                        
                        stats.created++;
                        this.logger.info('Cliente creado como inactivo', { 
                          cardCode: sapClient.CardCode,
                          userId: newUser.id,
                          clientId: newProfile.client_id
                        });
                      }
          
          await client.query('COMMIT');
          
        } catch (error) {
          await client.query('ROLLBACK');
          stats.errors++;
          this.logger.error('Error al procesar cliente individual', {
            cardCode: sapClient.CardCode,
            error: error.message
          });
        } finally {
          client.release();
        }
      }
      
      this.logger.info('Sincronización de clientes CI completada', { stats });
      
      return stats;
      
    } catch (error) {
      this.logger.error('Error en sincronización de clientes CI', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Sincroniza las sucursales específicamente para clientes CI
   * @param {string} cardCode - Código del cliente en SAP
   * @param {number} clientId - ID del cliente en la plataforma
   */
  async syncClientBranchesForCI(cardCode, clientId) {
    try {
      this.logger.debug('Sincronizando sucursales para cliente CI', { cardCode, clientId });
      
      // Obtener sucursales usando consulta directa a CRD1
      const branches = await this.getClientBranchesFromCRD1(cardCode);
      
      // Validación adicional y logging detallado
      this.logger.info('=== RESULTADO DE BÚSQUEDA DE SUCURSALES ===', { 
        cardCode, 
        clientId,
        totalSucursalesEncontradas: branches ? branches.length : 0,
        sucursales: branches ? branches.map(b => ({
          address: b.Address,
          street: b.Street,
          city: b.City,
          state: b.State
        })) : []
      });

      if (branches && branches.length > 0) {
        this.logger.info(`✅ Se procederán a sincronizar ${branches.length} sucursales para cliente ${cardCode}`);
      } else {
        this.logger.warn(`⚠️ No se encontraron sucursales en SAP para el cliente ${cardCode}, se creará una sucursal por defecto`);
      }
      
      if (!branches || branches.length === 0) {
        // Si no hay sucursales en SAP, crear una por defecto
        const defaultBranchQuery = `
          INSERT INTO client_branches (
            client_id, 
            ship_to_code,
            branch_name, 
            address, 
            city, 
            state,
            country,
            zip_code,
            phone,
            contact_person,
            is_default,
            municipality_code,
            mail
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        
        const client = await pool.connect();
        try {
          await client.query(defaultBranchQuery, [
            clientId,
            'PRINCIPAL',
            'Sucursal Principal',
            'Dirección por definir',
            'Ciudad por definir',
            '',
            'CO',
            '',
            '',
            '',
            true,
            null,
            null
          ]);
          
          this.logger.info('Sucursal por defecto creada para cliente CI', { cardCode, clientId });
        } finally {
          client.release();
        }
        return;
      }
      
      // Procesar sucursales desde SAP
      for (const branch of branches) {
        // Validar que tenemos los campos mínimos requeridos
        if (!branch.AddressName && !branch.Address) {
          this.logger.warn('Sucursal omitida por falta de AddressName/Address', {
            clientId,
            cardCode,
            branch: JSON.stringify(branch, null, 2)
          });
          continue;
        }

        // Normalizar los campos para evitar valores nulos
        const normalizedBranch = {
          AddressName: branch.AddressName || branch.Address || 'PRINCIPAL',
          Address: branch.Address || branch.AddressName || 'PRINCIPAL',
          Street: branch.Street || '',
          City: branch.City || '',
          State: branch.State || '',
          Country: branch.Country || 'CO',
          ZipCode: branch.ZipCode || '',
          U_AR_Phone: branch.U_AR_Phone || '',
          U_AR_contact_person: branch.U_AR_contact_person || '',
          U_HBT_MunMed: branch.U_HBT_MunMed || null,
          U_AR_Email: branch.U_AR_Email || null
        };
        const branchInsertQuery = `
          INSERT INTO client_branches (
            client_id, 
            ship_to_code,
            branch_name, 
            address, 
            city, 
            state,
            country,
            zip_code,
            phone,
            contact_person,
            is_default,
            municipality_code,
            mail
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        
        const client = await pool.connect();
        try {
          await client.query(branchInsertQuery, [
            clientId,
            normalizedBranch.Address || 'PRINCIPAL',
            normalizedBranch.Address || 'Sucursal Principal',
            normalizedBranch.Street || '',
            normalizedBranch.City || '',
            normalizedBranch.State || '',
            normalizedBranch.Country || 'CO',
            normalizedBranch.ZipCode || '',
            normalizedBranch.U_AR_Phone || '',
            normalizedBranch.U_AR_contact_person || '',
            normalizedBranch.Address === 'PRINCIPAL' || branches.length === 1,
            normalizedBranch.U_HBT_MunMed || null,
            normalizedBranch.U_AR_Email || null
          ]);
          
          this.logger.debug('Sucursal creada para cliente CI', {
            clientId,
            shipToCode: normalizedBranch.Address,
            branchName: normalizedBranch.Address
          });
        } finally {
          client.release();
        }
      }
    } catch (error) {
      this.logger.error('Error al sincronizar sucursales para cliente CI', {
        cardCode,
        clientId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Obtiene las sucursales de un cliente consultando directamente la tabla CRD1 via Service Layer
   * @param {string} cardCode - Código del cliente en SAP
   * @returns {Promise<Array>} Lista de sucursales desde CRD1
   */
  async getClientBranchesFromCRD1(cardCode) {
    try {
      // Validación de entrada
      if (!cardCode) {
        this.logger.error('CardCode es requerido para obtener sucursales');
        return [];
      }

      this.logger.info('=== BÚSQUEDA DETALLADA DE SUCURSALES ===', { cardCode });
      
      // MÉTODO 1: BusinessPartners con expand BPAddresses
      this.logger.debug('Intentando método 1: BusinessPartners con expand', { cardCode });
      
      try {
        const expandEndpoint = `BusinessPartners('${cardCode}')?$expand=BPAddresses`;
        const expandResult = await this.request('GET', expandEndpoint);
        
        if (expandResult && expandResult.BPAddresses && expandResult.BPAddresses.length > 0) {
          this.logger.info(`✅ Método 1 exitoso: ${expandResult.BPAddresses.length} direcciones encontradas`, { 
            cardCode,
            direcciones: expandResult.BPAddresses.map(addr => ({
              name: addr.AddressName,
              type: addr.AddressType,
              city: addr.City,
              street: addr.Street
            }))
          });
          
          // Filtrar direcciones Ship To, si no hay, usar Bill To
          let filteredAddresses = expandResult.BPAddresses.filter(addr => 
            addr.AddressType === 'bo_ShipTo'
          );
          
          if (filteredAddresses.length === 0) {
            this.logger.info('No hay Ship To, usando Bill To como alternativa', { cardCode });
            filteredAddresses = expandResult.BPAddresses.filter(addr => 
              addr.AddressType === 'bo_BillTo'
            );
          }
          
          if (filteredAddresses.length > 0) {
            const mappedBranches = filteredAddresses.map(address => ({
              Address: address.AddressName,
              Street: address.Street || '',
              City: address.City || '',
              State: address.State || '',
              Country: address.Country || 'CO',
              ZipCode: address.ZipCode || '',
              U_AR_Phone: address.U_AR_Phone || '',
              U_AR_contact_person: address.U_AR_contact_person || '',
              U_HBT_MunMed: address.U_HBT_MunMed || null,
              U_AR_Email: address.U_AR_Email || ''
            }));
            this.logger.info(`Método 1 retorna ${mappedBranches.length} sucursales mapeadas`, { cardCode });
            return mappedBranches;
          }
        }
      } catch (expandError) {
        this.logger.warn('Método 1 falló', { cardCode, error: expandError.message });
      }

      // MÉTODO 2: Consulta separada de BPAddresses
      this.logger.debug('Intentando método 2: BPAddresses separado', { cardCode });
      
      try {
        // Verificar que el cliente existe
        const clientEndpoint = `BusinessPartners('${cardCode}')`;
        const clientResult = await this.request('GET', clientEndpoint);
        
        if (!clientResult) {
          this.logger.warn('Cliente no encontrado en SAP', { cardCode });
          return [];
        }
        
        this.logger.debug('Cliente encontrado, obteniendo direcciones', { 
          cardCode, 
          cardName: clientResult.CardName 
        });
        
        // Obtener direcciones
        const addressesEndpoint = `BusinessPartners('${cardCode}')/BPAddresses`;
        const addressesResult = await this.request('GET', addressesEndpoint);
        
        if (!addressesResult || !addressesResult.BPAddresses) {
          this.logger.warn('No se obtuvieron direcciones o formato inesperado', { cardCode });
          return [];
        }
        // Filtrar solo las direcciones de tipo "Ship To" (bo_ShipTo)
        const shipToAddresses = addressesResult.BPAddresses.filter(address => 
          address.AddressType === 'bo_ShipTo'
        );
        this.logger.info(`Se encontraron ${shipToAddresses.length} direcciones Ship To en método 2`, { cardCode });

        // Si no hay Ship To, buscar Bill To como alternativa
        let filteredAddresses = shipToAddresses;
        if (filteredAddresses.length === 0) {
          this.logger.info('No hay Ship To, usando Bill To como alternativa en método 2', { cardCode });
          filteredAddresses = addressesResult.BPAddresses.filter(address => 
            address.AddressType === 'bo_BillTo'
          );
        }

        if (filteredAddresses.length > 0) {
          const mappedBranches = filteredAddresses.map(address => ({
            Address: address.AddressName,
            Street: address.Street || '',
            City: address.City || '',
            State: address.State || '',
            Country: address.Country || 'CO',
            ZipCode: address.ZipCode || '',
            U_AR_Phone: address.U_AR_Phone || '',
            U_AR_contact_person: address.U_AR_contact_person || '',
            U_HBT_MunMed: address.U_HBT_MunMed || null,
            U_AR_Email: address.U_AR_Email || ''
          }));
          
          this.logger.info(`Método 2 retorna ${mappedBranches.length} sucursales mapeadas`, { cardCode });
          return mappedBranches;
        }
      } catch (separateError) {
        this.logger.warn('Método 2 falló', { cardCode, error: separateError.message });
      }

      // MÉTODO 3: SQLQueries directo a CRD1
      this.logger.debug('Intentando método 3: SQLQuery directo a CRD1', { cardCode });
      
      try {
        const sqlQueryCode = `TEMP_BRANCHES_${cardCode.replace(/[^A-Za-z0-9]/g, '')}_${Date.now()}`;
        
        // Consulta SQL directa a CRD1
        const sqlText = `
          SELECT 
            T0.CardCode,
            T0.Address,
            T0.Street,
            T0.City,
            T0.State,
            T0.Country,
            T0.ZipCode,
            T0.AdresType,
            ISNULL(T0.U_AR_Phone, '') as U_AR_Phone,
            ISNULL(T0.U_AR_contact_person, '') as U_AR_contact_person,
            T0.U_HBT_MunMed,
            ISNULL(T0.U_AR_Email, '') as U_AR_Email
          FROM CRD1 T0 
          WHERE T0.CardCode = '${cardCode}'
          ORDER BY T0.AdresType, T0.Address
        `;
        
        // Crear SQLQuery temporal
        const createPayload = {
          SqlCode: sqlQueryCode,
          SqlName: `GetBranches_${cardCode}`,
          SqlText: sqlText
        };
        
        await this.request('POST', 'SQLQueries', createPayload);
        this.logger.debug('SQLQuery temporal creada', { sqlQueryCode, cardCode });
        
        // Ejecutar SQLQuery
        const sqlResult = await this.request('GET', `SQLQueries('${sqlQueryCode}')/List`);
        
        // Limpiar SQLQuery temporal
        try {
          await this.request('DELETE', `SQLQueries('${sqlQueryCode}')`);
          this.logger.debug('SQLQuery temporal eliminada', { sqlQueryCode });
        } catch (deleteError) {
          this.logger.warn('No se pudo eliminar SQLQuery temporal', { sqlQueryCode });
        }
        
        if (sqlResult && sqlResult.value && sqlResult.value.length > 0) {
          this.logger.info(`✅ Método 3 exitoso: ${sqlResult.value.length} registros desde CRD1`, { 
            cardCode,
            registros: sqlResult.value.map(row => ({
              address: row.Address,
              type: row.AdresType,
              city: row.City,
              street: row.Street
            }))
          });
          
          // Filtrar por tipo: S = Ship To, B = Bill To
          let filteredRecords = sqlResult.value.filter(row => row.AdresType === 'S');
          
          if (filteredRecords.length === 0) {
            this.logger.info('No hay registros Ship To (S), usando Bill To (B)', { cardCode });
            filteredRecords = sqlResult.value.filter(row => row.AdresType === 'B');
          }
          
          if (filteredRecords.length > 0) {
            const mappedBranches = filteredRecords.map(record => ({
              Address: record.Address,
              Street: record.Street || '',
              City: record.City || '',
              State: record.State || '',
              Country: record.Country || 'CO',
              ZipCode: record.ZipCode || '',
              U_AR_Phone: record.U_AR_Phone || '',
              U_AR_contact_person: record.U_AR_contact_person || '',
              U_HBT_MunMed: record.U_HBT_MunMed || null,
              U_AR_Email: record.U_AR_Email || ''
            }));
            this.logger.info(`Método 3 retorna ${mappedBranches.length} sucursales mapeadas`, { cardCode });
            return mappedBranches;
          }
        }
      } catch (sqlError) {
        this.logger.warn('Método 3 falló', { cardCode, error: sqlError.message });
      }

      // MÉTODO 4: Verificación de existencia y listado de clientes CI
      this.logger.debug('Método 4: Verificando existencia del cliente', { cardCode });
      
      try {
        // Buscar entre todos los clientes que empiecen con CI
        const searchEndpoint = `BusinessPartners?$filter=startswith(CardCode,'CI')&$select=CardCode,CardName,CardType&$top=100`;
        const searchResult = await this.request('GET', searchEndpoint);
        
        if (searchResult && searchResult.value) {
          const foundClient = searchResult.value.find(bp => bp.CardCode === cardCode);
          
          if (foundClient) {
            this.logger.info('✅ Cliente encontrado en listado CI', { 
              cardCode, 
              cardName: foundClient.CardName,
              cardType: foundClient.CardType
            });
          } else {
            this.logger.warn('❌ Cliente NO encontrado en listado CI', { 
              cardCode,
              clientesEncontrados: searchResult.value.length,
              algunosClientes: searchResult.value.slice(0, 5).map(bp => bp.CardCode)
            });
          }
        }
      } catch (verifyError) {
        this.logger.warn('Método 4 falló', { cardCode, error: verifyError.message });
      }

      this.logger.warn(`⚠️ NINGÚN MÉTODO ENCONTRÓ SUCURSALES para ${cardCode}`, { cardCode });
      return [];

    } catch (error) {
      this.logger.error('Error general en getClientBranchesFromCRD1', {
        cardCode,
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }
  /**
   * Obtiene clientes del grupo Institucional de SAP que no estén ya en la plataforma
   * @returns {Promise<Array>} Lista de clientes institucionales
   */
  async getInstitutionalClients() {
    try {
      this.logger.info('Obteniendo clientes del grupo Institucional desde SAP');
      
      // Código de grupo para clientes institucionales
      const institutionalGroupCode = process.env.SAP_INSTITUTIONAL_GROUP_CODE || 103; // Cambiar a tu código real
      
      // Endpoint para obtener clientes del grupo Institucional
      const endpoint = `BusinessPartners?$filter=GroupCode eq ${institutionalGroupCode} and CardType eq 'C'`;
      
      const result = await this.request('GET', endpoint);
      
      if (!result || !result.value) {
        this.logger.warn('No se obtuvieron resultados o formato inesperado');
        return [];
      }
      
      this.logger.info(`Se encontraron ${result.value.length} clientes institucionales en SAP`);
      return result.value;
    } catch (error) {
      this.logger.error('Error al obtener clientes institucionales', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  

  /**
   * Obtiene las sucursales de un cliente desde SAP
   * @param {string} cardCode - Código del cliente en SAP
   * @returns {Promise<Array>} Lista de sucursales
   */
  async getClientBranches(cardCode) {
    try {
      this.logger.debug('Obteniendo sucursales para cliente', { cardCode });
      
      // Usar el endpoint correcto para obtener el Business Partner con todas sus direcciones
      const endpoint = `BusinessPartners('${cardCode}')?$select=CardCode,CardName`;
      
      const result = await this.request('GET', endpoint);
      
      // Para obtener las direcciones, necesitamos hacer una consulta separada
      const addressesEndpoint = `BusinessPartners('${cardCode}')/BPAddresses`;
      let addressesResult;

      try {
        addressesResult = await this.request('GET', addressesEndpoint);
      } catch (addressError) {
        this.logger.warn('No se pudieron obtener direcciones para el cliente', { 
          cardCode, 
          error: addressError.message 
        });
        return [];
      }

      if (!addressesResult || !addressesResult.BPAddresses) {
        this.logger.warn('No se obtuvieron direcciones para el cliente', { cardCode });
        return [];
      }

      // Filtrar solo las direcciones de tipo "Ship To" (bo_ShipTo)
      const shipToAddresses = addressesResult.BPAddresses.filter(address => 
        address.AddressType === 'bo_ShipTo'
      );
      
      this.logger.info(`Se encontraron ${shipToAddresses.length} sucursales para el cliente ${cardCode}`);
      // Mapear las direcciones con el campo adicional U_HBT_MunMed
      // Mapear las direcciones con todos los campos requeridos
      const mappedAddresses = shipToAddresses.map(address => ({
        Address: address.AddressName,
        Street: address.Street,
        City: address.City,
        State: address.State,
        Country: address.Country,
        ZipCode: address.ZipCode,
        U_AR_Phone: address.U_AR_Phone || '',
        U_AR_contact_person: address.U_AR_contact_person || '',
        U_HBT_MunMed: address.U_HBT_MunMed,
        U_AR_Email: address.U_AR_Email || ''
      }));

      return mappedAddresses;
    } catch (error) {
      this.logger.error('Error al obtener sucursales del cliente', {
        cardCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Sincroniza los clientes del grupo Institucional y sus sucursales
   * @returns {Promise<Object>} Estadísticas de la sincronización
   */
  async syncInstitutionalClients() {
    const stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0,
      branches: {
        total: 0,
        created: 0,
        updated: 0,
        errors: 0
      }
    };

    try {
      this.logger.info('Iniciando sincronización de clientes institucionales');
      
      // Obtener clientes institucionales de SAP
      const sapClients = await this.getInstitutionalClients();
      stats.total = sapClients.length;
      
      if (sapClients.length === 0) {
        return stats;
      }
      
      // Para cada cliente, verificar si existe en la plataforma
      for (const sapClient of sapClients) {
        try {
          // Buscar si el cliente ya existe por CardCode
          const query = 'SELECT client_id, user_id FROM client_profiles WHERE cardcode_sap = $1';
          const { rows } = await pool.query(query, [sapClient.CardCode]);
          
          let clientId, userId;
          
          if (rows.length === 0) {
            // Cliente no existe, crear usuario y perfil
            const taxInfo = this.processFederalTaxID(sapClient.FederalTaxID);
            
            // Crear un correo electrónico único basado en el CardCode
            const email = `${sapClient.CardCode.toLowerCase()}@institucional.artesa.com`.replace(/\s+/g, '');
            
            // Crear un nombre de usuario basado en CardName
            let username = sapClient.CardName;
            if (username.length > 50) {
              username = username.substring(0, 50);
            }
            
            // Generar contraseña aleatoria
            const bcrypt = require('bcrypt');
            const crypto = require('crypto');
            const randomPassword = crypto.randomBytes(10).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            // Transacción para crear usuario y perfil
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              
              // Crear usuario
              const userResult = await client.query(
                'INSERT INTO users (name, mail, password, rol_id, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [username, email, hashedPassword, 2, true] // rol_id 2 = Usuario regular, ya activo
              );
              
              userId = userResult.rows[0].id;
              
              // Crear perfil de cliente
              const profileResult = await client.query(
                `INSERT INTO client_profiles 
                (user_id, company_name, contact_name, contact_phone, contact_email, 
                address, city, country, tax_id, nit_number, verification_digit, 
                cardcode_sap, clientprofilecode_sap, sap_lead_synced) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
                RETURNING client_id`,
                [
                  userId,
                  sapClient.CardName,
                  sapClient.ContactPerson || sapClient.CardName,
                  sapClient.Phone1 || '',
                  sapClient.EmailAddress || email,
                  sapClient.Address || '',
                  sapClient.City || '',
                  sapClient.Country || 'Colombia',
                  taxInfo.tax_id || '',
                  taxInfo.nit_number || '',
                  taxInfo.verification_digit || '',
                  sapClient.CardCode,
                  `CI${taxInfo.nit_number || ''}`,
                  true // ya sincronizado
                ]
              );
              
              clientId = profileResult.rows[0].client_id;
              
              await client.query('COMMIT');
              stats.created++;
              
              this.logger.info('Cliente institucional creado en la plataforma', {
                cardCode: sapClient.CardCode,
                userId,
                clientId
              });
            } catch (txError) {
              await client.query('ROLLBACK');
              throw txError;
            } finally {
              client.release();
            }
          } else {
            // Cliente ya existe, actualizar información
            clientId = rows[0].client_id;
            userId = rows[0].user_id;
            
            const taxInfo = this.processFederalTaxID(sapClient.FederalTaxID);
            
            await pool.query(
              `UPDATE client_profiles 
              SET company_name = $1, 
                  contact_phone = $2, 
                  contact_email = $3, 
                  address = $4,
                  city = $5,
                  country = $6,
                  tax_id = $7,
                  nit_number = $8,
                  verification_digit = $9,
                  updated_at = CURRENT_TIMESTAMP
              WHERE client_id = $10`,
              [
                sapClient.CardName,
                sapClient.Phone1 || '',
                sapClient.EmailAddress || '',
                sapClient.Address || '',
                sapClient.City || '',
                sapClient.Country || 'Colombia',
                taxInfo.tax_id || '',
                taxInfo.nit_number || '',
                taxInfo.verification_digit || '',
                clientId
              ]
            );
            
            stats.updated++;
            
            this.logger.info('Cliente institucional actualizado en la plataforma', {
              cardCode: sapClient.CardCode,
              clientId
            });
          }
          
          // Sincronizar sucursales
          await this.syncClientBranches(sapClient.CardCode, clientId, stats.branches);
          
        } catch (clientError) {
          stats.errors++;
          this.logger.error('Error al sincronizar cliente institucional', {
            cardCode: sapClient.CardCode,
            error: clientError.message,
            stack: clientError.stack
          });
        }
      }
      
      return stats;
    } catch (error) {
      this.logger.error('Error en sincronización de clientes institucionales', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sincroniza las sucursales de un cliente
   * @param {string} cardCode - Código del cliente en SAP
   * @param {number} clientId - ID del cliente en la plataforma
   * @param {Object} stats - Objeto para actualizar estadísticas
   */
  async syncClientBranches(cardCode, clientId, stats, forceUpdate = false) {
    try {
      // Obtener sucursales del cliente desde SAP
      const branches = await this.getClientBranches(cardCode);
      stats.total += branches.length;
      
      for (const branch of branches) {
        // Validar que tenemos los campos mínimos requeridos
        if (!branch.AddressName && !branch.Address) {
          this.logger.warn('Sucursal omitida por falta de AddressName/Address', {
            clientId,
            cardCode,
            branch: JSON.stringify(branch, null, 2)
          });
          continue;
        }

        // Normalizar los campos para evitar valores nulos
        const normalizedBranch = {
          AddressName: branch.AddressName || branch.Address || 'PRINCIPAL',
          Address: branch.Address || branch.AddressName || 'PRINCIPAL',
          Street: branch.Street || '',
          City: branch.City || '',
          State: branch.State || '',
          Country: branch.Country || 'CO',
          ZipCode: branch.ZipCode || '',
          U_AR_Phone: branch.U_AR_Phone || '',
          U_AR_contact_person: branch.U_AR_contact_person || '',
          U_HBT_MunMed: branch.U_HBT_MunMed || null,
          U_AR_Email: branch.U_AR_Email || null
        };

        this.logger.debug('Procesando sucursal normalizada', {
          clientId,
          cardCode,
          original: branch,
          normalized: normalizedBranch
        });
        try {
          // Log detallado de inicio
          this.logger.info('Iniciando sincronización de sucursales', {
            cardCode,
            clientId,
            forceUpdate
          });
          // Verificar si la sucursal ya existe
          const query = 'SELECT branch_id FROM client_branches WHERE client_id = $1 AND ship_to_code = $2';
          const { rows } = await pool.query(query, [clientId, normalizedBranch.AddressName]);
          
          if (rows.length === 0 || forceUpdate) {
            if (rows.length === 0) {
              // Crear nueva sucursal
              await pool.query(
                `INSERT INTO client_branches 
                (client_id, ship_to_code, branch_name, address, city, state, country, zip_code, phone, contact_person, is_default, municipality_code, mail)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                  clientId,
                  normalizedBranch.AddressName,
                  normalizedBranch.AddressName,
                  normalizedBranch.Street,
                  normalizedBranch.City,
                  normalizedBranch.State,
                  normalizedBranch.Country,
                  normalizedBranch.ZipCode,
                  normalizedBranch.U_AR_Phone,
                  normalizedBranch.U_AR_contact_person,
                  normalizedBranch.AddressName === 'PRINCIPAL' || branches.length === 1,
                  normalizedBranch.U_HBT_MunMed,
                  normalizedBranch.U_AR_Email
                ]
              );
              
              stats.created++;
              
              this.logger.info('Sucursal creada para cliente', {
                clientId,
                cardCode,
                shipToCode: normalizedBranch.AddressName,
                branchName: normalizedBranch.AddressName
              });
            } else if (forceUpdate) {
              // Actualizar sucursal existente cuando forceUpdate está activo
              await pool.query(
                `UPDATE client_branches 
                SET branch_name = $1, 
                    address = $2, 
                    city = $3, 
                    state = $4, 
                    country = $5, 
                    zip_code = $6,
                    phone = $7,
                    contact_person = $8,
                    municipality_code = $9,
                    mail = $10,
                    updated_at = CURRENT_TIMESTAMP
                WHERE branch_id = $11`,
                [
                  normalizedBranch.AddressName,
                  normalizedBranch.Street,
                  normalizedBranch.City,
                  normalizedBranch.State,
                  normalizedBranch.Country,
                  normalizedBranch.ZipCode,
                  normalizedBranch.U_AR_Phone,
                  normalizedBranch.U_AR_contact_person,
                  normalizedBranch.U_HBT_MunMed,
                  normalizedBranch.U_AR_Email,
                  rows[0].branch_id
                ]
              );
              
              stats.updated++;
              
              this.logger.info('Sucursal actualizada por forceUpdate', {
                clientId,
                cardCode,
                branchId: rows[0].branch_id,
                shipToCode: branch.AddressName
              });
            }
          } else {
            // Sucursal ya existe y no hay forceUpdate
            this.logger.debug('Sucursal ya existe, omitiendo', {
              clientId,
              cardCode,
              shipToCode: branch.AddressName
            });
          }
        } catch (branchError) {
          stats.errors++;
          this.logger.error('Error al sincronizar sucursal', {
            clientId,
            shipToCode: branch.AddressName,
            error: branchError.message
          });
        }
      }
    } catch (error) {
      this.logger.error('Error al sincronizar sucursales del cliente', {
        cardCode,
        clientId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Obtiene un Business Partner por su código SAP
   * @param {string} sapCode - Código SAP del Business Partner
   * @returns {Promise<Object|null>} - Business Partner o null si no existe
   */
  async getBusinessPartnerBySapCode(sapCode) {
    try {
      if (!sapCode) {
        throw new Error('Código SAP es requerido');
      }

      this.logger.debug('Buscando Business Partner por código SAP', { sapCode });

      // Asegurar autenticación
      if (!this.sessionId) {
        await this.login();
      }

      const result = await this.request('GET', `BusinessPartners('${sapCode}')`);
      
      if (result) {
        this.logger.debug('Business Partner encontrado', {
          cardCode: result.CardCode,
          cardName: result.CardName,
          cardType: result.CardType
        });
        return result;
      }

      return null;
    } catch (error) {
      if (error.response?.status === 404 || (error.response?.data?.error?.code === '-2028')) {
        this.logger.debug('Business Partner no encontrado en SAP', { 
          sapCode,
          errorCode: error.response?.data?.error?.code,
          errorMessage: error.response?.data?.error?.message
        });
        return null;
      }
      
      this.logger.error('Error al buscar Business Partner por código SAP', {
        sapCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Crea contactos de un cliente en SAP (tabla OCPR)
   * @param {string} cardCode - Código del Business Partner en SAP
   * @param {number} clientId - ID del cliente en la base de datos local
   */
  async createContactPersonsInSAP(cardCode, clientId) {
    try {
      this.logger.debug('Creando contactos en SAP para Business Partner', {
        cardCode,
        clientId
      });
      
      // Obtener contactos de la base de datos local
      const contactsQuery = `
        SELECT contact_id, name, position, phone, email, is_primary
        FROM client_contacts
        WHERE client_id = $1
        ORDER BY is_primary DESC, contact_id ASC
      `;
      
      const { rows: contacts } = await pool.query(contactsQuery, [clientId]);
      
      if (!contacts || contacts.length === 0) {
        this.logger.warn('No se encontraron contactos para sincronizar', { clientId });
        return;
      }
      
      // Crear cada contacto en SAP
      for (const contact of contacts) {
        const contactData = {
          CardCode: cardCode,
          Name: contact.name || '',
          Position: contact.position || '',
          Phone1: contact.phone ? contact.phone.replace(/\D/g, '').substring(0, 20) : '',
          E_Mail: contact.email || '',
          Active: 'Y'
        };
        
        try {
          const result = await this.request('POST', 'ContactEmployees', contactData);
          
          this.logger.info('Contacto creado exitosamente en SAP', {
            cardCode,
            contactName: contact.name,
            contactId: contact.contact_id,
            isPrimary: contact.is_primary
          });
        } catch (contactCreateError) {
          this.logger.error('Error al crear contacto individual en SAP', {
            error: contactCreateError.message,
            cardCode,
            contactName: contact.name,
            contactId: contact.contact_id
          });
        }
      }
    } catch (error) {
      this.logger.error('Error general al crear contactos en SAP', {
        error: error.message,
        stack: error.stack,
        cardCode,
        clientId
      });
      throw error;
    }
  }
  /**
   * Busca un BusinessPartner existente por múltiples criterios
   * @param {Object} clientProfile - Datos del perfil del cliente
   * @param {string} expectedCardCode - CardCode esperado
   * @returns {Promise<Object|null>} BusinessPartner encontrado o null
   */
  async findExistingBusinessPartner(clientProfile, expectedCardCode) {
    // Criterio 1: Por cardcode_sap guardado en BD
    if (clientProfile.cardcode_sap) {
      try {
        const byStoredCardCode = await this.getBusinessPartnerBySapCode(clientProfile.cardcode_sap);
        if (byStoredCardCode) {
          byStoredCardCode._foundBy = 'stored_cardcode';
          return byStoredCardCode;
        }
      } catch (error) {
        this.logger.warn('CardCode almacenado no existe en SAP', {
          stored: clientProfile.cardcode_sap,
          error: error.message
        });
      }
    }

    // Criterio 2: Por CardCode generado (CI + NIT)
    try {
      const byGeneratedCardCode = await this.getBusinessPartnerBySapCode(expectedCardCode);
      if (byGeneratedCardCode) {
        byGeneratedCardCode._foundBy = 'generated_cardcode';
        return byGeneratedCardCode;
      }
    } catch (error) {
      this.logger.debug('CardCode generado no existe en SAP', {
        generated: expectedCardCode,
        error: error.message
      });
    }

    // Criterio 3: Por código Artesa
    if (clientProfile.clientprofilecode_sap) {
      try {
        const byArtesaCode = await this.getBusinessPartnerByArtesaCode(clientProfile.clientprofilecode_sap);
        if (byArtesaCode) {
          byArtesaCode._foundBy = 'artesa_code';
          return byArtesaCode;
        }
      } catch (error) {
        this.logger.debug('Código Artesa no encontrado en SAP', {
          artesaCode: clientProfile.clientprofilecode_sap,
          error: error.message
        });
      }
    }

    // Criterio 4: Por FederalTaxID
    const federalTaxID = `${clientProfile.nit_number}-${clientProfile.verification_digit}`;
    try {
      const byTaxID = await this.getBusinessPartnerByTaxID(federalTaxID);
      if (byTaxID) {
        byTaxID._foundBy = 'federal_tax_id';
        return byTaxID;
      }
    } catch (error) {
      this.logger.debug('FederalTaxID no encontrado en SAP', {
        federalTaxID,
        error: error.message
      });
    }

    return null;
  }

  /**
   * Busca BusinessPartner por FederalTaxID
   * @param {string} federalTaxID - NIT con formato "12345678-9"
   * @returns {Promise<Object|null>} BusinessPartner encontrado o null
   */
  async getBusinessPartnerByTaxID(federalTaxID) {
    try {
      this.logger.debug('Buscando BusinessPartner por FederalTaxID', { federalTaxID });
      
      const endpoint = `BusinessPartners?$filter=FederalTaxID eq '${federalTaxID}'&$select=CardCode,CardName,CardType,FederalTaxID,Phone1,EmailAddress,Address,U_AR_ArtesaCode`;
      const result = await this.request('GET', endpoint);
      
      if (result && result.value && result.value.length > 0) {
        this.logger.info('BusinessPartner encontrado por FederalTaxID', {
          federalTaxID,
          cardCode: result.value[0].CardCode,
          cardType: result.value[0].CardType
        });
        return result.value[0];
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error al buscar BusinessPartner por FederalTaxID', {
        federalTaxID,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verifica si un NIT ya está siendo usado por otro cliente
   * @param {string} nitNumber - Número de NIT
   * @param {number} verificationDigit - Dígito de verificación
   * @param {number} currentClientId - ID del cliente actual
   * @returns {Promise<Object|null>} Cliente que usa el NIT o null
   */
  async checkExistingBusinessPartnerByNIT(nitNumber, verificationDigit, currentClientId) {
    try {
      const federalTaxID = `${nitNumber}-${verificationDigit}`;
      
      // Buscar en SAP por FederalTaxID
      const sapBP = await this.getBusinessPartnerByTaxID(federalTaxID);
      if (!sapBP) {
        return null;
      }

      // Buscar en BD local para obtener client_id asociado
      const query = `
        SELECT client_id, user_id, cardcode_sap 
        FROM client_profiles 
        WHERE nit_number = $1 AND verification_digit = $2 AND client_id != $3
      `;
      
      const { rows } = await pool.query(query, [nitNumber, verificationDigit, currentClientId]);
      
      if (rows.length > 0) {
        return {
          client_id: rows[0].client_id,
          user_id: rows[0].user_id,
          sap_card_code: sapBP.CardCode,
          stored_cardcode: rows[0].cardcode_sap
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error al verificar NIT duplicado', {
        nitNumber,
        verificationDigit,
        currentClientId,
        error: error.message
      });
      throw error;
    }
  }
}

// Exportar instancia única (singleton)
const sapClientService = new SapClientService();
module.exports = sapClientService;