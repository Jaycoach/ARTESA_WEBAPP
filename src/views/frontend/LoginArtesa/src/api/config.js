import axios from 'axios';

const determineBaseUrl = () => {
  const mode = import.meta.env.MODE;
  
  console.log("🔧 Variables de entorno detectadas:", {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    MODE: mode
  });
  
  // **FORZAR PROXY LOCAL EN DESARROLLO**
  if (mode === 'development') {
    console.log("🔄 FORZANDO uso de proxy local para evitar CORS");
    return ''; // Usar proxy local (relativo)
  }
  
  // Para staging/production usar URL completa
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
  
  // **CONFIGURACIÓN ESPECÍFICA PARA DEVELOPMENT**
  if (mode === 'development') {
    console.log(`🌐 Configuración development: usando proxy local /api`);
    return {
      baseURL: '/api', // **FORZAR PROXY LOCAL**
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: false, // **NO USAR CREDENTIALS EN DEVELOPMENT**
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024
    };
  }
  
  // Para otros modos
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

// **INTERCEPTOR MEJORADO PARA DEVELOPMENT**
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("🔑 Token añadido a la petición");
    }
    
    // **ESPECIAL PARA FORMDATA**
    if (config.data instanceof FormData) {
      console.log("📤 FormData detectado - configurando headers para upload");
      delete config.headers['Content-Type'];
      config.headers['Accept'] = 'application/json';
      config.timeout = 60000;
    }
    
    // **VERIFICACIÓN: Asegurar que usa proxy en development**
    const fullUrl = `${config.baseURL}${config.url}`;
    if (import.meta.env.MODE === 'development') {
      if (!fullUrl.startsWith('/api')) {
        console.error("❌ ADVERTENCIA: No está usando proxy en development:", fullUrl);
      } else {
        console.log(`✅ Usando proxy correctamente: ${fullUrl}`);
      }
    }
    
    console.log(`🌐 Petición: ${config.method?.toUpperCase()} ${fullUrl}`);
    return config;
  },
  (error) => {
    console.error("❌ Error en request interceptor:", error);
    return Promise.reject(error);
  }
);

// **RESTO DE INTERCEPTORS IGUAL**
API.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      const url = response.config.url || '';
      const method = response.config.method?.toUpperCase() || 'GET';
      const fullUrl = `${response.config.baseURL}${url}`;
      console.log(`✅ Respuesta exitosa: ${method} ${fullUrl} [${response.status}]`);
    }
    return response;
  },
  (error) => {
    const method = error.config?.method?.toUpperCase() || 'GET';
    const fullUrl = error.config ? `${error.config.baseURL}${error.config.url}` : 'URL desconocida';
    
    console.error("❌ Error en API:", {
      method,
      url: fullUrl,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });

    // **MANEJO ESPECÍFICO DE CORS**
    if (error.message.includes('CORS')) {
      console.error("🚫 ERROR DE CORS DETECTADO");
      console.error("💡 Verifica que el proxy esté funcionando correctamente");
      console.error("💡 O que el backend incluya tu dominio en Access-Control-Allow-Origin");
    }

    return Promise.reject(error);
  }
);

// **FUNCIONES AUXILIARES IGUALES**
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

export const ProductsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return API.get(`/products${queryString ? `?${queryString}` : ''}`);
  },
  getById: (id) => API.get(`/products/${id}`),
  create: (productData) => API.post('/products', productData),
  update: (id, productData) => API.put(`/products/${id}`, productData),
  delete: (id) => API.delete(`/products/${id}`),
  updateImage: (id, imageFile) => {
    const formData = createFormDataRequest({}, { image: imageFile });
    return API.put(`/products/${id}/image`, formData);
  },
  search: (searchTerm) => API.get(`/products?search=${encodeURIComponent(searchTerm)}`),
  getPendingSync: () => API.get('/products/sap/pending')
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

export default API;