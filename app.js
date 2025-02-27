// Archivo principal de la aplicación
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./src/middleware/errorMiddleware');
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

// Inicializar la aplicación Express
const app = express();

// Importar rutas
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const secureProductRoutes = require('./src/routes/secureProductRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const passwordResetRoutes = require('./src/routes/passwordResetRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const clientProfileRoutes = require('./src/routes/clientProfileRoutes'); // Importamos las nuevas rutas

// Prefix para todas las rutas de la API
const API_PREFIX = '/api';
const PORT = process.env.PORT || 3000;

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
  customCss: `
    .swagger-ui .topbar { display: none }
    /* Arreglar posicionamiento de botones */
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
    /* Asegurar que los botones no se superpongan */
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

// Configuración de middlewares
app.use(helmet()); // Seguridad HTTP
app.use(express.json()); // Parsear solicitudes JSON
app.use(express.urlencoded({ extended: true })); // Parsear datos de formulario
app.use(morgan('dev')); // Logging

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use(API_PREFIX, clientProfileRoutes); // Registramos las nuevas rutas de perfil de cliente

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'API running successfully' });
});

// Middleware para manejar errores
app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Documentación API disponible en http://localhost:${PORT}/api-docs`);
  console.log(`Especificación Swagger disponible en http://localhost:${PORT}/swagger.json`);
});

module.exports = app;