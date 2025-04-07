require('dotenv').config();
const axios = require('axios');
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
    this.httpsAgent = new (require('https').Agent)({
      rejectUnauthorized: false,
      keepAlive: true,
      timeout: 30000, // 30 segundos
      maxSockets: 10  // Límite de conexiones simultáneas
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
    try {
      this.logger.debug('Iniciando autenticación con SAP B1 Service Layer');

      // Verificar que las credenciales estén configuradas
      if (!this.baseUrl || !this.username || !this.password || !this.companyDB) {
        const errorMsg = 'Configuración incompleta para la conexión con SAP B1';
        this.logger.error(errorMsg, {
          baseUrlConfigured: !!this.baseUrl,
          usernameConfigured: !!this.username,
          passwordConfigured: !!this.password,
          companyDBConfigured: !!this.companyDB
        });
        throw new Error(errorMsg);
      }

      this.logger.debug('Intentando conexión con SAP B1', {
        baseUrl: this.baseUrl,
        username: this.username,
        companyDB: this.companyDB
      });

      // Crear una instancia de axios con el agente HTTPS
      // Configuración mejorada para axios con timeouts y reintentos
      const axiosInstance = axios.create({
        httpsAgent: this.httpsAgent,
        timeout: 10000, // 10 segundos de timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Agregar manejo de reintento
      let retries = 0;
      const maxRetries = 3;
      let response;

      while (retries < maxRetries) {
        try {
          this.logger.debug(`Intentando login con SAP (intento ${retries + 1}/${maxRetries})`, {
            baseUrl: this.baseUrl,
            companyDB: this.companyDB,
            username: this.username
          });
          
          response = await axiosInstance.post(`${this.baseUrl}/Login`, {
            CompanyDB: this.companyDB,
            UserName: this.username,
            Password: this.password
          });
          
          // Si la solicitud es exitosa, salir del bucle
          break;
        } catch (retryError) {
          retries++;
          
          // Si hemos agotado los reintentos, lanzar el error
          if (retries >= maxRetries) {
            this.logger.error(`Autenticación fallida después de ${maxRetries} intentos`, {
              error: retryError.message,
              code: retryError.code || 'UNKNOWN'
            });
            throw retryError;
          }
          
          // Esperar antes de reintentar (backoff exponencial)
          const delay = 1000 * Math.pow(2, retries);
          this.logger.warn(`Reintentando conexión en ${delay}ms`, {
            attempt: retries,
            maxRetries,
            error: retryError.message
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (response.status === 200) {
        // Extraer sessionId de las cookies
        const cookies = response.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
          // Formato típico: B1SESSION=1234567890; path=/; HttpOnly
          const sessionCookie = cookies.find(cookie => cookie.startsWith('B1SESSION='));
          if (sessionCookie) {
            this.sessionId = sessionCookie.split(';')[0].split('=')[1];
            this.logger.info('Autenticación exitosa con SAP B1', {
              sessionId: this.sessionId ? `${this.sessionId.substring(0, 5)}...` : undefined
            });
            return this.sessionId;
          }
        }
        throw new Error('No se pudo extraer la sesión de la respuesta');
      } else {
        throw new Error(`Error de autenticación: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Error en autenticación con SAP B1', {
        error: error.message,
        stack: error.stack,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      throw new Error(`Error de autenticación con SAP B1: ${error.message}`);
    }
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