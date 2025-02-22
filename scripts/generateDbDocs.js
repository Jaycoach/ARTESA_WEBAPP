const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Primero verificamos la existencia del archivo .env
const envPath = path.resolve(__dirname, '../.env');
console.log('Ruta actual:', process.cwd());
console.log('Buscando .env en:', envPath);
console.log('¿El archivo existe?:', fs.existsSync(envPath));

// Luego cargamos las variables de entorno
require('dotenv').config({ path: '../.env' });

// Verificamos que las variables se cargaron correctamente
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_PORT:', process.env.DB_PORT);

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10)
});

async function generateDocs() {
    const tableQuery = `
        SELECT 
            table_name,
            column_name,
            data_type,
            column_default,
            is_nullable,
            col_description((table_schema || '.' || table_name)::regclass, ordinal_position) as column_description
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
    `;

    try {
        const { rows } = await pool.query(tableQuery);
        
        // Agrupar por tabla
        const tableGroups = {};
        rows.forEach(row => {
            if (!tableGroups[row.table_name]) {
                tableGroups[row.table_name] = [];
            }
            tableGroups[row.table_name].push(row);
        });

        // Generar contenido markdown
        let markdown = `# Documentación de la Base de Datos\n\n`;
        markdown += `Base de datos: ${process.env.DB_DATABASE}\n\n`;
        markdown += `Fecha de generación: ${new Date().toLocaleString()}\n\n`;

        // Generar documentación para cada tabla
        for (const [tableName, columns] of Object.entries(tableGroups)) {
            markdown += `## Tabla: ${tableName}\n\n`;
            markdown += `### Columnas\n\n`;
            markdown += `| Columna | Tipo | Nullable | Default | Descripción |\n`;
            markdown += `|---------|------|----------|----------|-------------|\n`;
            
            columns.forEach(column => {
                markdown += `| ${column.column_name} | ${column.data_type} | ${column.is_nullable} | ${column.column_default || '-'} | ${column.column_description || '-'} |\n`;
            });
            
            markdown += `\n`;
        }

        // Guardar el archivo
        const docsPath = path.resolve(__dirname, '../docs');
        if (!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath);
        }
        
        const filePath = path.join(docsPath, 'database-structure.md');
        fs.writeFileSync(filePath, markdown);
        
        console.log(`Documentación generada exitosamente en: ${filePath}`);
        
        // Cerrar la conexión
        await pool.end();
    } catch (error) {
        console.error('Error generando la documentación:', error);
        await pool.end();
    }
}

generateDocs();