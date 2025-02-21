const pool = require('../config/db');
const bcrypt = require('bcrypt');

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
        SELECT * FROM users 
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
        WHERE user_id = $1;
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
        WHERE user_id = $${paramCount}
        RETURNING *;
    `;

    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Eliminar usuario
const deleteUser = async (id) => {
    const query = `
        DELETE FROM users 
        WHERE user_id = $1 
        RETURNING *;
    `;
    const values = [id];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Obtener todos los usuarios
const getAllUsers = async () => {
    const query = `
        SELECT user_id, name, mail, rol_id, created_at, updated_at 
        FROM users 
        ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
};

module.exports = {
    createUser,
    findByEmail,
    findById,
    verifyPassword,
    updateUser,
    deleteUser,
    getAllUsers
};