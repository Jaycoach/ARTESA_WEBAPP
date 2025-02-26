const express = require('express');
const path = require('path');
const expressJSDocSwagger = require('express-jsdoc-swagger');

const app = express();

// Configuración básica para probar
const options = {
  info: {
    version: '1.0.0',
    title: 'DEBUG API',
    description: 'API para depuración',
  },
  baseDir: path.join(__dirname, '../src'),
  filesPattern: [
    './routes/**/*.js',
    './controllers/**/*.js',
    './models/**/*.js'
  ],
  swaggerUIPath: '/api-docs',
  exposeApiDocs: true,
  apiDocsPath: '/swagger.json',
};

// Inicializar Swagger
expressJSDocSwagger(app)(options);

// Ruta de prueba con documentación JSDoc
/**
 * GET /test
 * @summary Endpoint de prueba
 * @tags Debug
 * @return {object} 200 - Respuesta exitosa
 */
app.get('/test', (req, res) => {
  res.json({ message: 'Test successful' });
});

// Iniciar servidor
const PORT = 3100;
app.listen(PORT, () => {
  console.log(`Servidor de depuración en http://localhost:${PORT}`);
  console.log(`Documentación API en http://localhost:${PORT}/api-docs`);
});