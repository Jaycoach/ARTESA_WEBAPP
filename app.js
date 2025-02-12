const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const multer = require('multer');
const aws = require('aws-sdk');
const path = require('path');
const { pool } = require('./src/config/db');
const Order = require('./src/models/Order');

const app = express();
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');

const PORT = process.env.PORT || 3000;

// Configuración de Multer y AWS S3
const configureMulter = () => {
  if (process.env.NODE_ENV === 'production') {
    const s3 = new aws.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    return multer({
      storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        metadata: (req, file, cb) => {
          cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
          cb(null, Date.now().toString() + path.extname(file.originalname));
        },
      }),
    });
  } else {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, 'uploads/');
      },
      filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
      },
    });
    return multer({ storage: storage });
  }
};

// Inicialización de la base de datos
async function initializeDatabase() {
  try {
    // Verificar conexión
    await pool.query('SELECT 1');
    console.log('✅ Conexión a la base de datos establecida');

    // Verificar secuencia de órdenes
    const lastId = await Order.getLastOrderId();
    console.log(`📝 La secuencia de órdenes está en: ${lastId}`);

  } catch (error) {
    console.error('❌ Error durante la inicialización de la base de datos:', error);
    throw error;
  }
}

// Configuración de la aplicación
async function configureApp() {
  const upload = configureMulter();

  // Middleware para Swagger y JSON
  app.use(express.json());

  // Ruta para subir imágenes
  app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha subido ningún archivo' });
    }

    const imageUrl = process.env.NODE_ENV === 'production'
      ? req.file.location
      : `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.json({ imageUrl });
  });

  // Servir archivos estáticos en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    app.use('/uploads', express.static('uploads'));
  }

  // Rutas de la API
  app.use('/api', userRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', productRoutes);
  app.use('/api', orderRoutes);

  // Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Manejador de errores global
  app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err);
    res.status(500).json({
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });
}

// Iniciar el servidor
async function startServer() {
  try {
    await initializeDatabase();
    await configureApp();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📚 Documentación API disponible en http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa no manejada:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

// Iniciar la aplicación
startServer();