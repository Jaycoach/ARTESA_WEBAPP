const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const multer = require('multer');
const aws = require('aws-sdk');
const path = require('path');
const cors = require('cors');

const app = express();
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const secureProductRoutes = require('./src/routes/secureProductRoutes');
const PORT = process.env.PORT || 3000;

// Configuración de CORS - Agregar esto antes de otras configuraciones de middleware
app.use(cors({
    origin: '*', // En producción, deberías especificar los dominios permitidos
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true, // Permite credenciales
    maxAge: 86400 // Caché preflight por 24 horas
}));

// Configuración de Multer (Local y S3)
let upload;

if (process.env.NODE_ENV === 'production') {
  // Configuración para AWS S3
  const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.AWS_S3_BUCKET_NAME,
      acl: 'public-read',
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        cb(null, Date.now().toString() + path.extname(file.originalname));
      },
    }),
  });
} else {
  // Configuración local
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });

  upload = multer({ storage: storage });
}

// Middleware para Swagger y JSON
app.use(express.json());

// Ruta para subir imágenes
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo' });
  }

  let imageUrl;
  if (process.env.NODE_ENV === 'production') {
    imageUrl = req.file.location;
  } else {
    imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  }

  res.json({ imageUrl });
});

// Servir archivos estáticos desde la carpeta "uploads" (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static('uploads'));
}

// Rutas de la API
app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', secureProductRoutes);

//verificación rutas
console.log('Rutas registradas:', app._router.stack
  .filter(r => r.route || r.name === 'router')
  .map(r => {
    if (r.route) {
      return {
        path: r.route.path,
        methods: Object.keys(r.route.methods)
      };
    } else {
      return {
        name: r.name,
        handle: r.handle.name,
        regexp: r.regexp.toString()
      };
    }
  }));

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});