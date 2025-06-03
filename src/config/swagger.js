const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LAARTESA API',
      version: '1.1.0',
      description: 'Documentación de la API para WEB APP LA ARTESA',
      license: {
        name: 'Privada',
      },
    },
    servers: [
      {
        url: 'http://ec2-44-216-131-63.compute-1.amazonaws.com',
        description: 'Servidor Staging HTTP (Recomendado para Swagger)'
      },
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Servidor Local de Desarrollo'
      },
      {
        url: 'https://ec2-44-216-131-63.compute-1.amazonaws.com',
        description: 'Servidor Staging HTTPS (Certificado autofirmado)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingrese el token JWT en el formato: Bearer <token>'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  // Archivos a escanear para anotaciones
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js',
    './src/config/swagger-definitions.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;