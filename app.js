const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const multer = require('multer');
const aws = require('aws-sdk');
const path = require('path');
const app = express();
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const PORT = process.env.PORT || 3000;

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
      acl: 'public-read', // Permite acceso público a los archivos
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        cb(null, Date.now().toString() + path.extname(file.originalname)); // Nombre del archivo
      },
    }),
  });
} else {
  // Configuración local
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Carpeta donde se guardarán las imágenes
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)); // Nombre del archivo
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

  // Devuelve la URL de la imagen
  let imageUrl;
  if (process.env.NODE_ENV === 'production') {
    imageUrl = req.file.location; // URL de S3
  } else {
    imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`; // URL local
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

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
