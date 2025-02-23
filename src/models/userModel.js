const pool = require('../config/db');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');

// Crear usuario
const createUser = async (name, mail, password, rol_id) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
        INSERT INTO users (name, mail, password, rol_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const values = [name, mail, hashedPassword, rol_id];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Buscar usuario por email
const findByEmail = async (mail) => {
    const query = `
        SELECT 
        id AS user_id, 
        mail 
        FROM users 
        WHERE mail = $1;
    `;
    const values = [mail];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Buscar usuario por ID
const findById = async (id) => {
    const query = `
        SELECT * FROM users 
        WHERE id = $1;
    `;
    const values = [id];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Verificar contraseña
const verifyPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

// Actualizar usuario
const updateUser = async (id, updateData) => {
    const allowedUpdates = ['name', 'mail', 'password', 'rol_id'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámica
    Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
            updates.push(`${key} = $${paramCount}`);
            values.push(updateData[key]);
            paramCount++;
        }
    });

    if (updates.length === 0) return null;

    values.push(id);
    const query = `
        UPDATE users 
        SET ${updates.join(', ')}, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *;
    `;

    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Eliminar usuario
const deleteUser = async (id) => {
    const query = `
        DELETE FROM users 
        WHERE id = $1 
        RETURNING *;
    `;
    const values = [id];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Obtener todos los usuarios
const getAllUsers = async () => {
    const query = `
        SELECT id, name, mail, rol_id, created_at, updated_at 
        FROM users 
        ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
};

// Actualizar contraseña
// En userModel.js

const updatePassword = async (userId, hashedPassword) => {
    // 1. Verificar que recibimos un hash válido
    if (!hashedPassword || !hashedPassword.startsWith('$2b$')) {
        throw new Error('Invalid password hash format');
    }

    // 2. Actualizar en la base de datos
    const query = `
        UPDATE users 
        SET 
            password = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, mail, password, updated_at
    `;

    try {
        const result = await pool.query(query, [hashedPassword, userId]);
        
        if (result.rows.length === 0) {
            throw new Error('Usuario no encontrado');
        }

        // 3. Verificar que el hash se guardó correctamente
        const updatedUser = result.rows[0];
        if (updatedUser.password !== hashedPassword) {
            throw new Error('Hash verification failed after update');
        }

        logger.info('Contraseña actualizada exitosamente', {
            userId,
            updatedAt: result.rows[0].updated_at
        });

        return result;
    } catch (error) {
        logger.error('Error al actualizar contraseña:', {
            userId,
            error: error.message
        });
        throw error;
    }
};

module.exports = {
    createUser,
    findByEmail,
    findById,
    verifyPassword,
    updateUser,
    deleteUser,
    getAllUsers,
    updatePassword
};