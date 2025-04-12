import axios from 'axios';
import { isNgrok, isDevelopment } from '../utils/environment';

// Función para determinar la URL base (mejorada)
const determineBaseUrl = () => {
  // Priorizar VITE_REACT_APP_API_URL para compatibilidad con código existente
  if (import.meta.env.VITE_REACT_APP_API_URL) {
    console.log(`Usando VITE_REACT_APP_API_URL: ${import.meta.env.VITE_REACT_APP_API_URL}`);
    return import.meta.env.VITE_REACT_APP_API_URL;
  }
  
  // Luego intentar con VITE_API_URL
  if (import.meta.env.VITE_API_URL) {
    console.log(`Usando VITE_API_URL: ${import.meta.env.VITE_API_URL}`);
    return import.meta.env.VITE_API_URL;
  }

  // Detectar Ngrok automáticamente
  const currentHost = window.location.hostname;
  const isNgrokHost = currentHost.includes('ngrok') || currentHost.includes('ngrok-free.app');

  if (isNgrokHost) {
    console.log(`Detectado host ngrok: ${window.location.origin}`);
    return `${window.location.origin}`;
  }

  // Fallback para desarrollo local
  return 'http://localhost:3000';
};

// Obtener la URL base
const baseURL = determineBaseUrl();
console.log(`API configurada para usar URL base: ${baseURL}`);

// Definir el path de API (considerar si ya está incluido en baseURL)
const apiPath = import.meta.env.VITE_API_PATH || '/api';
const baseURLIncludesApiPath = baseURL.includes(apiPath);

// Crear instancia de axios con configuración mejorada
const API = axios.create({
  baseURL: baseURLIncludesApiPath ? baseURL : `${baseURL}${apiPath}`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(import.meta.env.VITE_USE_NGROK === 'true' || 
       window.location.hostname.includes('ngrok') ? {
      'ngrok-skip-browser-warning': '69420',
      'Bypass-Tunnel-Reminder': 'true'
    } : {})
  },
  withCredentials: false
});

// Mejorar el interceptor para evitar prefijos duplicados
API.interceptors.request.use(
  (config) => {
    // Si la URL ya comienza con http o https, no modificar
    if (config.url.startsWith('http')) {
      console.log(`URL absoluta, no se modifica: ${config.url}`);
      return config;
    }
    
    // Si baseURL ya incluye apiPath, no necesitamos añadirlo de nuevo
    if (baseURLIncludesApiPath) {
      // Asegurar que la URL empiece con /
      config.url = config.url.startsWith('/') ? config.url : `/${config.url}`;
      console.log(`URL con baseURL que ya incluye apiPath: ${config.baseURL}${config.url}`);
      return config;
    }

    // Si la URL ya incluye el prefijo API, no modificar
    if (config.url.startsWith(apiPath)) {
      console.log(`URL ya contiene prefijo API: ${config.url}`);
      return config;
    }

    // Normalizar la URL y añadir prefijo API
    const normalizedUrl = config.url.startsWith('/') ? config.url : `/${config.url}`;
    // Aquí ya no añadimos apiPath porque ya se incluye en baseURL
    config.url = normalizedUrl;
    console.log(`URL normalizada: ${config.baseURL}${config.url}`);

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