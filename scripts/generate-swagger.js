require('dotenv').config();
const fs = require('fs');
const path = require('path');
const swaggerConfig = require('../src/config/swagger');

// Directorio de salida para el archivo de Swagger
const outputDir = path.join(__dirname, '../public');
const outputFile = path.join(outputDir, 'swagger.json');

// Asegurarnos de que el directorio de salida existe
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Escribir el archivo de especificación Swagger
fs.writeFileSync(outputFile, JSON.stringify(swaggerConfig, null, 2));

console.log(`Archivo Swagger generado exitosamente en: ${outputFile}`);
