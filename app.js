require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const security = require('./src/middleware/security');

// Importaciones de Swagger 
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./src/config/swagger');

const {
  sensitiveApiLimiter,
  standardApiLimiter,
  enhancedSecurityHeaders,
  suspiciousActivityTracker
} = require('./src/middleware/enhancedSecurity');

const app = express();
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const secureProductRoutes = require('./src/routes/secureProductRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const passwordResetRoutes = require('./src/routes/passwordResetRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const PORT = process.env.PORT || 3000;

// Prefix para todas las rutas de la API
const API_PREFIX = '/api';

// Configurar opciones de Swagger UI
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true, // Habilitar el botón Try It Out por defecto
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'],
  },
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "API LAARTESA - Documentación",
};

// Configuración base de la API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de CORS mejorada
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.DEV_NGROK_URL,
      process.env.PROD_URL
    ].filter(Boolean);

    // Permitir solicitudes sin origen (como las de Postman o Swagger UI)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('ngrok-free.app')) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middleware para manejar errores CORS
app.use((err, req, res, next) => {
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({
      message: 'Acceso no permitido por CORS',
      origin: req.headers.origin
    });
  }
  next(err);
});

// Aplicar middlewares de seguridad globalmente
app.use(security.securityHeaders);
app.use(security.sanitizeBody);
app.use(security.sanitizeParams);
app.use(security.validateQueryParams);

// Aplicar headers de seguridad mejorados a todas las rutas
app.use(enhancedSecurityHeaders);

// Aplicar tracker de actividad sospechosa
app.use(suspiciousActivityTracker);

// Aplicar rate limiting según el tipo de ruta
app.use(`${API_PREFIX}/auth`, sensitiveApiLimiter);
app.use(`${API_PREFIX}/secure`, sensitiveApiLimiter);
app.use(API_PREFIX, standardApiLimiter);

// Asegurar que el directorio de uploads exista
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir archivos estáticos desde la carpeta uploads
app.use(`${API_PREFIX}/uploads`, express.static('uploads'));

// Configurar Swagger UI - Colocamos esto después de la configuración CORS y de seguridad
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, swaggerUiOptions));

// Exponer el JSON de Swagger para herramientas externas
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Rutas de la API con prefijo
app.use(API_PREFIX, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(API_PREFIX, productRoutes);
app.use(API_PREFIX, secureProductRoutes);
app.use(API_PREFIX, orderRoutes);
app.use(API_PREFIX, uploadRoutes); // Rutas para la gestión de uploads
app.use(`${API_PREFIX}/password`, passwordResetRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Documentación API disponible en http://localhost:${PORT}/api-docs`);
  console.log(`Especificación Swagger disponible en http://localhost:${PORT}/swagger.json`);
});