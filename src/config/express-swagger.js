const path = require('path');
const expressJSDocSwagger = require('express-jsdoc-swagger');

// Función para configurar e inicializar Swagger
module.exports = (app) => {
  // Configuración base de Swagger
  const options = {
    info: {
      version: '1.0.0',
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
    baseDir: path.join(__dirname, '..'),
    // Patrones de archivos que contienen anotaciones
    filesPattern: [
      // Asegúrate de que estas rutas sean correctas para tu estructura de proyecto
      './**/*.js', // Esto buscará en todas las carpetas dentro de src
    ],
    // URL donde se servirá la documentación
    swaggerUIPath: '/api-docs',
    // URL donde se servirá el JSON de la API
    exposeApiDocs: true,
    apiDocsPath: '/swagger.json',
    // Personalización de la UI
    swaggerUiOptions: {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: "API LAARTESA - Documentación"
    },
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

  // Retornar la configuración inicializada
  return expressJSDocSwagger(app)(options);
};