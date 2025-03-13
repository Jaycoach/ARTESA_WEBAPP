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
const sapIntegrationService = require('./src/services/SapIntegrationService');
const sapSyncRoutes = require('./src/routes/sapSyncRoutes');
const { logger, createContextLogger } = require('./src/config/logger');
const S3Service = require('./src/services/S3Service');

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
app.set('trust proxy', 1); // trust first proxy

// Constantes de configuración
const API_PREFIX = '/api';
const PORT = process.env.PORT || 3000;

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
      "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"]
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
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.DEV_NGROK_URL,
      process.env.PROD_URL
    ].filter(Boolean);

    // Permitir solicitudes sin origen (como las de Postman o Swagger UI)
    if (!origin) return callback(null, true);
    
    // Comprueba si es localhost o contiene ngrok-free.app
    if (allowedOrigins.includes(origin) || 
        origin.includes('ngrok-free.app') || 
        origin.includes('localhost')) {
      callback(null, true);
    } else {
      console.log('CORS rechazado para origen:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Content-Type', 'Bypass-Tunnel-Reminder', 'ngrok-skip-browser-warning'],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middleware para manejar errores CORS
app.use((err, req, res, next) => {
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({
      success: false,
      message: 'Acceso no permitido por CORS',
      origin: req.headers.origin
    });
  }
  next(err);
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
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// =========================================================================
// RATE LIMITING - Antes de las rutas de API
// =========================================================================
app.use(`${API_PREFIX}/auth`, sensitiveApiLimiter);
app.use(`${API_PREFIX}/secure`, sensitiveApiLimiter);
app.use(API_PREFIX, standardApiLimiter);

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

// =========================================================================
// RUTAS DE LA API
// =========================================================================
app.use(API_PREFIX, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(API_PREFIX, productRoutes);
app.use(API_PREFIX, secureProductRoutes);
app.use(API_PREFIX, orderRoutes);
// Nueva ruta para SAP
app.use(`${API_PREFIX}/sap`, sapSyncRoutes);

// Aplicamos fileUpload sólo a las rutas específicas que lo necesitan
app.use(`${API_PREFIX}/upload`, fileUpload(fileUploadOptions), uploadRoutes);
app.use(`${API_PREFIX}/client-profiles`, fileUpload(fileUploadOptions), clientProfileRoutes);

// Rutas que no necesitan fileUpload
app.use(`${API_PREFIX}/password`, passwordResetRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);

// Ruta de prueba/estado para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ 
    message: 'API LA ARTESA funcionando correctamente', 
    version: '1.2.1',
    timestamp: new Date().toISOString()
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
// Inicializar servicio de integración con SAP B1 (si está configurado)
if (process.env.SAP_SERVICE_LAYER_URL) {
  appLogger.info('Iniciando servicio de integración con SAP B1');
  
  sapIntegrationService.initialize()
    .then(() => {
      appLogger.info('Servicio de integración con SAP B1 iniciado exitosamente');
    })
    .catch(error => {
      logger.error('Error al iniciar servicio de integración con SAP B1', {
        error: error.message,
        stack: error.stack
      });
    });
} else {
  appLogger.info('Integración con SAP B1 no configurada');
}

// Inicializar servicio S3
if (process.env.STORAGE_MODE === 's3') {
  logger.info('Inicializando servicio S3');
  S3Service.initialize();
} else {
  logger.info('Usando almacenamiento local para archivos');
}

// =========================================================================
// INICIAR SERVIDOR
// =========================================================================
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Servidor LA ARTESA iniciado en http://localhost:${PORT}`);
  console.log(`Documentación API: http://localhost:${PORT}/api-docs`);
  console.log(`Swagger JSON: http://localhost:${PORT}/swagger.json`);
  console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=======================================================`);
});

module.exports = app;