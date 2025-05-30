import axios from 'axios';
import { isNgrok, isDevelopment, determineBaseUrl as envDetermineBaseUrl } from '../utils/environment';

const determineBaseUrl = () => {
  // Imprimir variables de entorno relevantes
  console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
  console.log("VITE_USE_NGROK:", import.meta.env.VITE_USE_NGROK);
  console.log("VITE_API_PATH:", import.meta.env.VITE_API_PATH);
  console.log("Current mode:", import.meta.env.MODE);
  
  // Usar la función del archivo environment.js
  return envDetermineBaseUrl();
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
  withCredentials: true
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
// Interceptor para manejar errores
API.interceptors.response.use(
  (response) => {
    // Log para debugging
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
      console.log(`✅ Respuesta exitosa de: ${response.config.url}`, {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      console.log("Headers de respuesta:", response.headers);
      console.log("Content-Type:", response.headers['content-type']);
    }
    return response;
  },
  (error) => {
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
      console.error("❌ Error en interceptor de respuesta:", error);
    }

    if (error.response) {
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
        console.error("📡 Error de respuesta del servidor:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: error.config?.url
        });
      }
      
      if (error.response.status === 401) {
        console.error("🔒 Sesión expirada o token inválido");
      }
    } else if (error.request) {
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
        console.error("🌐 No se recibió respuesta del servidor:", error.request);
      }
    } else {
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
        console.error("⚙️ Error al configurar la solicitud:", error.message);
      }
    }

    return Promise.reject(error);
  }
);

export default API;