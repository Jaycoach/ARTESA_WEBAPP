const pool = require('../config/db');

const getUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, mail, rol_id, created_at, is_active 
      FROM users
      ORDER BY created_at DESC
    `);

    const sanitizedUsers = rows.map(user => ({
      id: user.id,
      username: user.name,
      email: user.mail,
      role: user.rol_id,
      createdAt: user.created_at,
      isActive: user.is_active
    }));

    return res.status(200).json({
      status: 'success',
      data: sanitizedUsers
    });
  } catch (err) {
    console.error('Error en getUsers:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    if (requestingUser.id !== parseInt(id) && requestingUser.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para ver esta información'
      });
    }

    const { rows } = await pool.query(
      'SELECT id, name, mail, rol_id, created_at, is_active FROM users WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const user = rows[0];
    return res.status(200).json({
      status: 'success',
      data: {
        id: user.id,
        username: user.name,
        email: user.mail,
        role: user.rol_id,
        createdAt: user.created_at,
        isActive: user.is_active
      }
    });
  } catch (err) {
    console.error('Error en getUserById:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    const { name, mail } = req.body;

    if (requestingUser.id !== parseInt(id) && requestingUser.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para actualizar esta información'
      });
    }

    const { rows } = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           mail = COALESCE($2, mail),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, mail, updated_at`,
      [name, mail, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const updatedUser = rows[0];
    return res.status(200).json({
      status: 'success',
      data: updatedUser
    });
  } catch (err) {
    console.error('Error en updateUser:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser
};