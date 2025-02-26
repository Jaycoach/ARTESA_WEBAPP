const path = require('path');
const expressJSDocSwagger = require('express-jsdoc-swagger');

// Función para configurar e inicializar Swagger
module.exports = (app) => {
  // Configuración base de Swagger
  const options = {
    info: {
      version: '1.1.0',
      title: 'LAARTESA API',
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
    security: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el token JWT en el formato: Bearer <token>'
      },
    },
    baseDir: path.join(__dirname, '..'),// Cambiado para apuntar al directorio raíz del proyecto
    // Patrones de archivos que contienen anotaciones
    filesPattern: [
      './**/*.js'
    ],
    // URL donde se servirá la documentación
    swaggerUIPath: '/api-docs',
    // URL donde se servirá el JSON de la API
    exposeApiDocs: true,
    swaggerUIPath: '/api-docs',
    exposeApiDocs: true,
    apiDocsPath: '/swagger.json',
    swaggerUiOptions: {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: "API LAARTESA - Documentación",
      docExpansion: 'none',      // Expandir/colapsar por defecto
      deepLinking: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      filter: true,
      persistAuthorization: true,
      tryItOutEnabled: true,     // Habilitar el botón "Try it out" por defecto
      displayRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: 'agate'
      }
    },
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    showExtensions: true,
    defaultModelRendering: 'model',
    displayRequestDuration: true,
    displayOperationId: false,
  };

  // Actualiza los servidores si está disponible en las variables de entorno
  if (process.env.DEV_NGROK_URL) {
    options.servers.push({
      url: process.env.DEV_NGROK_URL,
      description: 'Servidor Ngrok'
    });
  }

  if (process.env.PROD_URL) {
    options.servers.push({
      url: process.env.PROD_URL,
      description: 'Servidor de Producción'
    });
  }

  // Inicializar y retornar la configuración
  return expressJSDocSwagger(app)(options);
};