const pool = require('../config/db');
const Roles = require('../models/Roles');
const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('UserController');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Identificador único del usuario
 *           example: 1
 *         username:
 *           type: string
 *           description: Nombre completo del usuario
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *           example: john@example.com
 *         role:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               description: ID del rol
 *               example: 2
 *             name:
 *               type: string
 *               description: Nombre del rol
 *               example: USER
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de creación del usuario
 *         isActive:
 *           type: boolean
 *           description: Indica si el usuario está activo
 *           example: true
 *         clientProfile:
 *           type: object
 *           nullable: true
 *           description: Perfil de cliente asociado al usuario
 *           properties:
 *             price_list:
 *               type: integer
 *               description: ID de la lista de precios
 *               example: 1
 *             price_list_code:
 *               type: string
 *               description: Código de la lista de precios
 *               example: "ORO"
 *
 *     UserResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           $ref: '#/components/schemas/User'
 *     
 *     UsersResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *     
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Nuevo nombre del usuario
 *           example: John Updated Doe
 *         mail:
 *           type: string
 *           format: email
 *           description: Nuevo correo electrónico del usuario
 *           example: john.updated@example.com
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Obtener todos los usuarios
 *     description: Recupera la lista de todos los usuarios (requiere rol de administrador)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios recuperada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersResponse'
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos de administrador
 *       500:
 *         description: Error interno del servidor
 */
const getUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.mail, u.rol_id, u.created_at, u.is_active, r.nombre as role_name,
       cp.price_list, cp.price_list_code
      FROM users u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
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
      isActive: user.is_active,
      clientProfile: user.price_list || user.price_list_code ? {
        price_list: user.price_list,
        price_list_code: user.price_list_code
      } : null
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

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     description: Recupera los detalles de un usuario específico (el propio usuario o requiere rol de administrador)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a consultar
 *     responses:
 *       200:
 *         description: Detalles del usuario recuperados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para ver este usuario
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error interno del servidor
 */
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
      `SELECT u.id, u.name, u.mail, u.rol_id, u.created_at, u.is_active, r.nombre as role_name,
       cp.price_list, cp.price_list_code
      FROM users u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
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
        isActive: user.is_active,
        clientProfile: user.price_list || user.price_list_code ? {
          price_list: user.price_list,
          price_list_code: user.price_list_code
        } : null
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

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Actualizar un usuario
 *     description: Actualiza los datos de un usuario existente (el propio usuario o requiere rol de administrador)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: John Updated Doe
 *                     mail:
 *                       type: string
 *                       example: john.updated@example.com
 *                     role:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 2
 *                         name:
 *                           type: string
 *                           example: USER
 *       401:
 *         description: No autorizado - Token no proporcionado o inválido
 *       403:
 *         description: Prohibido - Sin permisos para actualizar este usuario
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error interno del servidor
 */
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
      `WITH updated_user AS (
        UPDATE users 
        SET name = COALESCE($1, name),
            mail = COALESCE($2, mail),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, name, mail, rol_id, updated_at
      )
      SELECT u.id, u.name, u.mail, u.rol_id, u.updated_at,
            cp.price_list, cp.price_list_code
      FROM updated_user u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id`,
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
      },
      clientProfile: rows[0].price_list || rows[0].price_list_code ? {
        price_list: rows[0].price_list,
        price_list_code: rows[0].price_list_code
      } : null
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