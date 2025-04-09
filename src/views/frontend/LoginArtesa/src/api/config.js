import axios from 'axios';
import { isNgrok, isDevelopment } from '../utils/environment';

// Función para determinar la URL base usando las variables de entorno
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
    // Para ngrok, usar el mismo origen pero mantener el prefijo /api
    console.log(`Detectado entorno ngrok: ${window.location.origin}`);
    return `${window.location.origin}`;
  }
  
  // Para desarrollo local como último recurso
  console.log('Usando URL de desarrollo local predeterminada');
  return 'http://localhost:3000';
};

// Obtener la URL base
const baseURL = determineBaseUrl();
console.log(`API configurada para usar URL base: ${baseURL}`);

// Construir la ruta completa incluyendo el path de API si es necesario
const apiPath = import.meta.env.VITE_API_PATH || '';
const fullBaseURL = baseURL + apiPath;

// Crear instancia de axios
const API = axios.create({
  baseURL: fullBaseURL,
  headers: {
    'Content-Type': 'application/json',
    // Headers específicos para ngrok para evitar advertencias
    ...(import.meta.env.VITE_USE_NGROK === 'true' || window.location.hostname.includes('ngrok') ? {
      'ngrok-skip-browser-warning': '69420',
      'Bypass-Tunnel-Reminder': 'true'
    } : {})
  },
  withCredentials: false
});

// Interceptor para debugging (activado en desarrollo o si está explícitamente habilitado)
if (isDevelopment || import.meta.env.VITE_DEBUG_API === 'true') {
  API.interceptors.request.use(
    (config) => {
      console.log(`📤 Enviando petición a: ${config.baseURL}${config.url}`);
      // Agregar log para reCAPTCHA
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