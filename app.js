// Archivo principal de la aplicación
require('dotenv').config();

// Importaciones principales
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
const fileUpload = require('express-fileupload');
const ensureJsonResponse = require('./src/middleware/ensureJsonResponse');
const sapServiceManager = require('./src/services/SapServiceManager');
const sapSyncRoutes = require('./src/routes/sapSyncRoutes');
const { logger, createContextLogger } = require('./src/config/logger');
const S3Service = require('./src/services/S3Service');
const orderScheduler = require('./src/services/OrderScheduler');
const clientSyncRoutes = require('./src/routes/clientSyncRoutes');

// Importaciones de middlewares
const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const security = require('./src/middleware/security');
const {
  sensitiveApiLimiter,
  standardApiLimiter,
  enhancedSecurityHeaders,
  suspiciousActivityTracker
} = require('./src/middleware/enhancedSecurity');

// Importaciones de Swagger 
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./src/config/swagger');

// Inicializar la aplicación Express
const app = express();
app.set('trust proxy', true); // trust all proxies for AWS ALB/CloudFront

// Constantes de configuración
const API_PREFIX = '/api';
// Configuración de puerto según el entorno
const getPort = () => {
  // En Docker, usar siempre el puerto desde la variable de entorno
  return process.env.PORT || 3000;
};

const PORT = getPort();

// Crear una instancia del logger para app.js
const appLogger = createContextLogger('App');

// =========================================================================
// FUNCIÓN PARA ASEGURAR DIRECTORIOS
// =========================================================================
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directorio creado: ${dirPath}`);
  }
};

// Crear directorios necesarios
ensureDirectoryExists(path.join(__dirname, 'tmp'));
ensureDirectoryExists(path.join(__dirname, 'uploads'));
ensureDirectoryExists(path.join(__dirname, 'uploads/client-profiles'));
ensureDirectoryExists(path.join(__dirname, 'logs'));

// =========================================================================
// MIDDLEWARES BÁSICOS (NIVEL DE APLICACIÓN)
// =========================================================================

// Seguridad HTTP básica
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"]
    }
  }
}));

// Parsers de cuerpo de solicitud - Debe ir ANTES de los sanitizadores
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger de solicitudes
app.use(morgan('dev'));

// Respuestas en JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// =========================================================================
// CONFIGURACIÓN DE CORS
// =========================================================================
// First, remove the custom middleware that manually sets CORS headers

// Then, update your cors middleware configuration
app.use(cors({
  origin: function(origin, callback) {
    // Log detallado para debugging
    console.log('\n=== CORS DEBUG ===');
    console.log('Origin recibido:', origin);
    console.log('Timestamp:', new Date().toISOString());
    console.log('User-Agent:', arguments[2]?.headers?.['user-agent'] || 'No disponible');
    
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ Permitido: Sin origen (mobile/Postman)');
      return callback(null, true);
    }
    
    // Define allowed origins explicitly
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://192.168.8.165:5173',
      'https://api.artesa.com',
      'https://d1nkfheaf642r6.cloudfront.net', // producción
      'https://d1bqegutwmfn98.cloudfront.net',
      'http://d1bqegutwmfn98.cloudfront.net',
      'https://ec2-44-216-131-63.compute-1.amazonaws.com',
      'http://ec2-44-216-131-63.compute-1.amazonaws.com',
      'https://ec2-44-216-131-63.compute-1.amazonaws.com:3000',
      'http://ec2-44-216-131-63.compute-1.amazonaws.com:3000',
      'http://ec2-44-216-131-63.compute-1.amazonaws.com:80',
      'https://ec2-44-216-131-63.compute-1.amazonaws.com',
      'http://ec2-44-216-131-63.compute-1.amazonaws.com'
    ];
    
    console.log('Orígenes permitidos:', allowedOrigins);
    
    // Agregar orígenes desde variables de entorno
    if (process.env.CORS_ALLOWED_ORIGINS) {
      const envOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
      allowedOrigins.push(...envOrigins);
      console.log('Orígenes adicionales desde ENV:', envOrigins);
    }
    
    // Check if origin matches any allowed origin or is a subdomain we want to allow
    const isDirectlyAllowed = allowedOrigins.includes(origin);
    const isPatternAllowed = origin.includes('localhost') ||
                 origin.includes('ngrok-free.app') ||
                 origin.includes('127.0.0.1') ||
                 origin.includes('ec2-44-216-131-63.compute-1.amazonaws.com') ||
                 origin.includes('cloudfront.net') ||
                 origin.includes('d1bqegutwmfn98.cloudfront.net') ||
                 (origin && origin.match(/^https?:\/\/.*\.cloudfront\.net$/)) ||
                 (origin && origin.match(/^https?:\/\/.*\.amazonaws\.com/));

    console.log('¿Directamente permitido?:', isDirectlyAllowed);
    console.log('¿Permitido por patrón?:', isPatternAllowed);
    
    const isAllowed = isDirectlyAllowed || isPatternAllowed;

    if (isAllowed) {
      console.log('✅ CORS PERMITIDO para:', origin);
      console.log('==================\n');
      callback(null, true);
    } else {
      console.log('❌ CORS RECHAZADO para:', origin);
      // En desarrollo, permitir todo para facilitar pruebas
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Permitiendo en desarrollo de todos modos');
        console.log('==================\n');
        callback(null, true);
      } else {
        console.log('🚫 CORS definitivamente rechazado');
        console.log('==================\n');
        callback(new Error('No permitido por CORS'));
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Bypass-Tunnel-Reminder',
    'ngrok-skip-browser-warning',
    'g-recaptcha-response',
    'recaptchatoken',
    'Accept',
    'Cache-Control',
    'Pragma',
    'Origin',
    'Accept-Language',
    'Accept-Encoding'
  ],
  credentials: true,
  optionsSuccessStatus: 204
}));

// CORS adicional para rutas de autenticación
app.use('/api/auth', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (
    origin.includes('d1bqegutwmfn98.cloudfront.net') ||
    origin.includes('ec2-44-216-131-63.compute-1.amazonaws.com') ||
    origin.includes('localhost')
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, g-recaptcha-response, recaptchatoken');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Middleware de logging específico para rutas de API y Swagger
app.use((req, res, next) => {
  const isApiRoute = req.path.startsWith('/api');
  const isSwaggerRoute = req.path.includes('swagger') || req.path.includes('api-docs');
  
  if (isApiRoute || isSwaggerRoute) {
    console.log('\n=== REQUEST LOG ===');
    console.log('Método:', req.method);
    console.log('Ruta:', req.path);
    console.log('Origin:', req.headers.origin || 'Sin origin');
    console.log('User-Agent:', req.headers['user-agent']?.substring(0, 100) || 'No disponible');
    console.log('Content-Type:', req.headers['content-type'] || 'No especificado');
    console.log('Authorization:', req.headers.authorization ? 'Presente' : 'No presente');
    console.log('Referer:', req.headers.referer || 'No especificado');
    console.log('X-Requested-With:', req.headers['x-requested-with'] || 'No presente');
    console.log('==================\n');
  }
  
  next();
});

// =========================================================================
// CARGA DE ARCHIVOS - Configurado pero NO aplicado globalmente
// =========================================================================
// Configuración para fileUpload
const fileUploadOptions = {
  limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB
  useTempFiles: true,
  tempFileDir: './tmp/',
  parseNested: true,
  abortOnLimit: true,
  responseOnLimit: "Archivo demasiado grande. El límite es de 10MB.",
  debug: process.env.NODE_ENV === 'development',
  createParentPath: true,
  safeFileNames: true
};

// Middleware para manejar errores de express-fileupload
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      message: 'Error de CSRF token'
    });
  }
  
  if (err && err.message && err.message.includes('Unexpected end of form')) {
    return res.status(400).json({
      success: false,
      message: 'Error en el formato del formulario. Asegúrate de que el formulario esté configurado correctamente con enctype="multipart/form-data"'
    });
  }
  
  next(err);
});

// =========================================================================
// MIDDLEWARES DE SEGURIDAD
// =========================================================================

// Aplicar middlewares de seguridad globalmente
app.use(security.securityHeaders);
app.use(security.sanitizeBody);
app.use(security.sanitizeParams);
app.use(security.validateQueryParams);

// Aplicar headers de seguridad mejorados a todas las rutas
app.use(enhancedSecurityHeaders);

// Aplicar tracker de actividad sospechosa
app.use(suspiciousActivityTracker);

// Middleware para asegurar respuestas JSON
app.use(ensureJsonResponse);

// =========================================================================
// ARCHIVOS ESTÁTICOS
// =========================================================================
app.use(`${API_PREFIX}/uploads`, express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =========================================================================
// DOCUMENTACIÓN DE API (SWAGGER)
// =========================================================================
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'],
    url: '/swagger.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    validatorUrl: null,
    requestInterceptor: function(request) {
      console.log('\n=== SWAGGER REQUEST INTERCEPTOR ===');
      console.log('Request URL:', request.url);
      console.log('Request method:', request.method);
      console.log('Request headers:', request.headers);
      console.log('Window location:', window.location.href);
      console.log('============================\n');
      
      // Asegurar que use la URL correcta del servidor
      if (request.url.includes('localhost:3000') && window.location.hostname !== 'localhost') {
        const newUrl = request.url.replace('localhost:3000', window.location.host);
        console.log('🔄 URL modificada de:', request.url, 'a:', newUrl);
        request.url = newUrl;
      }
      
      return request;
    },
    responseInterceptor: function(response) {
      console.log('\n=== SWAGGER RESPONSE INTERCEPTOR ===');
      console.log('Response status:', response.status);
      console.log('Response URL:', response.url);
      console.log('Response headers:', response.headers);
      if (response.status >= 400) {
        console.log('❌ Response error body:', response.body);
        console.log('❌ Response text:', response.text);
      }
      console.log('==============================\n');
      return response;
    },
    onComplete: function() {
      console.log('✅ Swagger UI cargado exitosamente');
      console.log('Current URL:', window.location.href);
      console.log('Base URL detected:', window.location.origin);
    },
    onFailure: function(error) {
      console.error('❌ Error cargando Swagger UI:', error);
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .opblock .opblock-summary-control {
      display: flex;
      align-items: center;
    }
    .swagger-ui .btn-group {
      display: flex;
      flex-direction: row;
      align-items: center;
    }
    .swagger-ui .try-out {
      margin-right: 8px;
    }
    .swagger-ui .btn {
      margin: 0 5px;
    }
    .swagger-ui .opblock .try-out__btn {
      margin-right: 10px;
    }
    .swagger-ui .try-out {
      position: relative;
      z-index: 1;
    }
    .swagger-ui .try-out__btn {
      z-index: 2;
    }
    .swagger-ui .btn-cancel {
      z-index: 2;
    }
  `,
  customSiteTitle: "API LAARTESA - Documentación",
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, swaggerUiOptions));

// Mejorar el endpoint de swagger.json con CORS
app.get('/swagger.json', (req, res) => {
  console.log('\n=== SWAGGER.JSON REQUEST ===');
  console.log('Origin:', req.headers.origin);
  console.log('Referer:', req.headers.referer);
  console.log('User-Agent:', req.headers['user-agent']?.substring(0, 80));
  console.log('Accept:', req.headers.accept);
  console.log('Method:', req.method);
  console.log('URL completa:', req.url);
  console.log('Query params:', req.query);
  
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log('✅ Enviando swagger.json exitosamente');
    console.log('========================\n');
    
    res.send(swaggerSpecs);
  } catch (error) {
    console.log('❌ Error enviando swagger.json:', error.message);
    console.log('========================\n');
    res.status(500).json({ error: 'Error generando swagger.json' });
  }
});

// =========================================================================
// RATE LIMITING - Antes de las rutas de API
// =========================================================================
// Aplicar rate limiting solo en producción o configurar límites más altos en desarrollo
if (process.env.NODE_ENV === 'production') {
  app.use(`${API_PREFIX}/auth`, sensitiveApiLimiter);
  app.use(`${API_PREFIX}/secure`, sensitiveApiLimiter);
  // No aplicar standardApiLimiter a todas las rutas en producción
  app.use(`${API_PREFIX}/payments`, sensitiveApiLimiter);
} else {
  // En desarrollo, aplicar limiters con configuración muy permisiva
  // o no aplicarlos para evitar problemas durante el desarrollo
  console.log('Rate limiting configurado en modo permisivo para desarrollo');
}

// Alternativa: especificar rutas que NO deben tener rate limiting en desarrollo
const excludedFromRateLimit = [
  `${API_PREFIX}/admin`,
  `${API_PREFIX}/orders`,
  `${API_PREFIX}/products`
];
// Middleware que solo aplica rate limiting si la ruta no está excluida
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && 
      excludedFromRateLimit.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }
  return standardApiLimiter(req, res, next);
});
// =========================================================================
// IMPORTACIÓN DE RUTAS
// =========================================================================
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const secureProductRoutes = require('./src/routes/secureProductRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const passwordResetRoutes = require('./src/routes/passwordResetRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const clientProfileRoutes = require('./src/routes/clientProfileRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const clientBranchRoutes = require('./src/routes/clientBranchRoutes');

// =========================================================================
// RUTAS DE LA API
// =========================================================================
// Health check endpoint para Elastic Beanstalk (debe ir antes de otras rutas)
app.get('/api/health', (req, res) => {
  console.log('\n=== HEALTH CHECK ===');
  console.log('Origin:', req.headers.origin || 'Sin origin');
  console.log('User-Agent:', req.headers['user-agent']?.substring(0, 50) || 'No disponible');
  console.log('===================\n');
  
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    cors_debug: {
      origin: req.headers.origin,
      allowed_origins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || []
    }
  });
});
// Endpoint específico para debugging CORS
app.get('/api/cors-debug', (req, res) => {
  console.log('\n=== CORS DEBUG ENDPOINT ===');
  console.log('Headers completos:', JSON.stringify(req.headers, null, 2));
  console.log('========================\n');
  
  res.json({
    origin: req.headers.origin,
    referer: req.headers.referer,
    userAgent: req.headers['user-agent'],
    allHeaders: req.headers,
    environment: process.env.NODE_ENV,
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || [],
    timestamp: new Date().toISOString()
  });
});
app.use(API_PREFIX, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(API_PREFIX, productRoutes);
app.use(API_PREFIX, secureProductRoutes);
app.use(API_PREFIX, orderRoutes);
app.use(`${API_PREFIX}/client-branches`, clientBranchRoutes);
app.use(`${API_PREFIX}/client-branches`, require('./src/routes/clientBranchRoutes'));
// Nueva ruta para SAP
app.use(`${API_PREFIX}/sap`, sapSyncRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/client-sync`, clientSyncRoutes);

// Aplicamos fileUpload sólo a las rutas específicas que lo necesitan
app.use(`${API_PREFIX}/upload`, fileUpload(fileUploadOptions), uploadRoutes);
app.use(`${API_PREFIX}/client-profiles`, fileUpload(fileUploadOptions), clientProfileRoutes);

// Rutas que no necesitan fileUpload
app.use(`${API_PREFIX}/password`, passwordResetRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);

// Ruta de prueba/estado para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'API LA ARTESA funcionando correctamente', 
    version: '1.2.1',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

// =========================================================================
// MANEJO DE RUTAS NO ENCONTRADAS - Siempre después de todas las rutas
// =========================================================================
app.use(notFound);

// =========================================================================
// MIDDLEWARE DE ERRORES - Siempre al final
// =========================================================================
app.use(errorHandler);

// =========================================================================
// INICIALIZACIÓN DE SERVICIOS
// =========================================================================
// Inicializar gestor de servicios SAP
appLogger.info('Iniciando gestor de servicios SAP');
sapServiceManager.initialize()
  .then(() => {
    appLogger.info('Gestor de servicios SAP iniciado exitosamente');
  })
  .catch(error => {
    logger.error('Error al iniciar gestor de servicios SAP', {
      error: error.message,
      stack: error.stack
    });
  });

// Inicializar servicio S3
if (process.env.STORAGE_MODE === 's3') {
  logger.info('Inicializando servicio S3');
  S3Service.initialize();
} else {
  logger.info('Usando almacenamiento local para archivos');
}

// Inicializar servicio de programación de órdenes
logger.info('Inicializando servicio de programación de órdenes');
orderScheduler.initialize()
  .then(() => {
    logger.info('Servicio de programación de órdenes iniciado exitosamente');
  })
  .catch(error => {
    logger.error('Error al iniciar servicio de programación de órdenes', {
      error: error.message,
      stack: error.stack
    });
  });

// =========================================================================
// INICIAR SERVIDOR
// =========================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`Servidor LA ARTESA iniciado en http://localhost:${PORT}`);
  console.log(`Documentación API: http://localhost:${PORT}/api-docs`);
  console.log(`Swagger JSON: http://localhost:${PORT}/swagger.json`);
  console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=======================================================`);
});

module.exports = app;
// Manejo de señales del sistema para Elastic Beanstalk
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando servidor gracefully');
  process.exit(0);
});