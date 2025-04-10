import axios from 'axios';
import { isNgrok, isDevelopment } from '../utils/environment';

// Función para determinar la URL base
const determineBaseUrl = () => {
  // Usar directamente la variable de entorno si está definida
  if (import.meta.env.VITE_API_URL) {
    console.log(`Usando API URL configurada: ${import.meta.env.VITE_API_URL}`);
    return import.meta.env.VITE_API_URL;
  }

  // Obtener la información del host actual
  const currentHost = window.location.hostname;
  const isNgrokHost = currentHost.includes('ngrok') || currentHost.includes('ngrok-free.app');

  if (isNgrokHost) {
    console.log(`Detectado host ngrok: ${window.location.origin}`);
    return window.location.origin;
  }

  // Para desarrollo local
  return 'http://localhost:3000';
};

// Obtener la URL base
const baseURL = determineBaseUrl();
console.log(`API configurada para usar URL base: ${baseURL}`);

// Definir el path de API
const apiPath = import.meta.env.VITE_API_PATH || '/api';

// Crear instancia de axios
const API = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
    ...(import.meta.env.VITE_USE_NGROK === 'true' || window.location.hostname.includes('ngrok') ? {
      'ngrok-skip-browser-warning': '69420',
      'Bypass-Tunnel-Reminder': 'true'
    } : {})
  },
  withCredentials: false
});

// Interceptor para asegurar que todas las URLs tienen el prefijo API correcto
API.interceptors.request.use(
  (config) => {
    // Imprimir URL original para depuración
    console.log(`URL original: ${config.url}`);

    // Si la URL ya comienza con http, no modificar
    if (config.url.startsWith('http')) {
      return config;
    }

    // Asegurar que apiPath esté definido correctamente
    const apiPath = import.meta.env.VITE_API_PATH || '/api';

    // Si la URL ya incluye el prefijo API, no modificar
    if (config.url.startsWith(apiPath)) {
      console.log(`URL mantiene prefijo API: ${config.url}`);
      return config;
    }

    // Añadir prefijo API
    const normalizedUrl = config.url.startsWith('/') ? config.url : `/${config.url}`;
    config.url = `${apiPath}${normalizedUrl}`;
    console.log(`URL normalizada: ${config.url}`);

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptores para debugging
if (isDevelopment || import.meta.env.VITE_DEBUG_API === 'true') {
  API.interceptors.request.use(
    (config) => {
      console.log(`📤 Enviando petición a: ${config.baseURL}${config.url}`);
      if (config.data && config.data.recaptchaToken) {
        console.log('reCAPTCHA token presente en la solicitud:', config.url);
      } else if (config.url.includes('login') || config.url.includes('register') || config.url.includes('password')) {
        console.warn('Advertencia: Sin token reCAPTCHA para:', config.url);
      }
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

// Interceptor para autenticación
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default API;