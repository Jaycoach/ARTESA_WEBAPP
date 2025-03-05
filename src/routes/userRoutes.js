const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeBody, sanitizeParams, validateQueryParams } = require('../middleware/security');
const { getUsers, getUserById, updateUser } = require('../controllers/userController');

// Aplicar middleware de seguridad a todas las rutas
router.use(sanitizeBody, sanitizeParams, validateQueryParams);

/**
 * @typedef {object} User
 * @property {number} id - ID del usuario
 * @property {string} username - Nombre del usuario
 * @property {string} email - Correo electrónico del usuario - format:email
 * @property {object} role - Rol del usuario
 * @property {number} role.id - ID del rol
 * @property {string} role.name - Nombre del rol
 * @property {string} createdAt - Fecha de creación - format:date-time
 * @property {boolean} isActive - Estado de activación del usuario
 */

/**
 * @typedef {object} UserResponse
 * @property {string} status - Estado de la operación (success/error)
 * @property {User} data - Datos del usuario
 */

/**
 * @typedef {object} UsersResponse
 * @property {string} status - Estado de la operación (success/error)
 * @property {Array<User>} data - Lista de usuarios
 */

/**
 * Obtener todos los usuarios
 * @route GET /users
 * @group Users - Operaciones relacionadas con usuarios
 * @security bearerAuth
 * @returns {UsersResponse} 200 - Lista de usuarios obtenida exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/users', verifyToken, checkRole([1]), getUsers);

/**
 * Obtener usuario por ID
 * @route GET /users/{id}
 * @group Users - Operaciones relacionadas con usuarios
 * @param {number} id.path.required - ID del usuario
 * @security bearerAuth
 * @returns {UserResponse} 200 - Usuario obtenido exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 404 - Usuario no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.get('/users/:id', verifyToken, getUserById);

/**
 * @typedef {object} UpdateUserRequest
 * @property {string} name - Nuevo nombre del usuario
 * @property {string} mail - Nuevo correo electrónico - format:email
 */

/**
 * Actualizar usuario
 * @route PUT /users/{id}
 * @group Users - Operaciones relacionadas con usuarios
 * @param {number} id.path.required - ID del usuario
 * @param {UpdateUserRequest} request.body - Datos a actualizar
 * @security bearerAuth
 * @returns {UserResponse} 200 - Usuario actualizado exitosamente
 * @returns {object} 401 - No autorizado
 * @returns {object} 403 - No tiene permisos suficientes
 * @returns {object} 404 - Usuario no encontrado
 * @returns {object} 500 - Error interno del servidor
 */
router.put('/users/:id', verifyToken, updateUser);

module.exports = router;