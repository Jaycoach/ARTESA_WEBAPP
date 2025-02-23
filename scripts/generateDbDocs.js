const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Configuración inicial
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10)
});

// Consultas SQL
const queries = {
    // Consulta para obtener información básica de columnas
    columns: `
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
    `,
    
    // Consulta para obtener constraints (incluyendo primary keys)
    constraints: `
        SELECT 
            tc.table_name,
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            CASE 
                WHEN tc.constraint_type = 'FOREIGN KEY' THEN
                    ccu.table_name
            END as referenced_table,
            CASE 
                WHEN tc.constraint_type = 'FOREIGN KEY' THEN
                    ccu.column_name
            END as referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name;
    `,
    
    // Consulta para obtener índices
    indexes: `
        SELECT 
            tablename as table_name,
            indexname as index_name,
            indexdef as index_definition
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
    `,
    
    // Consulta para obtener vistas relacionadas
    views: `
        SELECT 
            views.table_name as view_name,
            views.view_definition,
            array_agg(DISTINCT dep.referenced_table_name) as referenced_tables
        FROM information_schema.views views
        LEFT JOIN (
            SELECT DISTINCT
                dependent_ns.nspname as dependent_schema,
                dependent_view.relname as dependent_view,
                source_ns.nspname as referenced_schema,
                source_table.relname as referenced_table_name
            FROM pg_depend
            JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
            JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
            JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid
            JOIN pg_namespace dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
            JOIN pg_namespace source_ns ON source_table.relnamespace = source_ns.oid
            WHERE source_ns.nspname = 'public'
            AND dependent_ns.nspname = 'public'
            AND source_table.relkind = 'r'
            AND dependent_view.relkind = 'v'
        ) dep ON views.table_name = dep.dependent_view
        WHERE views.table_schema = 'public'
        GROUP BY views.table_name, views.view_definition;
    `
};

async function getTableData() {
    const data = {
        columns: [],
        constraints: [],
        indexes: [],
        views: []
    };

    try {
        for (const [key, query] of Object.entries(queries)) {
            const { rows } = await pool.query(query);
            data[key] = rows;
        }
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        throw error;
    }

    return data;
}

function generateMarkdown(data) {
    let markdown = `# Documentación de la Base de Datos\n\n`;
    markdown += `Base de datos: ${process.env.DB_DATABASE}\n`;
    markdown += `Fecha de generación: ${new Date().toLocaleString()}\n\n`;
    markdown += `## Índice\n\n`;

    // Agrupar datos por tabla
    const tableGroups = {};
    data.columns.forEach(row => {
        if (!tableGroups[row.table_name]) {
            tableGroups[row.table_name] = {
                columns: [],
                constraints: [],
                indexes: [],
                relatedViews: []
            };
        }
        tableGroups[row.table_name].columns.push(row);
    });

    // Agregar constraints
    data.constraints.forEach(constraint => {
        if (tableGroups[constraint.table_name]) {
            tableGroups[constraint.table_name].constraints.push(constraint);
        }
    });

    // Agregar índices
    data.indexes.forEach(index => {
        if (tableGroups[index.table_name]) {
            tableGroups[index.table_name].indexes.push(index);
        }
    });

    // Agregar vistas relacionadas
    data.views.forEach(view => {
        if (Array.isArray(view.referenced_tables)) {
            view.referenced_tables.forEach(tableName => {
                if (tableGroups[tableName]) {
                    tableGroups[tableName].relatedViews.push(view);
                }
            });
        }
    });

    // Generar índice
    Object.keys(tableGroups).sort().forEach(tableName => {
        markdown += `- [Tabla: ${tableName}](#tabla-${tableName.toLowerCase().replace(/_/g, '-')})\n`;
    });
    markdown += `\n---\n\n`;

    // Generar documentación para cada tabla
    for (const [tableName, tableData] of Object.entries(tableGroups)) {
        markdown += `## Tabla: ${tableName}\n\n`;

        // Columnas
        markdown += `### Columnas\n\n`;
        markdown += `| Columna | Tipo | Nullable | Default | Descripción |\n`;
        markdown += `|---------|------|----------|----------|-------------|\n`;
        tableData.columns.forEach(column => {
            markdown += `| ${column.column_name} | ${column.data_type} | ${column.is_nullable} | ${column.column_default || '-'} | ${column.column_description || '-'} |\n`;
        });
        markdown += `\n`;

        // Constraints
        if (tableData.constraints.length > 0) {
            markdown += `### Constraints\n\n`;
            markdown += `| Nombre | Tipo | Columnas | Referencia |\n`;
            markdown += `|--------|------|----------|------------|\n`;
            tableData.constraints.forEach(constraint => {
                const reference = constraint.referenced_table 
                    ? `${constraint.referenced_table}(${constraint.referenced_column})`
                    : '-';
                markdown += `| ${constraint.constraint_name} | ${constraint.constraint_type} | ${constraint.column_name} | ${reference} |\n`;
            });
            markdown += `\n`;
        }

        // Índices
        if (tableData.indexes.length > 0) {
            markdown += `### Índices\n\n`;
            markdown += `| Nombre | Definición |\n`;
            markdown += `|--------|------------|\n`;
            tableData.indexes.forEach(index => {
                markdown += `| ${index.index_name} | ${index.index_definition} |\n`;
            });
            markdown += `\n`;
        }

        // Vistas relacionadas
        if (tableData.relatedViews.length > 0) {
            markdown += `### Vistas Relacionadas\n\n`;
            markdown += `| Nombre | Definición |\n`;
            markdown += `|--------|------------|\n`;
            tableData.relatedViews.forEach(view => {
                markdown += `| ${view.view_name} | ${view.view_definition.replace(/\n/g, ' ')} |\n`;
            });
            markdown += `\n`;
        }

        markdown += `---\n\n`;
    }

    return markdown;
}

async function generateDocs() {
    try {
        // Obtener todos los datos necesarios
        const data = await getTableData();

        // Generar el markdown
        const markdown = generateMarkdown(data);

        // Guardar el archivo
        const docsPath = path.resolve(__dirname, '../docs');
        if (!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath);
        }
        
        const filePath = path.join(docsPath, 'database-structure.md');
        fs.writeFileSync(filePath, markdown);
        
        console.log(`Documentación generada exitosamente en: ${filePath}`);
    } catch (error) {
        console.error('Error generando la documentación:', error);
    } finally {
        await pool.end();
    }
}

generateDocs();