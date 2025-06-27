import axios from 'axios';

class ClientProfileService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
    this.apiClient = this.createApiClient();
  }

  // =========================================
  // CONFIGURACIÓN Y SETUP
  // =========================================

  createApiClient() {
    // Determinar la URL base según el entorno
    const getBaseURL = () => {
      // Priorizar variable de entorno específica
      if (import.meta.env.VITE_API_URL) {
        console.log('🔧 Usando VITE_API_URL:', import.meta.env.VITE_API_URL);
        return import.meta.env.VITE_API_URL;
      }
      
      // Para staging en CloudFront, usar la URL directa del backend
      if (window.location.hostname.includes('cloudfront.net') || 
          window.location.hostname.includes('d1bqegutwmfn98')) {
        console.log('🔧 Detectado CloudFront staging, usando URL directa del backend');
        return 'https://ec2-44-216-131-63.compute-1.amazonaws.com';
      }
      
      // Para desarrollo local
      if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
        return 'https://ec2-44-216-131-63.compute-1.amazonaws.com';
      }
      
      // Fallback para proxy
      return '';
    };

    const baseURL = getBaseURL();
    const fullURL = baseURL ? `${baseURL}/api` : '/api';

    console.log('🔧 Configurando API Client con URL:', fullURL);

    // Debug de configuración
    console.log('🔍 Debug configuración API:', {
      mode: import.meta.env.MODE,
      isDev: import.meta.env.DEV,
      apiUrl: import.meta.env.VITE_API_URL,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
      baseURL,
      fullURL
    });

    const client = axios.create({
      baseURL: fullURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': '69420',
        'Bypass-Tunnel-Reminder': 'true'
      },
      withCredentials: false // Cambiar a false para evitar problemas CORS
    });

    // Interceptor para agregar token
    client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log(`📡 Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    });

    // NUEVO: Interceptor de respuesta para validar Content-Type
    client.interceptors.response.use(
      (response) => {
        const contentType = response.headers['content-type'] || '';
        
        // Verificar que la respuesta sea JSON válido
        if (!contentType.includes('application/json')) {
          console.error('❌ Respuesta no es JSON:', {
            url: response.config.url,
            contentType,
            status: response.status,
            data: typeof response.data === 'string' ? response.data.substring(0, 200) + '...' : response.data
          });
          throw new Error('El servidor devolvió una respuesta inválida (no JSON)');
        }
        
        console.log(`✅ Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('❌ API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Validar que la respuesta sea JSON válido
   */
  validateJsonResponse(response) {
    const contentType = response.headers['content-type'] || '';
    
    // Verificar que sea JSON
    if (!contentType.includes('application/json')) {
      console.error('❌ Respuesta inválida - no es JSON:', {
        contentType,
        status: response.status,
        url: response.config?.url,
        responseData: typeof response.data === 'string' ? response.data.substring(0, 200) + '...' : 'No string'
      });
      
      // Si recibimos HTML, probablemente hay un problema de routing
      if (contentType.includes('text/html') || (typeof response.data === 'string' && response.data.includes('<!doctype html>'))) {
        throw new Error('Error de configuración: El servidor está devolviendo HTML en lugar de JSON. Posible problema de routing o CORS.');
      }
      
      throw new Error(`El servidor devolvió ${contentType} en lugar de JSON`);
    }
    
    // Verificar que no sea HTML disfrazado
    if (typeof response.data === 'string' && response.data.trim().startsWith('<!')) {
      console.error('❌ Respuesta HTML detectada en lugar de JSON');
      throw new Error('El servidor devolvió HTML en lugar de datos JSON. Revisa la configuración del proxy o la URL del API.');
    }
    
    return response;
  }

  // =========================================
  // MÉTODOS PRINCIPALES DE PERFIL
  // =========================================

  /**
   * Obtener perfil con cache
   */
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
      this.validateJsonResponse(response);
    } else {
      console.log('📊 Obteniendo todos los perfiles (Admin)');
      response = await this.apiClient.get('/client-profiles');
      this.validateJsonResponse(response);
    }

    // Verificar estructura de respuesta antes de procesar
    console.log('📥 Respuesta recibida:', {
      status: response.status,
      contentType: response.headers['content-type'],
      dataType: typeof response.data,
      hasData: !!response.data?.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    });

      const data = response.data.data || response.data;
      
      // Almacenar en cache
      this.setCache(cacheKey, data);
      
      return data;
      
    } catch (error) {
      console.error('❌ Error obteniendo perfil:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Guardar o actualizar perfil
   */
  async saveProfile(formData, userId, existingProfile = null) {
    try {
      const formDataToSend = this.prepareFormDataForSubmit(formData, userId, existingProfile);
      
      const endpoint = existingProfile 
        ? `/client-profiles/user/${userId}` 
        : '/client-profiles';
      const method = existingProfile ? 'put' : 'post';

      console.log(`📡 ${method.toUpperCase()} ${endpoint}`);

      const response = await this.apiClient({
        method,
        url: endpoint,
        data: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const savedData = response.data?.data || response.data;
      
      // Limpiar cache para forzar actualización
      this.clearCache(userId);
      
      console.log("✅ Perfil guardado exitosamente:", savedData);
      return savedData;

    } catch (error) {
      console.error("❌ Error guardando perfil:", error);
      throw this.handleError(error);
    }
  }

  // =========================================
  // MÉTODOS DE MAPEO Y TRANSFORMACIÓN DE DATOS
  // =========================================

  /**
   * Mapear datos del API al formato del formulario
   */
  mapApiDataToForm(profileData, userContext = null) {
    if (!profileData) return {};

    console.log("🔄 Mapeando datos del API:", profileData);

    // Mapeo base con todos los campos de la nueva estructura
    const formData = {
      // Información básica principal
      nombre: profileData.nombre || profileData.user_name || userContext?.nombre || userContext?.name || '',
      direccion: profileData.direccion || profileData.address || '',
      ciudad: profileData.ciudad || profileData.city || '',
      pais: profileData.pais || profileData.country || 'Colombia',
      telefono: profileData.telefono || profileData.phone || '',
      email: profileData.email || userContext?.email || userContext?.mail || '',
      
      // Información empresarial
      razonSocial: profileData.razonSocial || profileData.business_name || '',
      nit: profileData.nit_number || profileData.nit || '',
      digitoVerificacion: profileData.verification_digit?.toString() || '',
      
      // Valores por defecto
      tipoDocumento: 'CC',
      numeroDocumento: '',
      tamanoEmpresa: 'Microempresa',
      tipoCuenta: 'Ahorros',
      
      // Campos adicionales inicializados
      representanteLegal: '',
      actividadComercial: '',
      sectorEconomico: '',
      ingresosMensuales: '',
      patrimonio: '',
      entidadBancaria: '',
      numeroCuenta: '',
      nombreContacto: '',
      cargoContacto: '',
      telefonoContacto: '',
      emailContacto: ''
    };

    console.log("📋 Datos base mapeados:", formData);

    // Procesar contactos si existen
    if (profileData.contacts && Array.isArray(profileData.contacts)) {
      console.log("👥 Procesando contactos:", profileData.contacts);
      
      // Contacto principal
      const primaryContact = profileData.contacts.find(c => c.is_primary) || profileData.contacts[0];
      if (primaryContact) {
        formData.nombreContacto = primaryContact.name || '';
        formData.cargoContacto = primaryContact.position || '';
        formData.telefonoContacto = primaryContact.phone || '';
        formData.emailContacto = primaryContact.email || '';
        console.log("✅ Contacto principal mapeado:", primaryContact);
      }
    }

    // Procesar información adicional de múltiples fuentes
    const additionalSources = [
      profileData.notes,
      profileData.extraInfo,
      profileData.additionalInfo
    ];

    additionalSources.forEach((source, index) => {
      if (!source) return;
      
      let additionalData = {};
      
      try {
        // Si es string, intentar parsear como JSON
        if (typeof source === 'string') {
          additionalData = JSON.parse(source);
          console.log(`📝 Datos adicionales fuente ${index + 1} (JSON):`, additionalData);
        } else if (typeof source === 'object') {
          additionalData = source;
          console.log(`📝 Datos adicionales fuente ${index + 1} (Object):`, additionalData);
        }
        
        // Mapear todos los campos posibles
        const fieldsToMap = [
          'numeroDocumento', 'tipoDocumento', 'ciudad', 'digitoVerificacion',
          'representanteLegal', 'actividadComercial', 'sectorEconomico', 
          'tamanoEmpresa', 'ingresosMensuales', 'patrimonio',
          'entidadBancaria', 'tipoCuenta', 'numeroCuenta',
          'nombreContacto', 'cargoContacto', 'telefonoContacto', 'emailContacto'
        ];
        
        fieldsToMap.forEach(field => {
          if (additionalData[field] !== undefined && additionalData[field] !== null && additionalData[field] !== '') {
            formData[field] = additionalData[field].toString();
            console.log(`✅ Campo ${field} mapeado desde fuente ${index + 1}: ${additionalData[field]}`);
          }
        });
        
      } catch (e) {
        console.warn(`⚠️ Error al procesar fuente ${index + 1}:`, e);
      }
    });

    // Procesar campos directos del API (máxima prioridad)
    const directMappings = {
      'nit_number': 'nit',
      'verification_digit': 'digitoVerificacion',
      'user_name': 'nombre'
    };

    Object.entries(directMappings).forEach(([apiField, formField]) => {
      if (profileData[apiField] !== undefined && profileData[apiField] !== null && profileData[apiField] !== '') {
        formData[formField] = profileData[apiField].toString();
        console.log(`✅ Campo directo ${formField} mapeado: ${profileData[apiField]}`);
      }
    });

    // Validar y limpiar NIT
    if (formData.nit && formData.nit.includes('-')) {
      const nitParts = formData.nit.split('-');
      formData.nit = nitParts[0];
      if (!formData.digitoVerificacion && nitParts[1]) {
        formData.digitoVerificacion = nitParts[1];
      }
      console.log("🔧 NIT separado:", { nit: formData.nit, digito: formData.digitoVerificacion });
    }

    console.log("✅ Mapeo completo final:", formData);
    return formData;
  }

  /**
   * Preparar FormData para envío al API
   */
  prepareFormDataForSubmit(formData, userId, existingProfile = null) {
    console.log("🚀 Preparando datos para envío:", formData);
    
    const formDataToSend = new FormData();
    
    // Campos específicos para SAP
    const taxId = this.buildTaxId(formData.nit, formData.digitoVerificacion);
    formDataToSend.append('nit_number', formData.nit || '');
    formDataToSend.append('verification_digit', formData.digitoVerificacion || '');
    formDataToSend.append('tax_id', taxId);
    formDataToSend.append('userId', userId);

    // Mapeo explícito de campos críticos (estos son los que han dado problemas)
    const criticalFieldMapping = {
      'numeroDocumento': formData.numeroDocumento || '',
      'tipoDocumento': formData.tipoDocumento || 'CC',
      'ciudad': formData.ciudad || '',
      'nombre': formData.nombre || '',
      'direccion': formData.direccion || '',
      'telefono': formData.telefono || '',
      'email': formData.email || '',
      'pais': formData.pais || 'Colombia'
    };

    // Agregar campos críticos con logging detallado
    Object.entries(criticalFieldMapping).forEach(([key, value]) => {
      formDataToSend.append(key, value);
      console.log(`📤 Campo crítico: ${key} = "${value}"`);
    });

    // Agregar campos empresariales y adicionales
    const additionalFields = [
      'razonSocial', 'representanteLegal', 'actividadComercial', 
      'sectorEconomico', 'tamanoEmpresa', 'ingresosMensuales', 
      'patrimonio', 'entidadBancaria', 'tipoCuenta', 'numeroCuenta',
      'nombreContacto', 'cargoContacto', 'telefonoContacto', 'emailContacto'
    ];

    additionalFields.forEach(key => {
      if (formData[key] !== undefined && formData[key] !== null) {
        formDataToSend.append(key, formData[key] || '');
        console.log(`📤 Campo adicional: ${key} = "${formData[key] || ''}"`);
      }
    });

    // Manejar archivos
    const fileFields = ['fotocopiaCedula', 'fotocopiaRut', 'anexosAdicionales'];
    fileFields.forEach(key => {
      if (formData[key] && formData[key] instanceof File) {
        formDataToSend.append(key, formData[key]);
        console.log(`📁 Archivo agregado: ${key} - ${formData[key].name}`);
      }
    });

    // Debug: mostrar todo lo que se está enviando
    console.log("=== RESUMEN DE DATOS A ENVIAR ===");
    for (let [key, value] of formDataToSend.entries()) {
      if (value instanceof File) {
        console.log(`${key}: [Archivo] ${value.name} (${value.size} bytes)`);
      } else {
        console.log(`${key}: "${value}"`);
      }
    }
    console.log("================================");

    return formDataToSend;
  }

  /**
   * Construir Tax ID para SAP
   */
  buildTaxId(nit, digitoVerificacion) {
    if (!nit) return '';
    return digitoVerificacion ? `${nit}-${digitoVerificacion}` : nit;
  }

  // =========================================
  // MÉTODOS DE VALIDACIÓN
  // =========================================

  /**
   * Validar campos críticos del formulario
   */
  validateCriticalFields(formData, currentStep = 0) {
    const errors = {};
    
    if (currentStep === 0) {
      // Validación paso 1: Información básica
      const requiredFields = {
        nombre: "El nombre es requerido",
        numeroDocumento: "El número de documento es requerido",
        direccion: "La dirección es requerida", 
        ciudad: "La ciudad es requerida",
        pais: "El país es requerido",
        telefono: "El teléfono es requerido",
        email: "El correo electrónico es requerido"
      };

      Object.entries(requiredFields).forEach(([field, message]) => {
        if (!formData[field]?.toString().trim()) {
          errors[field] = message;
        }
      });

      // Validación específica de email
      if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
        errors.email = "El correo electrónico no es válido";
      }

      // Validación específica de documento
      if (formData.numeroDocumento && !/^\d+$/.test(formData.numeroDocumento)) {
        errors.numeroDocumento = "El número de documento debe contener solo números";
      }

      // Validación de teléfono
      if (formData.telefono && !/^\d{7,15}$/.test(formData.telefono.replace(/[\s\-\(\)]/g, ''))) {
        errors.telefono = "El teléfono debe contener entre 7 y 15 dígitos";
      }
    }

    // Validación de NIT (aplica a cualquier paso donde esté presente)
    if (formData.nit && formData.nit.trim() !== '') {
      if (!/^\d{8,12}$/.test(formData.nit)) {
        errors.nit = "El NIT debe contener entre 8 y 12 dígitos numéricos";
      }
    }

    // Validación de dígito de verificación
    if (formData.digitoVerificacion && !/^[0-9]$/.test(formData.digitoVerificacion)) {
      errors.digitoVerificacion = "El dígito de verificación debe ser un número del 0 al 9";
    }

    console.log("🔍 Validación realizada:", { step: currentStep, errors });
    return errors;
  }

  // =========================================
  // MÉTODOS DE CONTEXTO DE USUARIO
  // =========================================

  /**
   * Obtener información del usuario desde múltiples fuentes
   */
  getUserContext() {
    // Intentar obtener del localStorage
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        console.log("👤 Usuario encontrado en localStorage:", parsed);
        return parsed;
      }
    } catch (e) {
      console.error("Error parsing stored user:", e);
    }

    // Intentar obtener del token JWT
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        console.log("🔑 Usuario encontrado en token:", decodedPayload);
        return decodedPayload;
      }
    } catch (e) {
      console.error("Error decoding token:", e);
    }

    console.warn("⚠️ No se encontró contexto de usuario");
    return null;
  }

  /**
   * Obtener ID de usuario con mejores fallbacks
   */
  getUserId(userFromContext = null) {
    const contexts = [
      userFromContext,
      this.getUserContext()
    ];

    for (const context of contexts) {
      if (context?.id) {
        console.log("✅ ID de usuario encontrado:", context.id);
        return context.id;
      }
      if (context?._id) {
        console.log("✅ ID de usuario encontrado (_id):", context._id);
        return context._id;
      }
      if (context?.user_id) {
        console.log("✅ ID de usuario encontrado (user_id):", context.user_id);
        return context.user_id;
      }
    }

    console.warn("⚠️ No se pudo obtener ID de usuario");
    return null;
  }

  // =========================================
  // MÉTODOS DE DOCUMENTOS Y S3
  // =========================================

  /**
   * Verificar si URL de S3 está expirada
   */
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

  /**
   * Validar disponibilidad de documentos
   */
  getDocumentAvailability(client) {
    if (!client) return { cedula: false, rut: false, anexos: false };
    
    return {
      cedula: !!(client.fotocopiaCedula || client.fotocopiaCedulaUrl),
      rut: !!(client.fotocopiaRut || client.fotocopiaRutUrl),
      anexos: !!client.anexosAdicionales
    };
  }

  /**
   * Obtener configuración de documento con detección de expiración
   */
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

  // =========================================
  // MÉTODOS DE CACHE
  // =========================================

  /**
   * Verificar si el cache es válido
   */
  isValidCache(key) {
    const cached = this.cache.get(key);
    const isValid = cached && (Date.now() - cached.timestamp < this.cacheTimeout);
    console.log(`📋 Cache ${key}: ${isValid ? 'VÁLIDO' : 'EXPIRADO/INEXISTENTE'}`);
    return isValid;
  }

  /**
   * Obtener datos del cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  /**
   * Establecer datos en cache
   */
  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
    console.log(`📋 Datos almacenados en cache: ${key}`);
  }

  /**
   * Limpiar cache
   */
  clearCache(userId = null) {
    if (userId) {
      this.cache.delete(`profile_${userId}`);
      console.log(`🗑️ Cache limpiado para usuario: ${userId}`);
    } else {
      this.cache.clear();
      console.log('🗑️ Todo el cache limpiado');
    }
  }

  // =========================================
  // MANEJO DE ERRORES
  // =========================================

  /**
   * Manejar errores de API
   */
  handleError(error) {
    console.error("🚨 Error en ClientProfileService:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });

    if (error.response?.status === 401) {
      return new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    } else if (error.response?.status === 403) {
      return new Error('No tienes permisos para realizar esta acción.');
    } else if (error.response?.status === 404) {
      return new Error('El recurso solicitado no existe.');
    } else if (error.response?.status === 422) {
      return new Error('Los datos enviados no son válidos. Verifica la información.');
    } else if (error.response?.status >= 500) {
      return new Error('Error interno del servidor. Inténtalo más tarde.');
    } else if (error.code === 'ECONNABORTED') {
      return new Error('La operación tardó demasiado tiempo. Inténtalo nuevamente.');
    }
    
    return error;
  }

  // =========================================
  // MÉTODOS DE UTILIDAD
  // =========================================

  /**
   * Obtener estadísticas del cache
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Verificar conexión con el API
   */
  async checkApiConnection() {
    try {
      const response = await this.apiClient.get('/health');
      console.log('✅ API conectado correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error de conexión con API:', error);
      return false;
    }
  }

  /**
   * Obtener información de debug
   */
  getDebugInfo() {
    return {
      cacheStats: this.getCacheStats(),
      userContext: this.getUserContext(),
      timestamp: new Date().toISOString()
    };
  }
}

// Exportar instancia singleton
export default new ClientProfileService();