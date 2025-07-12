const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Agregar validación de variables de entorno
const validateEnvVariables = () => {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'DB_PORT', 'DB_SSL', 'NODE_ENV'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
  }

  // Validar que el password sea string
  if (typeof process.env.DB_PASSWORD !== 'string') {
    process.env.DB_PASSWORD = String(process.env.DB_PASSWORD);
  }
  // Validar configuración SSL
    if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production') {
        if (!process.env.DB_SSL || process.env.DB_SSL !== 'true') {
            console.warn('Advertencia: DB_SSL debería estar configurado como "true" en staging/production');
        }
    }
};

// Validar antes de crear el pool
validateEnvVariables();

const fs = require('fs');
const { Pool } = require('pg');

// Crear el pool con validación adicional
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD),
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT),
    // Agregar configuración SSL basada en variables de entorno
    ssl: (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production') ? {
        rejectUnauthorized: false,
        checkServerIdentity: false
    } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 1
});

// Agregar manejo de errores del pool
pool.on('error', (err) => {
    console.error('Error inesperado del pool:', err);
});

// Consultas SQL
const queries = {
    // Primero, obtener todas las tablas disponibles
    tables: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    `,
    
    // Obtener información de tipos personalizados (enums, etc.)
    types: `
        SELECT 
            t.typname as type_name,
            pg_catalog.format_type(t.typbasetype, t.typtypmod) as base_type,
            t.typtype as type_type,
            e.enumlabel as enum_value
        FROM pg_type t
        LEFT JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE (t.typtype = 'e' OR t.typtype = 'd') -- enums y dominios
        AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ORDER BY t.typname, e.enumsortorder;
    `,
    
    // Consulta para obtener información básica de columnas
    columns: `
        SELECT 
            c.table_name,
            c.column_name,
            c.data_type,
            c.column_default,
            c.is_nullable,
            col_description((c.table_schema || '.' || c.table_name)::regclass, c.ordinal_position) as column_description,
            CASE 
                WHEN c.data_type = 'USER-DEFINED' THEN
                    (SELECT t.typname FROM pg_type t WHERE t.oid = a.atttypid)
                ELSE NULL
            END as user_defined_type
        FROM information_schema.columns c
        LEFT JOIN pg_catalog.pg_attribute a ON a.attname = c.column_name
        AND a.attrelid = (c.table_schema || '.' || c.table_name)::regclass::oid
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
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
        tables: [],
        types: [],
        columns: [],
        constraints: [],
        indexes: [],
        views: []
    };

    try {
        // Comprobar la conexión y listar los esquemas
        const schemasResult = await pool.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT LIKE 'pg_%' 
            AND schema_name != 'information_schema'
        `);
        
        console.log('Esquemas disponibles:', schemasResult.rows.map(r => r.schema_name));
        
        // Listar todas las tablas para verificar
        const tablesResult = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `);
        
        console.log('Tablas encontradas:', tablesResult.rows.map(r => r.table_name));
        
        // Ejecutar todas las consultas y almacenar los resultados
        for (const [key, query] of Object.entries(queries)) {
            console.log(`Ejecutando consulta para obtener ${key}...`);
            const { rows } = await pool.query(query);
            data[key] = rows;
            console.log(`Obtenidos ${rows.length} registros para ${key}`);
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

    // Sección de tipos personalizados si existen
    if (data.types.length > 0) {
        markdown += `## Tipos Personalizados\n\n`;
        
        // Agrupar por nombre de tipo
        const typeGroups = {};
        data.types.forEach(type => {
            if (!typeGroups[type.type_name]) {
                typeGroups[type.type_name] = {
                    type_name: type.type_name,
                    base_type: type.base_type,
                    type_type: type.type_type,
                    values: []
                };
            }
            if (type.enum_value) {
                typeGroups[type.type_name].values.push(type.enum_value);
            }
        });
        
        // Generar documentación para cada tipo
        Object.values(typeGroups).forEach(type => {
            markdown += `### Tipo: ${type.type_name}\n\n`;
            
            // Para enums, mostrar la lista de valores
            if (type.type_type === 'e' && type.values.length > 0) {
                markdown += `**Tipo de dato:** ENUM\n\n`;
                markdown += `**Valores:**\n\n`;
                markdown += type.values.map(v => `- \`${v}\``).join('\n');
                markdown += `\n\n`;
            } 
            // Para dominios, mostrar el tipo base
            else if (type.type_type === 'd') {
                markdown += `**Tipo de dato:** DOMAIN\n\n`;
                markdown += `**Tipo base:** ${type.base_type}\n\n`;
            }
        });
        
        markdown += `---\n\n`;
    }

    markdown += `## Índice de Tablas\n\n`;

    // Primero construir el índice de tablas completo
    data.tables.forEach(table => {
        markdown += `- [Tabla: ${table.table_name}](#tabla-${table.table_name.toLowerCase().replace(/_/g, '-')})\n`;
    });
    markdown += `\n---\n\n`;

    // Crear mapeo de tabla a columnas, constraints, índices, etc.
    const tableMap = {};
    
    // Inicializar el mapa con todas las tablas
    data.tables.forEach(table => {
        tableMap[table.table_name] = {
            columns: [],
            constraints: [],
            indexes: [],
            relatedViews: []
        };
    });
    
    // Llenar el mapa con los datos
    data.columns.forEach(column => {
        if (tableMap[column.table_name]) {
            tableMap[column.table_name].columns.push(column);
        }
    });
    
    data.constraints.forEach(constraint => {
        if (tableMap[constraint.table_name]) {
            tableMap[constraint.table_name].constraints.push(constraint);
        }
    });
    
    data.indexes.forEach(index => {
        if (tableMap[index.table_name]) {
            tableMap[index.table_name].indexes.push(index);
        }
    });
    
    data.views.forEach(view => {
        if (Array.isArray(view.referenced_tables)) {
            view.referenced_tables.forEach(tableName => {
                if (tableMap[tableName]) {
                    tableMap[tableName].relatedViews.push(view);
                }
            });
        }
    });

    // Generar documentación para cada tabla
    for (const tableName of data.tables.map(t => t.table_name)) {
        if (!tableMap[tableName]) {
            console.warn(`Advertencia: No se encontraron metadatos para la tabla ${tableName}`);
            continue;
        }
        
        const tableData = tableMap[tableName];
        
        markdown += `## Tabla: ${tableName}\n\n`;

        // Columnas
        markdown += `### Columnas\n\n`;
        markdown += `| Columna | Tipo | Nullable | Default | Descripción |\n`;
        markdown += `|---------|------|----------|----------|-------------|\n`;
        tableData.columns.forEach(column => {
            // Si es un tipo personalizado, mostrar eso en lugar del tipo genérico "USER-DEFINED"
            const dataType = column.user_defined_type || column.data_type;
            markdown += `| ${column.column_name} | ${dataType} | ${column.is_nullable} | ${column.column_default || '-'} | ${column.column_description || '-'} |\n`;
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
    let client;
    try {
        // Probar la conexión antes de continuar
        client = await pool.connect();
        console.log('Conexión a la base de datos establecida correctamente');
        client.release();

        // Obtener todos los datos necesarios
        const data = await getTableData();

        // Generar el markdown
        const markdown = generateMarkdown(data);

        // Guardar el archivo
        const docsPath = path.resolve(__dirname, '../docs'); // Cambiar la ruta
        if (!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath, { recursive: true });
        }
        
        const filePath = path.join(docsPath, 'database-structure.md');
        fs.writeFileSync(filePath, markdown);
        
        console.log(`Documentación generada exitosamente en: ${filePath}`);
    } catch (error) {
        console.error('Error en el proceso de generación de documentación:');
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.message.includes('SASL') || error.message.includes('password')) {
            console.error('\nError de autenticación detectado. Verificar:');
            console.log('1. Variables de entorno cargadas:');
            console.log('   DB_HOST:', process.env.DB_HOST);
            console.log('   DB_USER:', process.env.DB_USER);
            console.log('   DB_DATABASE:', process.env.DB_DATABASE);
            console.log('   DB_PORT:', process.env.PORT);
            console.log('   DB_PASSWORD: [OCULTO]');
        }
        
        throw error;
    } finally {
        try {
            await pool.end();
            console.log('Conexión a la base de datos cerrada correctamente');
        } catch (endError) {
            console.error('Error al cerrar el pool:', endError);
        }
    }
}

generateDocs();