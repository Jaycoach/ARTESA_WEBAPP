const express = require('express');
const router = express.Router();
const branchDashboardController = require('../controllers/branchDashboardController');
const { verifyBranchToken } = require('../middleware/auth');
const { sanitizeParams, sanitizeQuery } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: BranchDashboard
 *   description: Dashboard y estadísticas para sucursales
 */

// Aplicar middleware de autenticación de sucursales a todas las rutas
router.use(verifyBranchToken);

// Aplicar sanitización de parámetros y query strings
router.use(sanitizeParams, sanitizeQuery);

// MOVER esta sección al principio, ANTES de las rutas con parámetros
/**
 * @swagger
 * /api/branch-dashboard/products:
 *   get:
 *     summary: Obtener productos disponibles para la sucursal
 *     description: Recupera la lista de productos con precios específicos para el cliente de la sucursal
 *     tags: [BranchDashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, código SAP o descripción
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: Filtrar por categoría (sap_group)
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Solo productos activos
 *     responses:
 *       200:
 *         description: Lista de productos obtenida exitosamente
 *       401:
 *         description: No autorizado - Token de sucursal inválido
 *       500:
 *         description: Error interno del servidor
 */
router.get('/products', branchDashboardController.getProductsForBranch);