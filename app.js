require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const multer = require('multer');
const aws = require('aws-sdk');
const path = require('path');
const cors = require('cors');
const security = require('./src/middleware/security');

const app = express();
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const passwordResetRoutes = require('./src/routes/passwordResetRoutes');
const PORT = process.env.PORT || 3000;

// Configuración de CORS mejorada
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.DEV_NGROK_URL,
      process.env.PROD_URL
    ].filter(Boolean);

    // Permitir solicitudes sin origen (como las de Postman)
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

// Configuración base de la API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prefix todas las rutas de la API
const API_PREFIX = '/api';

// Rutas con prefijo - aseguramos que las rutas internas no dupliquen el prefijo
app.use(API_PREFIX, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(API_PREFIX, productRoutes);
app.use(API_PREFIX, orderRoutes);
app.use('/api/password', passwordResetRoutes);

// Configuración de Multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// Ruta de upload con el prefijo API
app.post(`${API_PREFIX}/upload`, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo' });
  }

  const imageUrl = `${req.protocol}://${req.get('host')}${API_PREFIX}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Servir archivos estáticos
app.use(`${API_PREFIX}/uploads`, express.static('uploads'));

// Configuración de Swagger
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    urls: [
      {
        url: `${API_PREFIX}/swagger.json`,
        name: 'Default'
      }
    ]
  }
};

// Rutas de Swagger - mantenemos la ruta original /api-docs
app.get('/swagger.json', (req, res) => {
  res.json(swaggerDocument);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  swaggerOptions: {
    url: '/swagger.json'
  }
}));

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
  console.log(`Documentación API disponible en http://localhost:${PORT}${API_PREFIX}/docs`);
});