/**
 * @typedef {Object} User
 * @property {number} id - ID único del usuario
 * @property {string} name - Nombre completo del usuario
 * @property {string} mail - Correo electrónico del usuario (único)
 * @property {string} password - Contraseña encriptada del usuario
 * @property {number} rol_id - ID del rol asignado al usuario
 * @property {boolean} is_active - Indica si el usuario está activo
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de última actualización
 */

/**
 * @typedef {Object} UserInput
 * @property {string} name - Nombre completo del usuario
 * @property {string} mail - Correo electrónico del usuario
 * @property {string} password - Contraseña en texto plano
 * @property {number} [rol_id=2] - ID del rol (2 es usuario regular por defecto)
 */

/**
 * @typedef {Object} UserPublic
 * @property {number} id - ID único del usuario
 * @property {string} name - Nombre completo del usuario
 * @property {string} mail - Correo electrónico del usuario
 * @property {number} rol_id - ID del rol
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de última actualización
 * @property {boolean} is_active - Indica si el usuario está activo
 */

const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { createContextLogger } = require('../config/logger');

// Crear una instancia del logger con contexto
const logger = createContextLogger('UserModel');

/**
 * Crea un nuevo usuario
 * @async
 * @param {string} name - Nombre completo del usuario
 * @param {string} mail - Correo electrónico del usuario
 * @param {string} password - Contraseña en texto plano
 * @param {number} rol_id - ID del rol asignado al usuario
 * @returns {Promise<UserPublic>} Usuario creado (sin el campo password)
 * @throws {Error} Si ocurre un error al crear el usuario
 */
const createUser = async (name, mail, password, rol_id) => {
    try {
        logger.debug('Iniciando creación de usuario', { mail, rol_id });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `
            INSERT INTO users (name, mail, password, rol_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, mail, rol_id, created_at, updated_at, is_active;
        `;
        const values = [name, mail, hashedPassword, rol_id];
        const { rows } = await pool.query(query, values);
        
        logger.info('Usuario creado exitosamente', { userId: rows[0].id });
        return rows[0];
    } catch (error) {
        logger.error('Error al crear usuario', { error: error.message, mail });
        throw error;
    }
};

/**
 * Busca un usuario por su correo electrónico
 * @async
 * @param {string} mail - Correo electrónico a buscar
 * @returns {Promise<Object|null>} Usuario encontrado o null si no existe
 * @throws {Error} Si ocurre un error en la consulta
 */
const findByEmail = async (mail) => {
    try {
        logger.debug('Buscando usuario por email', { mail });
        
        const query = `
            SELECT 
            id AS user_id, 
            mail 
            FROM users 
            WHERE mail = $1;
        `;
        const values = [mail];
        const { rows } = await pool.query(query, values);
        
        if (rows.length === 0) {
            logger.debug('Usuario no encontrado por email', { mail });
            return null;
        }
        
        logger.debug('Usuario encontrado por email', { userId: rows[0].user_id });
        return rows[0];
    } catch (error) {
        logger.error('Error al buscar usuario por email', { 
            error: error.message,
            mail 
        });
        throw error;
    }
};

/**
 * Busca un usuario por su ID
 * @async
 * @param {number} id - ID del usuario
 * @returns {Promise<User|null>} Usuario encontrado o null si no existe
 * @throws {Error} Si ocurre un error en la consulta
 */
const findById = async (id) => {
    try {
        logger.debug('Buscando usuario por ID', { userId: id });
        
        const query = `
            SELECT * FROM users 
            WHERE id = $1;
        `;
        const values = [id];
        const { rows } = await pool.query(query, values);
        
        if (rows.length === 0) {
            logger.debug('Usuario no encontrado por ID', { userId: id });
            return null;
        }
        
        logger.debug('Usuario encontrado por ID', { userId: id });
        return rows[0];
    } catch (error) {
        logger.error('Error al buscar usuario por ID', { 
            error: error.message,
            userId: id 
        });
        throw error;
    }
};

/**
 * Busca un usuario por su ID, incluyendo información del rol
 * @async
 * @param {number} id - ID del usuario
 * @returns {Promise<Object|null>} Usuario con información de rol o null si no existe
 * @throws {Error} Si ocurre un error en la consulta
 */
const findByIdWithRole = async (id) => {
    try {
        logger.debug('Buscando usuario con rol por ID', { userId: id });
        
        const query = `
            SELECT u.*, r.nombre as role_name 
            FROM users u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.id = $1;
        `;
        const values = [id];
        const { rows } = await pool.query(query, values);
        
        if (rows.length === 0) {
            logger.debug('Usuario no encontrado con rol por ID', { userId: id });
            return null;
        }
        
        logger.debug('Usuario encontrado con rol', { userId: id, role: rows[0].role_name });
        return rows[0];
    } catch (error) {
        logger.error('Error al buscar usuario con rol por ID', { 
            error: error.message,
            userId: id 
        });
        throw error;
    }
};

/**
 * Verifica si una contraseña coincide con su hash
 * @async
 * @param {string} password - Contraseña en texto plano
 * @param {string} hashedPassword - Hash de la contraseña almacenada
 * @returns {Promise<boolean>} true si la contraseña coincide, false en caso contrario
 * @throws {Error} Si ocurre un error en la verificación
 */
const verifyPassword = async (password, hashedPassword) => {
    try {
        const result = await bcrypt.compare(password, hashedPassword);
        logger.debug('Verificación de contraseña', { result });
        return result;
    } catch (error) {
        logger.error('Error al verificar contraseña', { 
            error: error.message 
        });
        throw error;
    }
};

/**
 * Actualiza la información de un usuario
 * @async
 * @param {number} id - ID del usuario a actualizar
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<User|null>} Usuario actualizado o null si no existe o no hay cambios
 * @throws {Error} Si ocurre un error en la actualización
 */
const updateUser = async (id, updateData) => {
    try {
        const allowedUpdates = ['name', 'mail', 'password', 'rol_id', 'is_active'];
        const updates = [];
        const values = [];
        let paramCount = 1;

        // Si hay una contraseña para actualizar, hashearla primero
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }

        Object.keys(updateData).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates.push(`${key} = $${paramCount}`);
                values.push(updateData[key]);
                paramCount++;
            }
        });

        if (updates.length === 0) {
            logger.warn('Intento de actualización sin campos válidos', { userId: id });
            return null;
        }

        values.push(id);
        const query = `
            UPDATE users 
            SET ${updates.join(', ')}, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING id, name, mail, rol_id, created_at, updated_at, is_active;
        `;

        logger.debug('Actualizando usuario', { userId: id, fields: Object.keys(updateData) });
        const { rows } = await pool.query(query, values);
        
        if (rows.length === 0) {
            logger.warn('Usuario no encontrado al actualizar', { userId: id });
            return null;
        }
        
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

/**
 * Elimina un usuario por su ID
 * @async
 * @param {number} id - ID del usuario a eliminar
 * @returns {Promise<User|null>} Usuario eliminado o null si no existe
 * @throws {Error} Si ocurre un error en la eliminación
 */
const deleteUser = async (id) => {
    try {
        logger.debug('Eliminando usuario', { userId: id });
        
        const query = `
            DELETE FROM users 
            WHERE id = $1 
            RETURNING id, name, mail, rol_id, created_at, updated_at, is_active;
        `;
        const values = [id];
        const { rows } = await pool.query(query, values);
        
        if (rows.length === 0) {
            logger.warn('Usuario no encontrado al eliminar', { userId: id });
            return null;
        }
        
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

/**
 * Obtiene todos los usuarios
 * @async
 * @returns {Promise<Array<UserPublic>>} Lista de todos los usuarios (sin contraseñas)
 * @throws {Error} Si ocurre un error en la consulta
 */
const getAllUsers = async () => {
    try {
        logger.debug('Obteniendo todos los usuarios');
        
        const query = `
            SELECT id, name, mail, rol_id, created_at, updated_at, is_active
            FROM users 
            ORDER BY created_at DESC;
        `;
        const { rows } = await pool.query(query);
        
        logger.info('Usuarios obtenidos exitosamente', { count: rows.length });
        return rows;
    } catch (error) {
        logger.error('Error al obtener todos los usuarios', { 
            error: error.message 
        });
        throw error;
    }
};

/**
 * Obtiene todos los usuarios con información de sus roles
 * @async
 * @returns {Promise<Array<Object>>} Lista de usuarios con información de roles
 * @throws {Error} Si ocurre un error en la consulta
 */
const getAllUsersWithRoles = async () => {
    try {
        logger.debug('Obteniendo todos los usuarios con roles');
        
        const query = `
            SELECT u.id, u.name, u.mail, u.rol_id, u.created_at, u.updated_at, u.is_active, r.nombre as role_name
            FROM users u
            JOIN roles r ON u.rol_id = r.id
            ORDER BY u.created_at DESC;
        `;
        const { rows } = await pool.query(query);
        
        logger.info('Usuarios con roles obtenidos exitosamente', { count: rows.length });
        return rows;
    } catch (error) {
        logger.error('Error al obtener usuarios con roles', { 
            error: error.message 
        });
        throw error;
    }
};

/**
 * Actualiza la contraseña de un usuario
 * @async
 * @param {number} userId - ID del usuario
 * @param {string} hashedPassword - Hash de la nueva contraseña
 * @returns {Promise<Object>} Resultado de la operación
 * @throws {Error} Si ocurre un error en la actualización o el usuario no existe
 */
const updatePassword = async (userId, hashedPassword) => {
    try {
        logger.debug('Iniciando actualización de contraseña', { userId });
        
        // 1. Verificar que recibimos un hash válido
        if (!hashedPassword || !hashedPassword.startsWith('$2b$')) {
            logger.error('Formato de hash inválido', { userId });
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
            logger.error('Usuario no encontrado al actualizar contraseña', { userId });
            throw new Error('Usuario no encontrado');
        }

        // 3. Verificar que el hash se guardó correctamente
        const updatedUser = result.rows[0];
        if (updatedUser.password !== hashedPassword) {
            logger.error('Verificación de hash fallida después de actualizar', { userId });
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

/**
 * Obtiene usuarios por rol
 * @async
 * @param {number} rolId - ID del rol a filtrar
 * @returns {Promise<Array<UserPublic>>} Lista de usuarios con el rol especificado
 * @throws {Error} Si ocurre un error en la consulta
 */
const getUsersByRole = async (rolId) => {
    try {
        logger.debug('Obteniendo usuarios por rol', { rolId });
        
        const query = `
            SELECT id, name, mail, rol_id, created_at, updated_at, is_active
            FROM users 
            WHERE rol_id = $1
            ORDER BY created_at DESC;
        `;
        const { rows } = await pool.query(query, [rolId]);
        
        logger.info('Usuarios por rol obtenidos exitosamente', { rolId, count: rows.length });
        return rows;
    } catch (error) {
        logger.error('Error al obtener usuarios por rol', { 
            error: error.message,
            rolId
        });
        throw error;
    }
};

module.exports = {
    createUser,
    findByEmail,
    findById,
    findByIdWithRole,
    verifyPassword,
    updateUser,
    deleteUser,
    getAllUsers,
    getAllUsersWithRoles,
    updatePassword,
    getUsersByRole
};