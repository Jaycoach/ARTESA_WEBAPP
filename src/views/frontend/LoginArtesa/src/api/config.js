import axios from 'axios';
import { isNgrok, isDevelopment } from '../utils/environment';

const determineBaseUrl = () => {
  // Obtener el prefijo de API si está definido
  const apiPath = import.meta.env.VITE_API_PATH || '/api';
  
  // Si estamos usando ngrok, usar la URL de ngrok del archivo .env.grok
  if (import.meta.env.VITE_USE_NGROK === 'true' && import.meta.env.VITE_API_URL) {
    const baseUrl = import.meta.env.VITE_API_URL;
    console.log(`Usando URL de ngrok: ${baseUrl}${apiPath}`);
    // Aquí aseguramos que la URL termina correctamente concatenada con el prefijo
    return `${baseUrl}${apiPath}`;
  }
  
  // Intentar con VITE_API_URL
  if (import.meta.env.VITE_API_URL) {
    const baseUrl = import.meta.env.VITE_API_URL;
    console.log(`Usando VITE_API_URL: ${baseUrl}${apiPath}`);
    return `${baseUrl}${apiPath}`;
  }

  // Fallback para desarrollo local
  console.log('Fallback a URL local con prefijo API');
  return `http://localhost:3000${apiPath}`;
};

// Obtener la URL base
const baseURL = determineBaseUrl();
console.log(`API configurada para usar URL base: ${baseURL}`);

// Crear instancia de axios con configuración simplificada
const API = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(import.meta.env.VITE_USE_NGROK === 'true' ? {
      'ngrok-skip-browser-warning': '69420',
      'Bypass-Tunnel-Reminder': 'true'
    } : {})
  },
  withCredentials: false
});

console.log('API configurada con baseURL:', API.defaults.baseURL);
console.log('API Path configurado:', import.meta.env.VITE_API_PATH);

// Añadir log adicional en interceptor de peticiones
API.interceptors.request.use(
  (config) => {
    console.log(`Enviando petición completa a: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Mejorar el interceptor para evitar prefijos duplicados
// Simplificar el interceptor para evitar modificaciones innecesarias
API.interceptors.request.use(
  (config) => {
    console.log(`Enviando petición a: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor mejorado para autenticación con manejo de errores
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("Token de autenticación añadido a la petición");
    } else {
      console.warn("No se encontró token de autenticación");
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas de error comunes
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejar errores específicos como token expirado
    if (error.response && error.response.status === 401) {
      console.error("Sesión expirada o token inválido");
      // Opcionalmente limpiar localStorage y redirigir a login
      // localStorage.removeItem('token');
      // localStorage.removeItem('user');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Mantener los interceptores de debugging si es necesario
if (isDevelopment || import.meta.env.VITE_DEBUG_API === 'true') {
  // [código de interceptores de debugging aquí...]
}

export default API;