const pool = require('../config/db');
const Roles = require('../models/Roles');
const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('UserController');

const getUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.mail, u.rol_id, u.created_at, u.is_active, r.nombre as role_name
      FROM users u
      JOIN roles r ON u.rol_id = r.id
      ORDER BY u.created_at DESC
    `);

    const sanitizedUsers = rows.map(user => ({
      id: user.id,
      username: user.name,
      email: user.mail,
      role: {
        id: user.rol_id,
        name: user.role_name
      },
      createdAt: user.created_at,
      isActive: user.is_active
    }));

    return res.status(200).json({
      status: 'success',
      data: sanitizedUsers
    });
  } catch (err) {
    logger.error('Error en getUsers:', err);
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

    // Verificar si el usuario es administrador
    const adminRoleId = await Roles.getRoleId('ADMIN');
    const isAdmin = requestingUser.rol_id === adminRoleId;

    if (requestingUser.id !== parseInt(id) && !isAdmin) {
      logger.warn('Intento de acceso no autorizado a información de usuario', {
        requestingUserId: requestingUser.id,
        targetUserId: id
      });
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para ver esta información'
      });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.mail, u.rol_id, u.created_at, u.is_active, r.nombre as role_name
       FROM users u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
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
        role: {
          id: user.rol_id,
          name: user.role_name
        },
        createdAt: user.created_at,
        isActive: user.is_active
      }
    });
  } catch (err) {
    logger.error('Error en getUserById:', err);
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

    // Verificar si el usuario es administrador
    const adminRoleId = await Roles.getRoleId('ADMIN');
    const isAdmin = requestingUser.rol_id === adminRoleId;

    if (requestingUser.id !== parseInt(id) && !isAdmin) {
      logger.warn('Intento de actualización no autorizada', {
        requestingUserId: requestingUser.id,
        targetUserId: id
      });
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
       RETURNING id, name, mail, rol_id, updated_at`,
      [name, mail, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    // Obtener el nombre del rol
    const { rows: roleRows } = await pool.query(
      'SELECT nombre FROM roles WHERE id = $1',
      [rows[0].rol_id]
    );

    const updatedUser = {
      ...rows[0],
      role: {
        id: rows[0].rol_id,
        name: roleRows[0]?.nombre
      }
    };

    logger.info('Usuario actualizado exitosamente', {
      userId: updatedUser.id,
      updatedFields: { name, mail }
    });

    return res.status(200).json({
      status: 'success',
      data: updatedUser
    });
  } catch (err) {
    logger.error('Error en updateUser:', err);
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