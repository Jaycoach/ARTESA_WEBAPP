import sass from 'sass';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Función para compilar un archivo SCSS a CSS
function compileSass(inputFile) {
  try {
    const outputFile = inputFile.replace('.scss', '.css');
    
    // Compilar el SCSS a CSS con source maps
    const result = sass.compile(inputFile, {
      sourceMap: true,
      sourceMapIncludeSources: true,
      style: 'expanded',
      outFile: outputFile
    });

    // Guardar el CSS compilado
    fs.writeFileSync(outputFile, result.css);
    
    // Guardar el source map
    if (result.sourceMap) {
      fs.writeFileSync(`${outputFile}.map`, JSON.stringify(result.sourceMap));
    }

    console.log(`Compilado: ${inputFile} -> ${outputFile}`);
  } catch (error) {
    console.error(`Error al compilar ${inputFile}:`, error.message);
  }
}

// Encontrar todos los archivos SCSS en el proyecto
const scssFiles = await glob('src/**/*.scss');

// Compilar cada archivo SCSS
scssFiles.forEach(compileSass);

console.log('Compilación completada!');