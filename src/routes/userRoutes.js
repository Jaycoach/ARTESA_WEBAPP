const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeBody, sanitizeParams, validateQueryParams } = require('../middleware/security');
const { getUsers, getUserById, updateUser } = require('../controllers/userController');

// Aplicar middleware de seguridad a todas las rutas
router.use(sanitizeBody, sanitizeParams, validateQueryParams);

// Rutas específicas
router.get('/users', verifyToken, checkRole([1]), getUsers); // usando ID del rol
router.get('/users/:id', verifyToken, getUserById);
router.put('/users/:id', verifyToken, updateUser);

module.exports = router;