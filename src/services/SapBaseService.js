require('dotenv').config();
const axios = require('axios');
const https = require('https');
const { createContextLogger } = require('../config/logger');

/**
 * Servicio base para la integración con SAP Business One Service Layer
 * Proporciona funcionalidades comunes para todos los servicios SAP
 */
class SapBaseService {
  constructor(serviceContext) {
    this.serviceContext = serviceContext || 'SapBaseService';
    this.logger = createContextLogger(this.serviceContext);
    this.sessionId = null;
    this.baseUrl = process.env.SAP_SERVICE_LAYER_URL;
    this.username = process.env.SAP_USERNAME;
    this.password = process.env.SAP_PASSWORD;
    this.companyDB = process.env.SAP_COMPANY_DB;
    this.initialized = false;
    this.lastSyncTime = null;
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Solo para certificados auto-firmados en staging
      keepAlive: true,
      maxSockets: 10
    });
    
    // Configuración base de axios
    this.axiosConfig = {
      timeout: 30000,
      httpsAgent: this.httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Artesa-API/1.0'
      }
    };

    this.logger.info('SapBaseService inicializado', {
      baseUrl: this.baseUrl,
      username: this.username,
      companyDB: this.companyDB,
      sslVerification: false // Documentar que SSL está deshabilitado
    });
  }

  /**
   * Verifica la configuración de SAP
   * @throws {Error} Si falta alguna configuración
   */
  validateConfig() {
    if (!this.baseUrl || !this.username || !this.password || !this.companyDB) {
      throw new Error('Configuración incompleta para la integración con SAP B1');
    }
  }

  /**
   * Inicializa el servicio base
   * @returns {Promise<SapBaseService>} Instancia de este servicio
   */
  async initialize() {
    if (this.initialized) return this;

    try {
      this.logger.info('Inicializando servicio de integración con SAP B1');
      
      // Verificar configuración
      this.validateConfig();
      
      // Marcar como inicializado
      this.initialized = true;
      this.logger.info('Servicio de integración con SAP B1 inicializado correctamente');
      
      // Devolver instancia para encadenamiento de métodos
      return this;
    } catch (error) {
      this.logger.error('Error al inicializar servicio de integración con SAP B1', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Autenticación con SAP Service Layer
   * @returns {Promise<string>} Session ID
   */
  async login() {
    const maxRetries = 3;
    let lastError = null;

    // Validar configuración antes de intentar autenticación
    if (!this.baseUrl || !this.username || !this.password || !this.companyDB) {
      const missingConfig = [];
      if (!this.baseUrl) missingConfig.push('SAP_SERVICE_LAYER_URL');
      if (!this.username) missingConfig.push('SAP_USERNAME');
      if (!this.password) missingConfig.push('SAP_PASSWORD');
      if (!this.companyDB) missingConfig.push('SAP_COMPANY_DB');
      
      this.logger.error('Configuración SAP incompleta', {
        missingVariables: missingConfig,
        availableConfig: {
          baseUrl: !!this.baseUrl,
          username: !!this.username,
          password: !!this.password,
          companyDB: !!this.companyDB
        }
      });
      
      throw new Error(`Configuración SAP incompleta. Variables faltantes: ${missingConfig.join(', ')}`);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Intentando login con SAP (intento ${attempt}/${maxRetries})`, {
          baseUrl: this.baseUrl,
          companyDB: this.companyDB,
          username: this.username,
          sslVerification: false,
          configValidation: {
            hasBaseUrl: !!this.baseUrl,
            hasUsername: !!this.username,
            hasPassword: !!this.password,
            hasCompanyDB: !!this.companyDB
          }
        });

        const loginData = {
          CompanyDB: this.companyDB,
          UserName: this.username,
          Password: this.password
        };

        // ✅ USAR: Configuración con SSL deshabilitado
        const response = await axios.post(
          `${this.baseUrl}/Login`,
          loginData,
          {
            ...this.axiosConfig,
            timeout: 15000
          }
        );

        if (response.data && response.data.SessionId) {
          this.sessionId = response.data.SessionId;
          this.sessionTimeout = response.data.SessionTimeout;
          this.isAuthenticated = true;
          
          this.logger.info('Autenticación exitosa con SAP B1', {
            sessionId: this.sessionId?.substring(0, 8) + '...',
            sessionTimeout: this.sessionTimeout,
            companyDB: this.companyDB
          });
          
          return true;
        } else {
          throw new Error('Respuesta de login inválida de SAP');
        }

      } catch (error) {
        lastError = error;
        
        this.logger.error('Error en autenticación con SAP B1', {
          error: error.message,
          responseStatus: error.response?.status,
          responseData: error.response?.data,
          code: error.code,
          attempt: attempt,
          configUsed: {
            baseUrl: this.baseUrl,
            companyDB: this.companyDB,
            username: this.username,
            hasPassword: !!this.password,
            sslVerification: false
          }
        });

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(`Reintentando conexión en ${delay}ms`, {
            attempt,
            maxRetries,
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error('Autenticación fallida después de todos los intentos', {
      maxRetries,
      lastError: lastError?.message,
      code: lastError?.code
    });

    throw new Error(`Error de autenticación con SAP B1: ${lastError?.message}`);
  }

  /**
   * Realiza petición a SAP Service Layer con manejo de sesión
   * @param {string} method - Método HTTP (GET, POST, PUT, PATCH, DELETE)
   * @param {string} endpoint - Endpoint relativo (sin baseUrl)
   * @param {Object} data - Datos para POST, PUT, PATCH
   * @returns {Promise<any>} Respuesta de SAP
   */
  async request(method, endpoint, data = null) {
    try {
      // Asegurar que tenemos una sesión válida
      if (!this.sessionId) {
        await this.login();
      }

      // Crear una instancia de axios con el agente HTTPS
      const axiosInstance = axios.create({
        httpsAgent: this.httpsAgent
      });

      // Preparar config para Axios
      const config = {
        method: method.toLowerCase(),
        url: `${this.baseUrl}/${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `B1SESSION=${this.sessionId}`,
          'Prefer': 'odata.maxpagesize=0'
        }
      };

      if (data && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
        config.data = data;
      }

      this.logger.debug('Enviando solicitud a SAP', { 
        url: config.url,
        method: config.method,
        hasData: !!config.data
      });

      // Realizar petición
      const response = await axiosInstance(config);
      this.logger.debug('Respuesta recibida del servicio de SAP', {
        url: config.url,
        method: config.method,
        statusCode: response.status,
        hasData: !!response.data,
        dataSize: JSON.stringify(response.data).length
      });
      // Log adicional para creaciones de BusinessPartner
      if (method.toUpperCase() === 'POST' && config.url.includes('BusinessPartners') && response.data) {
        this.logger.debug('Datos de BusinessPartner creado en SAP', {
          responseData: response.data,
          cardCode: response.data.CardCode || response.data.cardCode,
          cardName: response.data.CardName || response.data.cardName,
          fullResponseKeys: Object.keys(response.data)
        });
      }
      return response.data;
    } catch (error) {
      // Si el error es por sesión expirada (401), intentar reautenticar una vez
      if (error.response && error.response.status === 401) {
        this.logger.warn('Sesión expirada, intentando reautenticación', {
          endpoint
        });
        
        // Reiniciar sesión
        this.sessionId = null;
        await this.login();
        
        // Reintentar petición
        return this.request(method, endpoint, data);
      }
      
      this.logger.error('Error en petición a SAP B1', {
        method,
        endpoint,
        error: error.message,
        statusCode: error.response?.status,
        responseData: error.response?.data
      });
      
      throw error;
    }
  }

  /**
   * Asegurar que tenemos una sesión de autenticación válida
   * @returns {Promise<void>}
   */
  async ensureAuthentication() {
    if (!this.isAuthenticated || !this.sessionId) {
      this.logger.debug('No hay sesión activa, iniciando autenticación');
      await this.login();
    }
    return true;
  }

  /**
   * Realizar petición HTTP a SAP (alias para request)
   * @param {string} method - Método HTTP
   * @param {string} url - URL completa (incluye baseUrl)
   * @param {Object} data - Datos para la petición
   * @returns {Promise<any>} Respuesta de SAP
   */
  async makeRequest(method, url, data = null) {
    // Extraer endpoint de la URL completa
    const endpoint = url.replace(`${this.baseUrl}/`, '');
    return await this.request(method, endpoint, data);
  }

  /**
   * Cierra la sesión con SAP B1
   */
  async logout() {
    if (!this.sessionId) return;
    
    try {
      const axiosInstance = axios.create({
        httpsAgent: this.httpsAgent
      });
      
      await axiosInstance.post(`${this.baseUrl}/Logout`, {}, {
        headers: {
          'Cookie': `B1SESSION=${this.sessionId}`
        }
      });
      
      this.logger.info('Sesión cerrada exitosamente con SAP B1');
      this.sessionId = null;
    } catch (error) {
      this.logger.error('Error al cerrar sesión con SAP B1', {
        error: error.message
      });
      this.sessionId = null;
    }
  }
}

module.exports = SapBaseService;