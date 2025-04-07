// src/api/config.js
import axios from 'axios';

// Función para determinar la URL base
const determineBaseUrl = () => {
  // 1. Verificar si estamos accediendo desde ngrok
  const currentHost = window.location.hostname;
  const isAccessingVia = (domain) => currentHost.includes(domain);
  const isNgrok = isAccessingVia('ngrok-free.app');
  
  // 2. Si accedemos desde ngrok, usar la misma URL base
  if (isNgrok) {
    console.log('Accediendo a través de ngrok, usando la misma URL base');
    const apiPath = import.meta.env.VITE_API_PATH || '/api';
    return `${window.location.origin}${apiPath}`;
  }
  
  // 3. Si no es ngrok, usar variables de entorno configuradas
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const apiPath = import.meta.env.VITE_API_PATH || '/api';
  
  // 4. Construir URL completa asegurando estructura correcta
  let fullUrl = baseUrl;
  if (!fullUrl.endsWith(apiPath) && !fullUrl.endsWith(`${apiPath}/`)) {
    // Si la base ya incluye la ruta /api, no añadirla dos veces
    if (!fullUrl.endsWith('/')) fullUrl += '/';
    fullUrl = fullUrl.replace(/\/+$/, ''); // Eliminar múltiples / al final
    fullUrl += apiPath;
  }
  
  return fullUrl;
};

// Obtener la URL base determinada dinámicamente
const baseURL = determineBaseUrl();
console.log(`API configurada para usar URL base: ${baseURL}`);

// Crear instancia de axios
const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    // Headers para bypass de restricciones de ngrok
    'ngrok-skip-browser-warning': '69420',
    'Bypass-Tunnel-Reminder': 'true'
  },
  withCredentials: false
});

// Interceptor para debugging (activado en desarrollo o si está explícitamente habilitado)
if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
  API.interceptors.request.use(
    (config) => {
      console.log(`📤 Enviando petición a: ${config.baseURL}${config.url}`);
      return config;
    },
    (error) => {
      console.error('🚫 Error en request interceptor:', error);
      return Promise.reject(error);
    }
  );

  API.interceptors.response.use(
    (response) => {
      console.log(`📥 Respuesta de ${response.config.url}: ${response.status}`);
      return response;
    },
    (error) => {
      console.error(`🚫 Error en respuesta de ${error.config?.url || 'desconocido'}:`, error);
      return Promise.reject(error);
    }
  );
}

// Interceptor para agregar el token de autenticación
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default API;