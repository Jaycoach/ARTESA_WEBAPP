const express = require('express');
const router = express.Router();
const clientBranchController = require('../controllers/clientBranchController');
const { verifyToken, checkRole } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: ClientBranches
 *   description: Endpoints para gestión de sucursales de clientes
 */

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

/**
 * @swagger
 * /api/client-branches/client/{clientId}:
 *   get:
 *     summary: Obtener sucursales por ID de cliente
 *     description: Recupera todas las sucursales asociadas a un cliente
 *     tags: [ClientBranches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del cliente
 *     responses:
 *       200:
 *         description: Lista de sucursales recuperada exitosamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client/:clientId', clientBranchController.getBranchesByClientId);

/**
 * @swagger
 * /api/client-branches/user/{userId}:
 *   get:
 *     summary: Obtener sucursales por ID de usuario
 *     description: Recupera todas las sucursales asociadas al perfil de cliente de un usuario
 *     tags: [ClientBranches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de sucursales recuperada exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para ver estas sucursales
 *       500:
 *         description: Error interno del servidor
 */
router.get('/user/:userId', clientBranchController.getBranchesByUserId);

module.exports = router;