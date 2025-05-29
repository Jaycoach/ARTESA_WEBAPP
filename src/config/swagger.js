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
      },
      {
        url: 'http://ec2-44-216-131-63.compute-1.amazonaws.com',
        description: 'Servidor Staging HTTP'
      },
      {
        url: 'https://ec2-44-216-131-63.compute-1.amazonaws.com',
        description: 'Servidor Staging HTTPS'
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
    ],
    servers: [
      {
        url: process.env.NODE_ENV === 'staging' 
          ? 'https://ec2-44-216-131-63.compute-1.amazonaws.com'
          : process.env.NODE_ENV === 'production' 
          ? 'https://ec2-44-216-131-63.compute-1.amazonaws.com'
          : `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.NODE_ENV === 'staging' 
          ? 'Servidor Staging'
          : process.env.NODE_ENV === 'production' 
          ? 'Servidor de Producción'
          : 'Servidor Local'
      },
      {
        url: 'https://ec2-44-216-131-63.compute-1.amazonaws.com',
        description: 'Servidor HTTPS'
      },
      {
        url: 'http://ec2-44-216-131-63.compute-1.amazonaws.com',
        description: 'Servidor HTTP'
      }
    ],
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