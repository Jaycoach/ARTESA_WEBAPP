// Variables generales de la aplicación
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Artesa Dashboard';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
export const ASSETS_PATH = import.meta.env.VITE_ASSETS_PATH || '/src';

// Configuración de API
export const API_URL = import.meta.env.VITE_API_URL;
export const API_PATH = import.meta.env.VITE_API_PATH || '';
export const USE_NGROK = import.meta.env.VITE_USE_NGROK === 'true';
export const DEBUG_API = import.meta.env.VITE_DEBUG_API === 'true' || import.meta.env.DEV;
export const FORCE_ALLOW_ANY_HOST = import.meta.env.VITE_FORCE_ALLOW_ANY_HOST === 'true';

// Configuración de reCAPTCHA
export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
export const RECAPTCHA_DEV_MODE = import.meta.env.VITE_RECAPTCHA_DEV_MODE === 'true';

// Nuevas variables para configuraciones específicas
export const ORDER_TIME_LIMIT = import.meta.env.VITE_ORDER_TIME_LIMIT || '18:00';
export const MAX_IMAGE_SIZE_MB = Number(import.meta.env.VITE_MAX_IMAGE_SIZE_MB || 2);

// Función para obtener la URL base del API basada en la configuración actual
export const getApiBaseUrl = () => {
  if (API_URL) return API_URL;
  
  // Detectar automáticamente en entorno de navegador
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    if (currentHost.includes('ngrok') || currentHost.includes('ngrok-free.app')) {
      return window.location.origin;
    }
  }
  
  return 'http://localhost:3000';
};

// Función de utilidad para construir URLs de API
export const buildApiUrl = (endpoint) => {
  const baseUrl = getApiBaseUrl();
  const path = API_PATH || '';
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  return `${baseUrl}${path}${normalizedEndpoint}`;
};

// Función para depuración condicional
export const logDebug = (...args) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};