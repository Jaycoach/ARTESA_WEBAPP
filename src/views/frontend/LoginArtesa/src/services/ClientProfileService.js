import axios from 'axios';

class ClientProfileService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
    this.apiClient = this.createApiClient();
  }

  createApiClient() {
    const client = axios.create({
      baseURL: '/api', // Usar proxy local para evitar CORS
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });

    // Interceptor para agregar token
    client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return client;
  }

  // **MÉTODO PRINCIPAL**: Obtener perfil con cache
  async getProfile(userId = null, forceRefresh = false) {
    const cacheKey = userId ? `profile_${userId}` : 'all_profiles';
    
    if (!forceRefresh && this.isValidCache(cacheKey)) {
      console.log('📋 Usando datos en cache:', cacheKey);
      return this.getFromCache(cacheKey);
    }

    try {
      let response;
      
      if (userId) {
        console.log(`👤 Obteniendo perfil del usuario ${userId}`);
        response = await this.apiClient.get(`/client-profiles/user/${userId}`);
      } else {
        console.log('📊 Obteniendo todos los perfiles (Admin)');
        response = await this.apiClient.get('/client-profiles');
      }

      const data = response.data.data || response.data;
      
      // Almacenar en cache
      this.setCache(cacheKey, data);
      
      return data;
      
    } catch (error) {
      console.error('❌ Error obteniendo perfil:', error);
      throw this.handleError(error);
    }
  }

  // **MÉTODO CRÍTICO**: Verificar si URL de S3 está expirada
  isS3UrlExpired(s3Url) {
    if (!s3Url || !s3Url.includes('Expires=')) return true;
    
    try {
      const expiresMatch = s3Url.match(/Expires=(\d+)/);
      if (!expiresMatch) return true;
      
      const expiresTimestamp = parseInt(expiresMatch[1]) * 1000;
      const now = Date.now();
      
      console.log('🕒 Verificando expiración S3:', {
        url: s3Url.substring(0, 100) + '...',
        expires: new Date(expiresTimestamp).toISOString(),
        now: new Date(now).toISOString(),
        isExpired: now >= expiresTimestamp
      });
      
      return now >= expiresTimestamp;
    } catch (error) {
      console.warn('⚠️ Error verificando expiración:', error);
      return true;
    }
  }

  // **MÉTODO**: Validar disponibilidad de documentos
  getDocumentAvailability(client) {
    if (!client) return { cedula: false, rut: false, anexos: false };
    
    return {
      cedula: !!(client.fotocopiaCedula || client.fotocopiaCedulaUrl),
      rut: !!(client.fotocopiaRut || client.fotocopiaRutUrl),
      anexos: !!client.anexosAdicionales
    };
  }

  // **MÉTODO MEJORADO**: Obtener configuración de documento con detección de expiración
  getDocumentConfig(client, documentType) {
    const configs = {
      cedula: {
        s3Url: client.fotocopiaCedula,
        apiPath: `/client-profiles/user/${client.user_id}/file/cedula`,
        available: !!(client.fotocopiaCedula || client.fotocopiaCedulaUrl),
        expired: client.fotocopiaCedula ? this.isS3UrlExpired(client.fotocopiaCedula) : true
      },
      rut: {
        s3Url: client.fotocopiaRut,
        apiPath: `/client-profiles/user/${client.user_id}/file/rut`,
        available: !!(client.fotocopiaRut || client.fotocopiaRutUrl),
        expired: client.fotocopiaRut ? this.isS3UrlExpired(client.fotocopiaRut) : true
      },
      anexos: {
        s3Url: client.anexosAdicionales,
        apiPath: `/client-profiles/user/${client.user_id}/file/anexos`,
        available: !!client.anexosAdicionales,
        expired: client.anexosAdicionales ? this.isS3UrlExpired(client.anexosAdicionales) : true
      }
    };

    const config = configs[documentType] || null;
    
    if (config) {
      console.log(`📋 Configuración para ${documentType}:`, {
        available: config.available,
        hasS3Url: !!config.s3Url,
        expired: config.expired,
        hasApiPath: !!config.apiPath
      });
    }

    return config;
  }

  // Cache methods
  isValidCache(key) {
    const cached = this.cache.get(key);
    return cached && (Date.now() - cached.timestamp < this.cacheTimeout);
  }

  getFromCache(key) {
    return this.cache.get(key).data;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(userId = null) {
    if (userId) {
      this.cache.delete(`profile_${userId}`);
    } else {
      this.cache.clear();
    }
  }

  // Error handling
  handleError(error) {
    if (error.response?.status === 401) {
      return new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    } else if (error.response?.status === 403) {
      return new Error('No tienes permisos para realizar esta acción.');
    } else if (error.response?.status === 404) {
      return new Error('El recurso solicitado no existe.');
    }
    return error;
  }
}

export default new ClientProfileService();