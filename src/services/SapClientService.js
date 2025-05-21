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
   * Obtiene información de un Business Partner por su CardCode
   * @param {string} cardCode - Código del cliente en SAP
   * @returns {Promise<Object>} - Información del cliente en SAP
   */
  async getBusinessPartnerBySapCode(cardCode) {
    try {
      this.logger.debug('Consultando Business Partner en SAP por CardCode', { cardCode });
      
      // Construir endpoint para obtener un Business Partner específico con todos los campos relevantes
      const endpoint = `BusinessPartners('${cardCode}')?$select=CardCode,CardName,CardType,FederalTaxID,U_AR_ArtesaCode,Phone1,EmailAddress,Address,City,Country,ContactPerson`;
      
      // Realizar petición a SAP
      const data = await this.request('GET', endpoint);
      
      if (!data || !data.CardCode) {
        this.logger.warn('Business Partner no encontrado o formato inválido', { cardCode });
        return null;
      }
      
      this.logger.debug('Business Partner obtenido exitosamente', {
        cardCode,
        cardType: data.CardType,
        cardName: data.CardName
      });
      
      return data;
    } catch (error) {
      // Si el error es 404, significa que el BP no existe
      if (error.response && error.response.status === 404) {
        this.logger.warn('Business Partner no encontrado en SAP', { cardCode });
        return null;
      }
      
      this.logger.error('Error al obtener Business Partner de SAP', {
        cardCode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
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
      const endpoint = `BusinessPartners?$filter=U_AR_ArtesaCode eq '${artesaCode}'`;
      
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
      const cardCode = `CI${clientProfile.nit_number}`;

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

      // Determinar si es creación o actualización
      const isUpdate = !!clientProfile.cardcode_sap;
      const endpoint = isUpdate 
        ? `BusinessPartners('${clientProfile.cardcode_sap}')` 
        : 'BusinessPartners';
      
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
      
      // Preparar datos para SAP
      const businessPartnerData = {
        CardCode: cardCode,
        CardName: businessPartnerName,
        CardType: 'L',  // Lead - siempre L
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

      // Si no estamos ya autenticados, hacerlo
      if (!this.sessionId) {
        await this.login();
      }

      // Si es actualización, usamos PATCH, si es creación usamos POST
      const method = isUpdate ? 'PATCH' : 'POST';
      
      this.logger.info('Enviando datos a SAP B1', {
        endpoint,
        method,
        cardCode: businessPartnerData.CardCode,
        cardName: businessPartnerData.CardName,
        federalTaxID: businessPartnerData.FederalTaxID
      });

      try {
      // Realizar petición a SAP
        const result = await this.request(method, endpoint, businessPartnerData);
        
        // Si es creación exitosa, guardar el CardCode real asignado por SAP
        if (!isUpdate && result && result.CardCode) {
          resultCardCode = result.CardCode;
          
          // Actualizar el perfil del cliente con el código real de SAP y marcar como sincronizado
          await pool.query(
            `UPDATE client_profiles 
            SET cardcode_sap = $1, 
                sap_lead_synced = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE client_id = $2`,
            [resultCardCode, clientProfile.client_id]
          );
          
          this.logger.info('Perfil de cliente actualizado con CardCode real de SAP', {
            clientId: clientProfile.client_id,
            sapCardCode: resultCardCode
          });
        } else if (isUpdate) {
          // Para actualizaciones, simplemente marcar como sincronizado si aún no lo está
          await pool.query(
            `UPDATE client_profiles 
            SET sap_lead_synced = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE client_id = $1 AND sap_lead_synced = false`,
            [clientProfile.client_id]
          );
          
          this.logger.info('Perfil de cliente actualizado en SAP', {
            clientId: clientProfile.client_id,
            cardCode: clientProfile.cardcode_sap
          });
        }
        
        return {
          success: true,
          cardCode: resultCardCode,
          isNew: !isUpdate
        };
        
      } catch (error) {
        this.logger.error('Error al crear/actualizar socio de negocios Lead en SAP', {
          error: error.message,
          stack: error.stack,
          clientId: clientProfile.client_id,
          requestData: JSON.stringify(businessPartnerData)
        });

        // Reenviar el error para que se maneje en el nivel superior
        throw error;
        
        // Intentar reautenticar y reintentar una vez si el error es de autenticación
        /*if (requestError.response && requestError.response.status === 401) {
          this.logger.info('Reintentando después de reautenticar', { cardCode });
          this.sessionId = null;
          await this.login();
          
          const retryResult = await this.request(method, endpoint, businessPartnerData);
          
          let resultCardCode = clientProfile.cardcode_sap;
          if (!isUpdate && retryResult && retryResult.CardCode) {
            resultCardCode = retryResult.CardCode;
          }
          
          this.logger.info('Reintento exitoso después de reautenticar', {
            cardCode: resultCardCode,
            clientId: clientProfile.client_id
          });
          
          return {
            success: true,
            cardCode: resultCardCode,
            isNew: !isUpdate
          };
        }
        
        throw requestError;*/
      }
    } catch (error) {
      this.logger.error('Error al crear/actualizar socio de negocios Lead en SAP', {
        error: error.message,
        stack: error.stack,
        clientId: clientProfile.client_id,
        nit: clientProfile.nit_number,
        verification_digit: clientProfile.verification_digit
      });
      
      // Devolvemos un objeto con success: false en lugar de lanzar el error
      // para que el controlador pueda manejarlo mejor
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verifica si un NIT ya existe en SAP
   * @param {string} nitNumber - Número de NIT sin DV
   * @param {string} verificationDigit - Dígito de verificación
   * @returns {Promise<{exists: boolean, cardCode: string|null}>} - Resultado de la verificación
   */
  async nitExistsInSAP(nitNumber, verificationDigit) {
    try {
      this.logger.debug('Verificando si NIT existe en SAP', { 
        nitNumber, 
        verificationDigit 
      });
      
      // Construir el FederalTaxID con el formato correcto
      const federalTaxID = `${nitNumber}-${verificationDigit}`;
      
      // Construir la consulta para buscar por FederalTaxID
      const endpoint = `BusinessPartners?$filter=FederalTaxID eq '${federalTaxID}'`;
      
      // Realizar la consulta a SAP
      const result = await this.request('GET', endpoint);
      
      // Si no hay resultado o no hay valores, el NIT no existe
      if (!result || !result.value || result.value.length === 0) {
        return { exists: false, cardCode: null };
      }
      
      // El NIT existe, devolver el CardCode del primer resultado
      const cardCode = result.value[0].CardCode;
      
      this.logger.info('NIT encontrado en SAP', {
        nitNumber,
        verificationDigit,
        federalTaxID,
        cardCode
      });
      
      return { exists: true, cardCode };
    } catch (error) {
      this.logger.error('Error al verificar NIT en SAP', {
        error: error.message,
        nitNumber,
        stack: error.stack
      });
      
      // Si hay un error, asumimos que no existe (mejor ser conservador)
      return { exists: false, cardCode: null };
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
      this.logger.info('Iniciando sincronización de clientes con SAP B1');
      
      // Registrar inicio de sincronización
      const syncStartTime = new Date();
      
      // Obtener clientes que necesitan ser verificados (sap_lead_synced = true, is_active = false)
      const query = `
        SELECT cp.*, u.id as user_id, u.is_active, u.name, u.mail
        FROM client_profiles cp
        JOIN users u ON cp.user_id = u.id
        WHERE ((cp.cardcode_sap IS NOT NULL OR cp.clientprofilecode_sap IS NOT NULL) 
        AND cp.sap_lead_synced = true
        AND u.is_active = false)
      `;
      
      const { rows } = await pool.query(query);
      stats.total = rows.length;
      
      this.logger.info(`Encontrados ${rows.length} clientes para verificar`);
      
      // Para cada cliente, verificar en SAP su estado
      for (const client of rows) {
        try {
          // Buscar el cliente en SAP prioritariamente por clientprofilecode_sap 
          let sapClient = null;
          
          if (client.clientprofilecode_sap) {
            sapClient = await this.getBusinessPartnerByArtesaCode(client.clientprofilecode_sap);
          }
          
          // Si no se encontró, intentar con cardcode_sap
          if (!sapClient && client.cardcode_sap) {
            sapClient = await this.getBusinessPartnerBySapCode(client.cardcode_sap);
          }
          
          // Si no se encontró por ninguno de los dos códigos, saltar
          if (!sapClient) {
            this.logger.warn('Cliente no encontrado en SAP, saltando', { 
              clientId: client.client_id,
              cardcode_sap: client.cardcode_sap,
              clientprofilecode_sap: client.clientprofilecode_sap 
            });
            stats.skipped++;
            continue;
          }
          
          // Si ya no es Lead (CardType !== 'cLid'), activar al usuario
          if (sapClient.CardType !== 'cLid') {
            // Iniciar transacción para actualizar datos y activar usuario
            const dbClient = await pool.connect();
            try {
              await dbClient.query('BEGIN');
          
              // Procesar el FederalTaxID para extraer nit_number y verification_digit
              const taxInfo = this.processFederalTaxID(sapClient.FederalTaxID);
  
              // Actualizar todos los campos relevantes del cliente
              const updateClientQuery = `
                UPDATE client_profiles
                SET 
                  cardcode_sap = $1,
                  tax_id = $2,
                  nit_number = $3,
                  verification_digit = $4,
                  company_name = $5,
                  contact_phone = $6,
                  contact_email = $7,
                  address = $8,
                  city = $9,
                  country = $10,
                  updated_at = CURRENT_TIMESTAMP
                WHERE client_id = $11
              `;
  
              await dbClient.query(updateClientQuery, [
                sapClient.CardCode, // Actualiza el cardcode_sap con el CardCode de SAP
                taxInfo.tax_id || client.tax_id, // Actualiza el tax_id con FederalTaxID procesado
                taxInfo.nit_number || client.nit_number, // Actualiza nit_number
                taxInfo.verification_digit || client.verification_digit, // Actualiza verification_digit
                sapClient.CardName || client.company_name, // Actualiza el company_name con CardName de SAP
                sapClient.Phone1 || client.contact_phone, // Actualiza el teléfono
                sapClient.EmailAddress || client.contact_email, // Actualiza el email
                sapClient.Address || client.address, // Actualiza la dirección
                sapClient.City || client.city, // Ciudad
                sapClient.Country || client.country, // País
                client.client_id
              ]);
          
              // Activar al usuario
              await dbClient.query('UPDATE users SET is_active = true WHERE id = $1', [client.user_id]);
              
              await dbClient.query('COMMIT');
              
              this.logger.info('Cliente sincronizado y usuario activado exitosamente', {
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
              this.logger.error('Error al actualizar y activar cliente', {
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
                  contact_phone = $6,
                  contact_email = $7,
                  address = $8,
                  updated_at = CURRENT_TIMESTAMP
                WHERE client_id = $9
              `, [
                sapClient.CardCode,
                taxInfo.tax_id || client.tax_id,
                taxInfo.nit_number || client.nit_number,
                taxInfo.verification_digit || client.verification_digit,
                sapClient.CardName || client.company_name,
                sapClient.Phone1 || client.contact_phone,
                sapClient.EmailAddress || client.contact_email,
                sapClient.Address || client.address,
                client.client_id
              ]);
          
              this.logger.debug('Cliente actualizado pero sigue siendo Lead, no se activa', {
                userId: client.user_id,
                clientId: client.client_id,
                cardCode: sapClient.CardCode,
                oldTaxId: client.tax_id,
                newTaxId: taxInfo.tax_id,
                dataUpdated: true
              });
              
              stats.skipped++;
            } catch (updateLeadError) {
              this.logger.error('Error al actualizar datos de cliente Lead', {
                error: updateLeadError.message,
                clientId: client.client_id,
                userId: client.user_id
              });
              stats.errors++;
            }
          }
        } catch (clientError) {
          this.logger.error('Error al procesar cliente', {
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
      
      this.logger.info('Sincronización de clientes completada', {
        total: stats.total,
        activated: stats.activated,
        errors: stats.errors,
        skipped: stats.skipped
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Error en sincronización de clientes con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
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
   * Obtiene clientes del grupo Institucional de SAP que no estén ya en la plataforma
   * @returns {Promise<Array>} Lista de clientes institucionales
   */
  async getInstitutionalClients() {
    try {
      this.logger.info('Obteniendo clientes del grupo Institucional desde SAP');
      
      // Código de grupo para clientes institucionales
      const institutionalGroupCode = 103; // Cambiar a tu código real
      
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
      
      // Usar el endpoint para obtener direcciones de envío (ShipTo)
      const endpoint = `BusinessPartners('${cardCode}')/BPAddresses?$filter=AddressType eq 'bo_ShipTo'`;
      
      const result = await this.request('GET', endpoint);
      
      if (!result || !result.value) {
        this.logger.warn('No se obtuvieron sucursales o formato inesperado', { cardCode });
        return [];
      }
      
      this.logger.info(`Se encontraron ${result.value.length} sucursales para el cliente ${cardCode}`);
      return result.value;
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
  async syncClientBranches(cardCode, clientId, stats) {
    try {
      // Obtener sucursales del cliente desde SAP
      const branches = await this.getClientBranches(cardCode);
      stats.total += branches.length;
      
      if (branches.length === 0) {
        return;
      }
      
      for (const branch of branches) {
        try {
          // Verificar si la sucursal ya existe
          const query = 'SELECT branch_id FROM client_branches WHERE client_id = $1 AND ship_to_code = $2';
          const { rows } = await pool.query(query, [clientId, branch.AddressName]);
          
          if (rows.length === 0) {
            // Crear nueva sucursal
            await pool.query(
              `INSERT INTO client_branches 
              (client_id, ship_to_code, branch_name, address, city, state, country, zip_code, phone, contact_person, is_default) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                clientId,
                branch.AddressName,
                branch.AddressName,
                branch.Street || '',
                branch.City || '',
                branch.State || '',
                branch.Country || 'CO',
                branch.ZipCode || '',
                branch.Phone || '',
                branch.ContactPerson || '',
                branch.AddressName === 'Principal' || branch.AddressName === 'PRINCIPAL'
              ]
            );
            
            stats.created++;
            
            this.logger.debug('Sucursal creada para cliente', {
              clientId,
              shipToCode: branch.AddressName
            });
          } else {
            // Actualizar sucursal existente
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
                  updated_at = CURRENT_TIMESTAMP
              WHERE branch_id = $9`,
              [
                branch.AddressName,
                branch.Street || '',
                branch.City || '',
                branch.State || '',
                branch.Country || 'CO',
                branch.ZipCode || '',
                branch.Phone || '',
                branch.ContactPerson || '',
                rows[0].branch_id
              ]
            );
            
            stats.updated++;
            
            this.logger.debug('Sucursal actualizada para cliente', {
              clientId,
              branchId: rows[0].branch_id,
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
}

// Exportar instancia única (singleton)
const sapClientService = new SapClientService();
module.exports = sapClientService;