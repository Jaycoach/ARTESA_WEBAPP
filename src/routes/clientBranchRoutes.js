const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const { sanitizeParams } = require('../middleware/security');
const { getBranchesByClientId, getBranchesByUserId } = require('../controllers/clientBranchController');

// Aplicar middleware de sanitización a todas las rutas
router.use(sanitizeParams);

/**
 * @swagger
 * tags:
 *   name: ClientBranches
 *   description: Endpoints para gestión de sucursales de clientes
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ClientBranch:
 *       type: object
 *       properties:
 *         branch_id:
 *           type: integer
 *           description: ID único de la sucursal
 *           example: 1
 *         client_id:
 *           type: integer
 *           description: ID del cliente asociado
 *           example: 44
 *         ship_to_code:
 *           type: string
 *           description: Código de dirección de envío en SAP
 *           example: "PRINCIPAL"
 *         branch_name:
 *           type: string
 *           description: Nombre de la sucursal
 *           example: "Sede Principal"
 *         address:
 *           type: string
 *           description: Dirección física
 *           example: "Calle 123 #45-67"
 *         city:
 *           type: string
 *           description: Ciudad
 *           example: "Bogotá"
 *         state:
 *           type: string
 *           description: Estado o departamento
 *           example: "Cundinamarca"
 *         country:
 *           type: string
 *           description: País
 *           example: "Colombia"
 *         zip_code:
 *           type: string
 *           description: Código postal
 *           example: "110111"
 *         phone:
 *           type: string
 *           description: Teléfono de contacto
 *           example: "+57 3001234567"
 *         contact_person:
 *           type: string
 *           description: Persona de contacto
 *           example: "Juan Pérez"
 *         is_default:
 *           type: boolean
 *           description: Indica si es la sucursal por defecto
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 */

/**
 * @swagger
 * /api/client-branches/client/{clientId}:
 *   get:
 *     summary: Obtener sucursales por ID de cliente
 *     description: Recupera todas las sucursales asociadas a un cliente específico
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClientBranch'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos suficientes
 *       500:
 *         description: Error interno del servidor
 */
router.get('/client/:clientId', 
  verifyToken, 
  checkRole([1]), // Solo administradores pueden ver sucursales por client_id
  getBranchesByClientId
);

/**
 * @swagger
 * /api/client-branches/user/{userId}:
 *   get:
 *     summary: Obtener sucursales por ID de usuario
 *     description: Recupera todas las sucursales asociadas a un usuario específico
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClientBranch'
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Prohibido - No tiene permisos para ver estas sucursales
 *       500:
 *         description: Error interno del servidor
 */
router.get('/user/:userId', 
  verifyToken, 
  getBranchesByUserId
);

module.exports = router;