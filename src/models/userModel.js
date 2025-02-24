const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('UserModel');

// Crear usuario
const createUser = async (name, mail, password, rol_id) => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `
            INSERT INTO users (name, mail, password, rol_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [name, mail, hashedPassword, rol_id];
        const { rows } = await pool.query(query, values);
        logger.info('Usuario creado exitosamente', { userId: rows[0].id });
        return rows[0];
    } catch (error) {
        logger.error('Error al crear usuario', { error: error.message });
        throw error;
    }
};

// Buscar usuario por email
const findByEmail = async (mail) => {
    try {
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
    } catch (error) {
        logger.error('Error al buscar usuario por email', { 
            error: error.message,
            mail 
        });
        throw error;
    }
};

// Buscar usuario por ID
const findById = async (id) => {
    try {
        const query = `
            SELECT * FROM users 
            WHERE id = $1;
        `;
        const values = [id];
        const { rows } = await pool.query(query, values);
        return rows[0];
    } catch (error) {
        logger.error('Error al buscar usuario por ID', { 
            error: error.message,
            userId: id 
        });
        throw error;
    }
};

// Verificar contraseña
const verifyPassword = async (password, hashedPassword) => {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        logger.error('Error al verificar contraseña', { 
            error: error.message 
        });
        throw error;
    }
};

// Actualizar usuario
const updateUser = async (id, updateData) => {
    try {
        const allowedUpdates = ['name', 'mail', 'password', 'rol_id'];
        const updates = [];
        const values = [];
        let paramCount = 1;

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
        logger.info('Usuario actualizado exitosamente', { userId: id });
        return rows[0];
    } catch (error) {
        logger.error('Error al actualizar usuario', { 
            error: error.message,
            userId: id 
        });
        throw error;
    }
};

// Eliminar usuario
const deleteUser = async (id) => {
    try {
        const query = `
            DELETE FROM users 
            WHERE id = $1 
            RETURNING *;
        `;
        const values = [id];
        const { rows } = await pool.query(query, values);
        logger.info('Usuario eliminado exitosamente', { userId: id });
        return rows[0];
    } catch (error) {
        logger.error('Error al eliminar usuario', { 
            error: error.message,
            userId: id 
        });
        throw error;
    }
};

// Obtener todos los usuarios
const getAllUsers = async () => {
    try {
        const query = `
            SELECT id, name, mail, rol_id, created_at, updated_at 
            FROM users 
            ORDER BY created_at DESC;
        `;
        const { rows } = await pool.query(query);
        return rows;
    } catch (error) {
        logger.error('Error al obtener todos los usuarios', { 
            error: error.message 
        });
        throw error;
    }
};

// Actualizar contraseña
const updatePassword = async (userId, hashedPassword) => {
    try {
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
        logger.error('Error al actualizar contraseña', {
            userId,
            error: error.message,
            stack: error.stack
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