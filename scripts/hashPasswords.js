// scripts/hashPasswords.js
require('dotenv').config(); // Asegúrate de cargar las variables de entorno
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function hashAllPlainPasswords() {
    try {
        console.log('Iniciando proceso de actualización de contraseñas...');
        
        // Obtener todos los usuarios con contraseñas sin encriptar
        const result = await pool.query('SELECT id, mail, password FROM users WHERE password NOT LIKE \'$2b$%\'');
        
        console.log(`Se encontraron ${result.rows.length} usuarios con contraseñas sin encriptar.`);

        for (const user of result.rows) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            await pool.query(
                'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [hashedPassword, user.id]
            );
            console.log(`✓ Actualizada contraseña para usuario: ${user.mail} (ID: ${user.id})`);
        }
        
        console.log('\n¡Proceso completado! Todas las contraseñas han sido encriptadas.');
    } catch (error) {
        console.error('Error actualizando contraseñas:', error);
    } finally {
        await pool.end();
    }
}

// Ejecutar el script
hashAllPlainPasswords();