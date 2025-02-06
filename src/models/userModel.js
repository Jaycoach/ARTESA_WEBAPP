const pool = require('../config/db');
const bcrypt = require('bcrypt');

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

module.exports = {
    createUser,
};