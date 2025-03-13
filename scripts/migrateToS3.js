/**
 * Script para migrar archivos locales a S3
 * Uso: node scripts/migrateToS3.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const S3Service = require('../src/services/S3Service');

// Configuración
const uploadDir = path.join(__dirname, '../uploads');
const simulationMode = process.argv.includes('--simulation');

// Inicializar pool de conexión
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT
});

// Forzar modo S3
if (process.env.STORAGE_MODE !== 's3') {
  console.warn('Forzando STORAGE_MODE=s3 para la migración');
  process.env.STORAGE_MODE = 's3';
  S3Service.localMode = false;
  S3Service.initialize();
}

// Función principal
async function migrateFilesToS3() {
  console.log(`Iniciando migración ${simulationMode ? '(SIMULACIÓN)' : ''}`);
  
  try {
    const stats = {
      totalFiles: 0,
      uploadedToS3: 0,
      updatedInDb: 0,
      errors: 0
    };
    
    // Migrar imágenes de productos
    await migrateProductImages(stats);
    
    // Migrar documentos de perfiles de clientes
    await migrateClientProfileDocuments(stats);
    
    // Migrar archivos generales
    await migrateGeneralFiles(stats);
    
    console.log('\nMigración completada:');
    console.log(`- Total de archivos procesados: ${stats.totalFiles}`);
    console.log(`- Archivos subidos a S3: ${stats.uploadedToS3}`);
    console.log(`- Registros actualizados en BD: ${stats.updatedInDb}`);
    console.log(`- Errores: ${stats.errors}`);
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    await pool.end();
  }
}

// Función para migrar imágenes de productos
async function migrateProductImages(stats) {
  console.log('\nMigrando imágenes de productos...');
  
  try {
    // Obtener todos los productos con URLs de imágenes locales
    const { rows: products } = await pool.query(
      "SELECT product_id, image_url FROM products WHERE image_url LIKE '/uploads/%' OR image_url LIKE 'uploads/%'"
    );
    
    console.log(`Encontrados ${products.length} productos con imágenes locales`);
    
    for (const product of products) {
      try {
        stats.totalFiles++;
        
        // Extraer ruta local del archivo
        const localPath = product.image_url.replace(/^\/uploads\/|^uploads\//, '');
        const fullPath = path.join(uploadDir, localPath);
        
        // Verificar si el archivo existe
        if (!fs.existsSync(fullPath)) {
          console.warn(`Archivo no encontrado: ${fullPath} (producto ID: ${product.product_id})`);
          stats.errors++;
          continue;
        }
        
        // Crear clave para S3
        const key = `products/${product.product_id}/${path.basename(localPath)}`;
        
        console.log(`Migrando imagen de producto ${product.product_id}: ${localPath} -> ${key}`);
        
        if (!simulationMode) {
          // Leer archivo y subir a S3
          const fileContent = fs.readFileSync(fullPath);
          const contentType = getContentType(fullPath);
          
          // Subir a S3
          const s3Url = await S3Service.uploadFile(fileContent, key, contentType, { 
            public: true 
          });
          
          // Actualizar URL en la base de datos
          await pool.query(
            'UPDATE products SET image_url = $1 WHERE product_id = $2',
            [s3Url, product.product_id]
          );
          
          stats.uploadedToS3++;
          stats.updatedInDb++;
        } else {
          console.log(`[SIMULACIÓN] Se subiría ${fullPath} a S3 como ${key}`);
        }
      } catch (error) {
        console.error(`Error al migrar imagen del producto ${product.product_id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error al migrar imágenes de productos:', error);
    throw error;
  }
}

// Función para migrar documentos de perfiles de clientes
async function migrateClientProfileDocuments(stats) {
  console.log('\nMigrando documentos de perfiles de clientes...');
  
  try {
    // Obtener todos los perfiles con documentos locales
    const { rows: profiles } = await pool.query(`
      SELECT 
        client_id, 
        user_id, 
        fotocopia_cedula as "fotocopiaCedula", 
        fotocopia_rut as "fotocopiaRut", 
        anexos_adicionales as "anexosAdicionales"
      FROM client_profiles 
      WHERE 
        fotocopia_cedula LIKE '/uploads/%' OR 
        fotocopia_cedula LIKE 'uploads/%' OR
        fotocopia_rut LIKE '/uploads/%' OR 
        fotocopia_rut LIKE 'uploads/%' OR
        anexos_adicionales LIKE '/uploads/%' OR 
        anexos_adicionales LIKE 'uploads/%'
    `);
    
    console.log(`Encontrados ${profiles.length} perfiles con documentos locales`);
    
    for (const profile of profiles) {
      try {
        // Procesar cada tipo de documento
        const documentTypes = [
          { field: 'fotocopiaCedula', type: 'cedula' },
          { field: 'fotocopiaRut', type: 'rut' },
          { field: 'anexosAdicionales', type: 'anexos' }
        ];
        
        for (const { field, type } of documentTypes) {
          if (!profile[field]) continue;
          
          if (profile[field].startsWith('/uploads/') || profile[field].startsWith('uploads/')) {
            stats.totalFiles++;
            
            // Extraer ruta local del archivo
            const localPath = profile[field].replace(/^\/uploads\/|^uploads\//, '');
            const fullPath = path.join(uploadDir, localPath);
            
            // Verificar si el archivo existe
            if (!fs.existsSync(fullPath)) {
              console.warn(`Archivo no encontrado: ${fullPath} (perfil ID: ${profile.client_id}, tipo: ${type})`);
              stats.errors++;
              continue;
            }
            
            // Crear clave para S3
            const key = `client-profiles/${profile.user_id}/${type}/${path.basename(localPath)}`;
            
            console.log(`Migrando documento ${type} de cliente ${profile.client_id}: ${localPath} -> ${key}`);
            
            if (!simulationMode) {
              // Leer archivo y subir a S3
              const fileContent = fs.readFileSync(fullPath);
              const contentType = getContentType(fullPath);
              
              // Subir a S3 (documentos privados)
              const s3Url = await S3Service.uploadFile(fileContent, key, contentType, { 
                public: false 
              });
              
              // Construir actualización
              const updateQuery = `
                UPDATE client_profiles 
                SET ${field === 'fotocopiaCedula' ? 'fotocopia_cedula' : 
                     field === 'fotocopiaRut' ? 'fotocopia_rut' : 
                     'anexos_adicionales'} = $1 
                WHERE client_id = $2
              `;
              
              // Actualizar URL en la base de datos
              await pool.query(updateQuery, [s3Url, profile.client_id]);
              
              stats.uploadedToS3++;
              stats.updatedInDb++;
            } else {
              console.log(`[SIMULACIÓN] Se subiría ${fullPath} a S3 como ${key}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error al migrar documentos del perfil ${profile.client_id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error al migrar documentos de perfiles:', error);
    throw error;
  }
}

// Función para migrar archivos generales
async function migrateGeneralFiles(stats) {
  console.log('\nMigrando archivos generales...');
  
  try {
    // Recorrer directorio de uploads y migrar archivos que no fueron procesados en otras categorías
    const processedPaths = new Set();
    
    // Función recursiva para recorrer directorios
    const processDirectory = async (dir, baseDir = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(baseDir, entry.name);
        
        if (entry.isDirectory()) {
          // Ignorar directorios de productos y perfiles ya procesados
          if (entry.name === 'products' || entry.name === 'client-profiles') {
            continue;
          }
          
          await processDirectory(fullPath, relativePath);
        } else {
          // Si es un archivo, migrarlo
          if (!processedPaths.has(relativePath)) {
            stats.totalFiles++;
            
            // Crear clave para S3
            const key = `general/${relativePath}`;
            
            console.log(`Migrando archivo general: ${relativePath} -> ${key}`);
            
            if (!simulationMode) {
              try {
                // Leer archivo y subir a S3
                const fileContent = fs.readFileSync(fullPath);
                const contentType = getContentType(fullPath);
                
                // Subir a S3 (archivos generales son públicos)
                await S3Service.uploadFile(fileContent, key, contentType, { 
                  public: true 
                });
                
                stats.uploadedToS3++;
                // No hay registros en BD que actualizar
              } catch (error) {
                console.error(`Error al migrar archivo general ${relativePath}:`, error);
                stats.errors++;
              }
            } else {
              console.log(`[SIMULACIÓN] Se subiría ${fullPath} a S3 como ${key}`);
            }
          }
        }
      }
    };
    
    await processDirectory(uploadDir);
  } catch (error) {
    console.error('Error al migrar archivos generales:', error);
    throw error;
  }
}

// Función auxiliar para determinar el tipo de contenido
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// Ejecutar la migración
migrateFilesToS3().catch(console.error);