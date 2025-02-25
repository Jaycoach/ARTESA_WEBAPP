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
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Servidor Local'
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

// Agregar servidores adicionales si están definidos
if (process.env.DEV_NGROK_URL) {
  options.definition.servers.push({
    url: process.env.DEV_NGROK_URL,
    description: 'Servidor Ngrok'
  });
}

if (process.env.PROD_URL) {
  options.definition.servers.push({
    url: process.env.PROD_URL,
    description: 'Servidor de Producción'
  });
}

const specs = swaggerJsdoc(options);

module.exports = specs;