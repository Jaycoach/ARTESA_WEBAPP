// Entornos de ejecución
export const isProduction = import.meta.env.MODE === 'production';
export const isStaging = import.meta.env.MODE === 'staging';
export const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.MODE === 'ngrok';
export const isNgrok = import.meta.env.VITE_USE_NGROK === 'true';

// Variables de la aplicación
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Artesa Dashboard';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
export const ASSETS_PATH = import.meta.env.VITE_ASSETS_PATH || '/src';

// Configuración de API
export const API_URL = import.meta.env.VITE_API_URL;
export const API_PATH = import.meta.env.VITE_API_PATH || '';
export const DEBUG_API = import.meta.env.VITE_DEBUG_API === 'true' || isDevelopment;
export const FORCE_ALLOW_ANY_HOST = import.meta.env.VITE_FORCE_ALLOW_ANY_HOST === 'true';

// Configuración de reCAPTCHA
export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
export const RECAPTCHA_DEV_MODE = import.meta.env.VITE_RECAPTCHA_DEV_MODE === 'true';

// Configuraciones específicas de negocio
export const ORDER_TIME_LIMIT = import.meta.env.VITE_ORDER_TIME_LIMIT || '18:00';
export const MAX_IMAGE_SIZE_MB = Number(import.meta.env.VITE_MAX_IMAGE_SIZE_MB || 2);

// Funciones auxiliares
export const getApiUrl = () => API_URL;
export const getAppVersion = () => APP_VERSION;

// Función para construir URLs completas de API
export const buildApiUrl = (endpoint) => {
  const baseUrl = API_URL || '';
  const path = API_PATH || '';
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  return `${baseUrl}${path}${normalizedEndpoint}`;
};

// Función para logging en desarrollo
export const logEnvironmentInfo = () => {
  if (isDevelopment) {
    console.group('🌍 Información del entorno');
    console.log('Modo:', import.meta.env.MODE);
    console.log('API URL:', getApiUrl());
    console.log('Versión:', getAppVersion());
    console.log('Ngrok activo:', isNgrok);
    console.log('API Debug:', DEBUG_API ? 'Activado' : 'Desactivado');
    console.log('reCAPTCHA Site Key:', RECAPTCHA_SITE_KEY ? 'Configurada' : 'No configurada');
    console.log('Límite tiempo de órdenes:', ORDER_TIME_LIMIT);
    console.log('Tamaño máximo imágenes (MB):', MAX_IMAGE_SIZE_MB);
    console.groupEnd();
  }
};
// Función para obtener información del entorno como objeto
export const getEnvironmentInfo = () => {
  return {
    mode: import.meta.env.MODE,
    apiUrl: getApiUrl(),
    version: getAppVersion(),
    isNgrok: isNgrok,
    debugApi: DEBUG_API ? 'Activado' : 'Desactivado',
    recaptchaSiteKey: RECAPTCHA_SITE_KEY ? 'Configurada' : 'No configurada',
    orderTimeLimit: ORDER_TIME_LIMIT,
    maxImageSizeMB: MAX_IMAGE_SIZE_MB,
    isProduction,
    isStaging,
    isDevelopment
  };
};
// Función para obtener la URL base del API considerando configuración ngrok
export const determineBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    if (currentHost.includes('ngrok') || currentHost.includes('ngrok-free.app')) {
      return window.location.origin;
    }
  }

  // Detectar automáticamente en entorno de navegador
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    if (currentHost.includes('ngrok') || currentHost.includes('ngrok-free.app')) {
      return window.location.origin;
    }
  }
  
  // Para desarrollo local como último recurso
  return 'https://localhost:3000';
};