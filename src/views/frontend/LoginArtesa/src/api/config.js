import axios from 'axios';
import { isNgrok, isDevelopment } from '../utils/environment';

const determineBaseUrl = () => {
  // Imprimir variables de entorno relevantes
  console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
  console.log("VITE_USE_NGROK:", import.meta.env.VITE_USE_NGROK);
  console.log("VITE_API_PATH:", import.meta.env.VITE_API_PATH);
  
  // Cuando usamos ngrok para acceder a la aplicación frontend, 
  // necesitamos seguir apuntando a localhost para la API
  if (import.meta.env.VITE_USE_NGROK === 'true') {
    // Uso explícito de localhost para la API cuando estamos en modo ngrok
    console.log("Modo ngrok activo: Apuntando API a localhost:3000");
    return 'http://localhost:3000';
  }
  
  // Para uso no-ngrok (desarrollo local normal)
  if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
    // En desarrollo local normal, usamos rutas relativas para el proxy de Vite
    console.log("Desarrollo local: Usando rutas API relativas");
    return '';
  }
  
  // Si existe una URL de API explícita configurada
  if (import.meta.env.VITE_API_URL) {
    console.log(`Usando API URL explícita: ${import.meta.env.VITE_API_URL}`);
    return import.meta.env.VITE_API_URL;
  }
  
  // Fallback final
  console.log('Fallback a localhost:3000');
  return 'http://localhost:3000';
};

// Obtener URL base
const baseURL = determineBaseUrl();
// Determinar si necesitamos añadir /api
const apiPath = import.meta.env.VITE_API_PATH || '/api';
// Construir la URL completa
const fullURL = baseURL ? `${baseURL}${apiPath}` : apiPath;

console.log(`API configurada con URL final: ${fullURL}`);

// Crear instancia de axios
const API = axios.create({
  baseURL: fullURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': '69420',
    'Bypass-Tunnel-Reminder': 'true'
  },
  withCredentials: false
});

// Interceptor para añadir token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("Token añadido a la petición");
    }
    
    console.log(`Enviando petición a: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("Sesión expirada o token inválido");
    }
    return Promise.reject(error);
  }
);

export default API;