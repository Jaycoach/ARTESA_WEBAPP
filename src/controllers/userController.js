const pool = require('../config/db');

const getUsers = async (req, res) => {
  try {
    console.log('Iniciando consulta de usuarios');
    const { rows } = await pool.query('SELECT * FROM users');
    console.log('Usuarios encontrados:', rows.length);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUsers
};