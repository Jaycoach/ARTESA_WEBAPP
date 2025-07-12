const express = require('express');
const router = express.Router();
const branchAuthController = require('../controllers/branchAuthController');
const { verifyBranchToken } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: BranchAuth
 *   description: Autenticación de sucursales
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BranchLoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico de la sucursal
 *           example: sucursal@cliente.com
 *         password:
 *           type: string
 *           format: password
 *           description: Contraseña de la sucursal
 *           example: password123
 *     
 *     BranchLoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Login exitoso
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               description: JWT token para autenticación
 *             branch:
 *               type: object
 *               properties:
 *                 branch_id:
 *                   type: integer
 *                   example: 1
 *                 email:
 *                   type: string
 *                   example: sucursal@cliente.com
 *                 manager_name:
 *                   type: string
 *                   example: Juan Pérez
 *                 branch_name:
 *                   type: string
 *                   example: Sucursal Norte
 *                 client_name:
 *                   type: string
 *                   example: Cliente ABC
 *                 type:
 *                   type: string
 *                   example: branch
 */

/**
 * @swagger
 * /api/branch-auth/login:
 *   post:
 *     summary: Login de sucursal
 *     description: Autentica una sucursal y devuelve un token JWT
 *     tags: [BranchAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BranchLoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BranchLoginResponse'
 *       401:
 *         description: Credenciales inválidas
 *       423:
 *         description: Cuenta bloqueada temporalmente
 *       429:
 *         description: Demasiados intentos de login
 *       500:
 *         description: Error interno del servidor
 */
router.post('/login', 
  branchAuthController.branchLoginLimiter,
  sanitizeBody,
  branchAuthController.login
);

/**
 * @swagger
 * /api/branch-auth/logout:
 *   post:
 *     summary: Logout de sucursal
 *     description: Cierra la sesión de la sucursal y revoca el token
 *     tags: [BranchAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout exitoso
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.post('/logout', verifyBranchToken, branchAuthController.logout);

/**
 * @swagger
 * /api/branch-auth/profile:
 *   get:
 *     summary: Obtener perfil de sucursal
 *     description: Recupera la información del perfil de la sucursal autenticada
 *     tags: [BranchAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Datos de la sucursal
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Sucursal no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get('/profile', verifyBranchToken, branchAuthController.getProfile);

module.exports = router;