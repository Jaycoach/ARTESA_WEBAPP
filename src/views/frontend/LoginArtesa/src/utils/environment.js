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

// **NUEVAS CONFIGURACIONES AWS**
export const S3_BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME;
export const CLOUDFRONT_URL = import.meta.env.VITE_CLOUDFRONT_URL;

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

// **FUNCIÓN MEJORADA**: Obtener la URL base del API considerando la API remota
export const determineBaseUrl = () => {
  // **PASO 1**: Si está configurada explícitamente, usarla
  if (import.meta.env.VITE_API_URL) {
    console.log('🔧 Usando API_URL configurada:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // **PASO 2**: Detectar entorno ngrok
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    if (currentHost.includes('ngrok') || currentHost.includes('ngrok-free.app')) {
      console.log('🔗 Detectado entorno ngrok:', window.location.origin);
      return window.location.origin;
    }
  }

  // **PASO 3**: URLs específicas por entorno
  if (isProduction) {
    const prodUrl = 'https://api.artesa.com'; // Cambiar por tu URL de producción
    console.log('🚀 Entorno producción:', prodUrl);
    return prodUrl;
  }
  
  if (isStaging) {
    const stagingUrl = 'https://ec2-44-216-131-63.compute-1.amazonaws.com';
    console.log('🏗️ Entorno staging:', stagingUrl);
    return stagingUrl;
  }
  
  // **PASO 4**: Para desarrollo, usar la API remota del EC2
  if (isDevelopment) {
    // **OPCIONES DE API REMOTA** (probar en orden de preferencia)
    const apiOptions = [
      'http://ec2-44-216-131-63.compute-1.amazonaws.com:3000', // Puerto 3000 (principal)
      'http://ec2-44-216-131-63.compute-1.amazonaws.com',      // Puerto 80
      'https://ec2-44-216-131-63.compute-1.amazonaws.com',     // Puerto 443 (HTTPS)
      'https://44.216.131.63',                             // IP directa puerto 3000
      'http://44.216.131.63'                                   // IP directa puerto 80
    ];
    
    // Por defecto usar la primera opción
    const devUrl = apiOptions[0];
    console.log('💻 Entorno desarrollo con API remota:', devUrl);
    console.log('📋 Opciones disponibles:', apiOptions);
    return devUrl;
  }
  
  // **FALLBACK**: Si no se detecta ningún entorno
  console.warn('⚠️ No se pudo determinar el entorno, usando fallback');
  return 'http://ec2-44-216-131-63.compute-1.amazonaws.com:3000';
};

// **NUEVA FUNCIÓN**: Probar conectividad con diferentes opciones de API
export const testApiConnectivity = async () => {
  const apiOptions = [
    'http://ec2-44-216-131-63.compute-1.amazonaws.com:3000',
    'http://ec2-44-216-131-63.compute-1.amazonaws.com',
    'https://ec2-44-216-131-63.compute-1.amazonaws.com',
    'https://44.216.131.63',
    'http://44.216.131.63'
  ];
  
  const results = [];
  
  for (const url of apiOptions) {
    try {
      console.log(`🔍 Probando conectividad con: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
      
      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      results.push({
        url,
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      console.log(`✅ ${url} - Status: ${response.status}`);
      
    } catch (error) {
      results.push({
        url,
        status: 'error',
        ok: false,
        error: error.message
      });
      
      console.log(`❌ ${url} - Error: ${error.message}`);
    }
  }
  
  return results;
};

// **FUNCIÓN MEJORADA**: Logging con información de la API remota
export const logEnvironmentInfo = () => {
  if (isDevelopment || DEBUG_API) {
    console.group('🌍 Información del entorno ARTESA');
    console.log('📍 Modo:', import.meta.env.MODE);
    console.log('🔗 API URL:', getApiUrl());
    console.log('🏗️ API Base URL:', determineBaseUrl());
    console.log('📂 API Path:', API_PATH);
    console.log('📦 Versión:', getAppVersion());
    console.log('🔧 Ngrok activo:', isNgrok);
    console.log('🐛 API Debug:', DEBUG_API ? 'Activado' : 'Desactivado');
    console.log('🤖 reCAPTCHA Site Key:', RECAPTCHA_SITE_KEY ? 'Configurada' : 'No configurada');
    console.log('⏰ Límite tiempo de órdenes:', ORDER_TIME_LIMIT);
    console.log('📷 Tamaño máximo imágenes (MB):', MAX_IMAGE_SIZE_MB);
    console.log('☁️ S3 Bucket:', S3_BUCKET_NAME || 'No configurado');
    console.log('🌐 Force Allow Any Host:', FORCE_ALLOW_ANY_HOST);
    console.groupEnd();
    
    // **TEST DE CONECTIVIDAD AUTOMÁTICO** en desarrollo
    if (isDevelopment) {
      console.log('🔍 Iniciando test de conectividad...');
      testApiConnectivity().then(results => {
        console.group('📊 Resultados de conectividad');
        results.forEach(result => {
          const icon = result.ok ? '✅' : '❌';
          console.log(`${icon} ${result.url} - ${result.status}`);
        });
        console.groupEnd();
      });
    }
  }
};

// **FUNCIÓN MEJORADA**: Obtener información del entorno como objeto
export const getEnvironmentInfo = () => {
  return {
    mode: import.meta.env.MODE,
    apiUrl: getApiUrl(),
    apiBaseUrl: determineBaseUrl(),
    apiPath: API_PATH,
    version: getAppVersion(),
    isNgrok: isNgrok,
    debugApi: DEBUG_API,
    recaptchaSiteKey: RECAPTCHA_SITE_KEY ? 'Configurada' : 'No configurada',
    orderTimeLimit: ORDER_TIME_LIMIT,
    maxImageSizeMB: MAX_IMAGE_SIZE_MB,
    s3BucketName: S3_BUCKET_NAME,
    cloudFrontUrl: CLOUDFRONT_URL,
    forceAllowAnyHost: FORCE_ALLOW_ANY_HOST,
    isProduction,
    isStaging,
    isDevelopment
  };
};

// **NUEVA FUNCIÓN**: Construir URL completa para endpoint de upload
export const buildUploadUrl = (endpoint = '') => {
  const baseUrl = determineBaseUrl();
  const path = API_PATH || '/api';
  return `${baseUrl}${path}/upload${endpoint}`;
};

// **NUEVA FUNCIÓN**: Construir URL completa para endpoint de client-profiles
export const buildClientProfileUrl = (endpoint = '') => {
  const baseUrl = determineBaseUrl();
  const path = API_PATH || '/api';
  return `${baseUrl}${path}/client-profiles${endpoint}`;
};

// **NUEVA FUNCIÓN**: Validar configuración mínima requerida
export const validateEnvironmentConfig = () => {
  const errors = [];
  
  if (!API_URL && !determineBaseUrl()) {
    errors.push('❌ No se pudo determinar la URL de la API');
  }
  
  if (isDevelopment && !DEBUG_API) {
    console.warn('⚠️ Se recomienda activar DEBUG_API en desarrollo');
  }
  
  if (errors.length > 0) {
    console.error('🚨 Errores de configuración del entorno:', errors);
    return false;
  }
  
  console.log('✅ Configuración del entorno válida');
  return true;
};

// **EJECUTAR LOGGING AUTOMÁTICAMENTE**
if (typeof window !== 'undefined') {
  // Ejecutar cuando se carga el módulo
  setTimeout(() => {
    logEnvironmentInfo();
    validateEnvironmentConfig();
  }, 100);
}