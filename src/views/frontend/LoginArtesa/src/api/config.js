// src/api/config.js
import axios from 'axios';

// Función para determinar la URL base
const determineBaseUrl = () => {
  // Usar directamente la variable de entorno si está definida
  if (import.meta.env.VITE_API_URL) {
    console.log(`Usando API URL configurada: ${import.meta.env.VITE_API_URL}`);
    return import.meta.env.VITE_API_URL;
  }

  // Obtener la información del host actual
  const currentHost = window.location.hostname;
  const isNgrok = currentHost.includes('ngrok') || currentHost.includes('ngrok-free.app');
  
  if (isNgrok) {
    // Para ngrok, usar el mismo origen pero mantener el prefijo /api
    return `${window.location.origin}`;
  }
  
  // Para desarrollo local
  return 'http://localhost:3000';
};

// Obtener la URL base
const baseURL = determineBaseUrl();
console.log(`API configurada para usar URL base: ${baseURL}`);

// Crear instancia de axios
const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
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