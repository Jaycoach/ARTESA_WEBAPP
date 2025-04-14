import axios from 'axios';
import { isNgrok, isDevelopment } from '../utils/environment';

const determineBaseUrl = () => {
  // Imprimir todas las variables de entorno relevantes para depuración
  console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
  console.log("VITE_USE_NGROK:", import.meta.env.VITE_USE_NGROK);
  
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
const baseURL = determineBaseUrl();
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