import axios from 'axios';
import { isNgrok, isDevelopment } from '../utils/environment';

const determineBaseUrl = () => {
  // Imprimir todas las variables de entorno relevantes para depuración
  console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
  console.log("VITE_USE_NGROK:", import.meta.env.VITE_USE_NGROK);
  console.log("VITE_API_PATH:", import.meta.env.VITE_API_PATH);
  
  // Si tenemos una URL de API explícita, usarla
  if (import.meta.env.VITE_API_URL) {
    console.log(`Usando API URL explícita: ${import.meta.env.VITE_API_URL}`);
    return import.meta.env.VITE_API_URL;
  }
  
  // Si estamos en un entorno de navegador, intentar usar la URL actual
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('ngrok') || currentOrigin.includes('ngrok-free.app')) {
      console.log(`Detectado entorno Ngrok, usando origen: ${currentOrigin}`);
      return currentOrigin;
    }
  }
  
  // Fallback para desarrollo local
  console.log('Fallback a URL local: http://localhost:3000');
  return 'http://localhost:3000';
};

// Obtener la URL base
let baseURL = determineBaseUrl();
// Verificar si la URL base ya contiene /api
if (!baseURL.endsWith('/api')) {
  console.log(`URL base sin /api, añadiendo prefijo: ${baseURL}/api`);
  baseURL = `${baseURL}/api`;
}
console.log(`API configurada para usar URL base final: ${baseURL}`);

// Crear instancia de axios con configuración simplificada
const API = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': '69420',
    'Bypass-Tunnel-Reminder': 'true'
  },
  withCredentials: false
});

// Interceptor principal para autenticación y logs
API.interceptors.request.use(
  (config) => {
    // Añadir token de autenticación si existe
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("Token de autenticación añadido a la petición");
    }
    
    // Logging de la URL final
    console.log(`Enviando petición a: ${config.baseURL}${config.url}`);
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas de error
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejar errores específicos como token expirado
    if (error.response && error.response.status === 401) {
      console.error("Sesión expirada o token inválido");
    }
    return Promise.reject(error);
  }
);

// Mantener los interceptores de debugging si es necesario
if (isDevelopment || import.meta.env.VITE_DEBUG_API === 'true') {
  // [código de interceptores de debugging aquí...]
}

export default API;