import axios from 'axios';

export const clearAuthHeader = (instance) => {
  if (instance.defaults.headers.common?.Authorization) {
    delete instance.defaults.headers.common.Authorization;
    console.log("🔑 Authorization header limpiado");
  }
};

const determineBaseUrl = () => {
  const mode = import.meta.env.MODE;

  console.log("🔧 Variables de entorno detectadas:", {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    MODE: mode
  });

  if (mode === 'development') {
    console.log("🔄 FORZANDO uso de proxy local para evitar CORS");
    return '/api';
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  const apiPath = import.meta.env.VITE_API_PATH || '/api';

  if (!apiUrl) {
    console.error("❌ VITE_API_URL no está definida");
    throw new Error("VITE_API_URL es requerida");
  }

  const fullUrl = apiUrl.endsWith('/') ? `${apiUrl.slice(0, -1)}${apiPath}` : `${apiUrl}${apiPath}`;
  console.log(`✅ URL de API construida: ${fullUrl}`);
  return fullUrl;
};

const getApiConfig = () => {
  const mode = import.meta.env.MODE;
  const baseURL = determineBaseUrl();

  if (mode === 'development') {
    console.log(`🌐 Configuración development: usando proxy local ${baseURL}`);
    return {
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: false,
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024
    };
  }

  console.log(`🌐 Configuración ${mode}: usando URL ${baseURL}`);
  return {
    baseURL: baseURL,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': '69420',
      'Bypass-Tunnel-Reminder': 'true'
    },
    withCredentials: true,
    timeout: 30000,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024
  };
};

const config = getApiConfig();
console.log(`🔧 API configurada con baseURL:`, config.baseURL);

const API = axios.create(config);

// ✅ **CACHE PARA EVITAR REQUESTS DUPLICADOS**
const requestCache = new Map();
const CACHE_DURATION = 5000; // 5 segundos

const getCacheKey = (method, url, params = {}) => {
  return `${method}:${url}:${JSON.stringify(params)}`;
};

const getCachedRequest = (key) => {
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📋 Usando cache para: ${key}`);
    return cached.promise;
  }
  return null;
};

const setCachedRequest = (key, promise) => {
  requestCache.set(key, {
    promise,
    timestamp: Date.now()
  });
  
  // Limpiar cache después de la duración
  setTimeout(() => {
    requestCache.delete(key);
  }, CACHE_DURATION);
  
  return promise;
};

// ✅ **INTERCEPTOR CORREGIDO**
API.interceptors.request.use(
  (config) => {
    // ✅ CORREGIDO: Usar nombres consistentes de tokens
    const branchToken = localStorage.getItem('branchAuthToken');
    const userToken = localStorage.getItem('token');

    if (branchToken) {
      config.headers.Authorization = `Bearer ${branchToken}`;
      console.log("🔑 Token BRANCH añadido a la petición");
    } else if (userToken) {
      config.headers.Authorization = `Bearer ${userToken}`;
      console.log("🔑 Token USUARIO añadido a la petición");
    } else {
      delete config.headers.Authorization;
      console.log("⚠️ No hay token disponible - petición sin autenticación");
    }

    if (config.data instanceof FormData) {
      console.log("📤 FormData detectado - configurando headers para upload");
      delete config.headers['Content-Type'];
      config.headers['Accept'] = 'application/json';
      config.timeout = 60000;
    }

    // Sincronizaciones del BackOffice (/api/backoffice/sync/*): clientSyncController
    // espera la sincronización completa con SAP antes de responder (síncrono, no un
    // job en background) - con 322 clientes ya toma ~2m21s reales observados en
    // Staging, y la base va a crecer. El timeout genérico de 30s de arriba se queda
    // corto y el frontend reporta un falso error de comunicación aunque el backend
    // sigue trabajando y termina bien. Ver hallazgo en docs/CHANGELOG-backoffice-core.md.
    if (config.url && config.url.includes('/backoffice/sync/')) {
      config.timeout = 240000;
    }

    const fullUrl = config.baseURL + config.url;
    const authType = branchToken ? 'BRANCH' : (userToken ? 'USER' : 'NONE');
    console.log(`🌐 Petición [${authType}]: ${config.method?.toUpperCase()} ${fullUrl}`);

    return config;
  },
  (error) => {
    console.error("❌ Error en request interceptor:", error);
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      const url = response.config.url || '';
      const method = response.config.method?.toUpperCase() || 'GET';
      const fullUrl = response.config.baseURL + url;

      const hasAuth = response.config.headers.Authorization;
      const authType = hasAuth ?
        (localStorage.getItem('branchAuthToken') ? 'BRANCH' : 'USER') : 'NONE';

      console.log(`✅ Respuesta exitosa [${authType}]: ${method} ${fullUrl} [${response.status}]`);
    }
    return response;
  },
  (error) => {
    const method = error.config?.method?.toUpperCase() || 'GET';
    const fullUrl = error.config ? (error.config.baseURL + error.config.url) : 'URL desconocida';

    console.error("❌ Error en API:", {
      method,
      url: fullUrl,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });

    // Manejo específico de errores
    if (error.response?.status === 403) {
      console.error("🚫 ERROR 403: Sin permisos suficientes");
    }

    if (error.response?.status === 401) {
      console.error("🚫 ERROR 401: Token inválido o expirado");
    }

    return Promise.reject(error);
  }
);

// ✅ **BRANCH ORDERS API CORREGIDA CON ENDPOINTS CORRECTOS**
export const BranchOrdersAPI = {
  // ✅ CORREGIDO: Usar endpoints que coinciden con tu backend
  getOrders: async (params = {}) => {
    const cacheKey = getCacheKey('GET', 'branch-orders/orders', params);
    const cached = getCachedRequest(cacheKey);
    if (cached) return cached;

    try {
      const queryParams = new URLSearchParams();
      
      if (params.status) queryParams.append('status', params.status);
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.from_date) queryParams.append('from_date', params.from_date);
      if (params.to_date) queryParams.append('to_date', params.to_date);

      const queryString = queryParams.toString();
      const endpoint = `/branch-orders/orders${queryString ? `?${queryString}` : ''}`;

      console.log('🏢 Branch API - Obteniendo órdenes:', endpoint);
      const promise = API.get(endpoint);
      return setCachedRequest(cacheKey, promise);

    } catch (error) {
      console.error('❌ Error obteniendo órdenes de sucursal:', error);
      throw error;
    }
  },

  // ✅ CORREGIDO: Usar solo axios, no fetch
  getDashboardProducts: async (params = {}) => {
    const cacheKey = getCacheKey('GET', 'branch-orders/products', params);
    const cached = getCachedRequest(cacheKey);
    if (cached) return cached;

    try {
      const queryParams = new URLSearchParams();

      if (params.search) queryParams.append('search', params.search);
      if (params.category) queryParams.append('category', params.category);
      if (params.active_only !== undefined) queryParams.append('active_only', params.active_only);

      const queryString = queryParams.toString();
      const endpoint = `/branch-orders/products${queryString ? `?${queryString}` : ''}`;

      console.log('🏢 Branch API - Dashboard products:', endpoint);
      const promise = API.get(endpoint);
      return setCachedRequest(cacheKey, promise);

    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️ Endpoint branch products no existe, usando products estándar');
        const standardEndpoint = `/products${params.search ? `?search=${params.search}` : ''}`;
        const fallbackPromise = API.get(standardEndpoint);
        return setCachedRequest(cacheKey, fallbackPromise);
      }
      throw error;
    }
  },

  // ✅ NUEVO: Obtener detalles de orden específica
  getOrderDetails: async (orderId) => {
    const cacheKey = getCacheKey('GET', `branch-orders/${orderId}`);
    const cached = getCachedRequest(cacheKey);
    if (cached) return cached;

    try {
      console.log(`🏢 Branch API - Obteniendo detalles de orden: ${orderId}`);
      const promise = API.get(`/branch-orders/${orderId}`);
      return setCachedRequest(cacheKey, promise);
    } catch (error) {
      console.error(`❌ Error obteniendo detalles de orden ${orderId}:`, error);
      throw error;
    }
  },

  // ✅ CORREGIDO: Crear orden
  createOrder: async (orderData) => {
    try {
      console.log('🏢 Branch API - Creando nueva orden:', orderData);
      return API.post('/branch-orders', orderData);
    } catch (error) {
      console.error('❌ Error creando orden de sucursal:', error);
      throw error;
    }
  },

  // ✅ CORREGIDO: Actualizar estado de orden
  updateOrderStatus: async (orderId, statusData) => {
    try {
      console.log(`🏢 Branch API - Actualizando estado de orden ${orderId}:`, statusData);
      return API.put(`/branch-orders/${orderId}/status`, statusData);
    } catch (error) {
      console.error(`❌ Error actualizando estado de orden ${orderId}:`, error);
      throw error;
    }
  },

  getProfile: () => {
    const cacheKey = getCacheKey('GET', 'branch-auth/profile');
    const cached = getCachedRequest(cacheKey);
    if (cached) return cached;

    console.log('🏢 Branch API - Obteniendo perfil de sucursal');
    const promise = API.get('/branch-auth/profile');
    return setCachedRequest(cacheKey, promise);
  }
};

// ✅ **FUNCIONES AUXILIARES OPTIMIZADAS**
export const createFormDataRequest = (data, files = {}) => {
  const formData = new FormData();

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined && data[key] !== null) {
      formData.append(key, data[key]);
    }
  });

  Object.keys(files).forEach(key => {
    if (files[key]) {
      formData.append(key, files[key]);
    }
  });

  return formData;
};

// ✅ **CACHE PARA FUNCIONES AUXILIARES**
let authInfoCache = null;
let authInfoCacheTime = 0;
const AUTH_CACHE_DURATION = 1000; // 1 segundo

export const getAuthInfo = () => {
  const now = Date.now();
  
  if (authInfoCache && (now - authInfoCacheTime) < AUTH_CACHE_DURATION) {
    return authInfoCache;
  }

  const branchToken = localStorage.getItem('branchAuthToken');
  const userToken = localStorage.getItem('token');

  authInfoCache = {
    hasBranchToken: !!branchToken,
    hasUserToken: !!userToken,
    activeToken: branchToken || userToken || null,
    tokenType: branchToken ? 'branch' : (userToken ? 'user' : 'none'),
    branchTokenLength: branchToken?.length || 0,
    userTokenLength: userToken?.length || 0
  };
  
  authInfoCacheTime = now;
  return authInfoCache;
};

export const debugTokens = () => {
  const info = getAuthInfo();
  console.log("🔍 Estado actual de tokens:", info);
  return info;
};

export const isBranchUser = () => {
  const info = getAuthInfo();
  const isBranch = info.tokenType === 'branch';

  console.log('🔍 isBranchUser ejecutada:', {
    tokenType: info.tokenType,
    result: isBranch
  });

  return isBranch;
};

// ✅ **PRODUCTOS API OPTIMIZADA**
export const getProductsAPI = () => {
  const isUserBranch = isBranchUser();
  console.log('🔍 getProductsAPI ejecutada:', { isUserBranch });

  if (isUserBranch) {
    console.log('🏢 Retornando BranchOrdersAPI para productos');
    return {
      getAll: BranchOrdersAPI.getDashboardProducts,
      getProducts: BranchOrdersAPI.getDashboardProducts
    };
  } else {
    console.log('👤 Retornando ProductsAPI estándar');
    return ProductsAPI;
  }
};

export const ProductsAPI = {
  getAll: (params = {}) => {
    const cacheKey = getCacheKey('GET', 'products', params);
    const cached = getCachedRequest(cacheKey);
    if (cached) return cached;

    const queryString = new URLSearchParams(params).toString();
    const promise = API.get(`/products${queryString ? `?${queryString}` : ''}`);
    return setCachedRequest(cacheKey, promise);
  },
  getById: (id) => {
    const cacheKey = getCacheKey('GET', `products/${id}`);
    const cached = getCachedRequest(cacheKey);
    if (cached) return cached;

    const promise = API.get(`/products/${id}`);
    return setCachedRequest(cacheKey, promise);
  },
  create: (productData) => API.post('/products', productData),
  update: (id, productData) => API.put(`/products/${id}`, productData),
  delete: (id) => API.delete(`/products/${id}`),
  updateImage: (id, imageFile) => {
    const formData = createFormDataRequest({}, { image: imageFile });
    return API.post(`/products/${id}/images/main`, formData);
  },
  search: (searchTerm) => {
    const cacheKey = getCacheKey('GET', 'products/search', { searchTerm });
    const cached = getCachedRequest(cacheKey);
    if (cached) return cached;

    const promise = API.get(`/products?search=${encodeURIComponent(searchTerm)}`);
    return setCachedRequest(cacheKey, promise);
  },
  getPendingSync: () => API.get('/products/sap/pending'),
  
  // ✅ MÉTODOS DE IMÁGENES CORREGIDOS - MOVIDOS DENTRO DEL OBJETO
  uploadImage: (productId, imageType, imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return API.post(`/products/${productId}/images/${imageType}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
  },
  getImage: (productId, imageType) => {
    return API.get(`/products/images/${productId}/${imageType}`);
  },
  deleteImage: (productId, imageType) => {
    return API.delete(`/products/images/${productId}/${imageType}`);
  },
  listImages: (productId) => {
    return API.get(`/products/${productId}/images`);
  }
};

export const UploadAPI = {
  upload: (file, additionalData = {}) => {
    const formData = createFormDataRequest(additionalData, { file });
    return API.post('/upload', formData);
  },
  uploadImage: (imageFile, metadata = {}) => {
    const formData = createFormDataRequest(metadata, { image: imageFile });
    return API.post('/upload', formData);
  },
  delete: (fileName) => API.delete(`/upload/${fileName}`)
};

// ✅ **FUNCIÓN DE LIMPIEZA PARA EVITAR MEMORY LEAKS**
export const clearCache = () => {
  requestCache.clear();
  authInfoCache = null;
  authInfoCacheTime = 0;
  console.log('🧹 Cache limpiado');
};

// ✅ **LIMPIEZA AUTOMÁTICA CADA 5 MINUTOS**
setInterval(clearCache, 5 * 60 * 1000);

export default API;