const express = require('express');
const router = express.Router();
const branchRegistrationController = require('../controllers/branchRegistrationController');
const { sanitizeBody } = require('../middleware/security');

/**
 * @swagger
 * /api/branch-registration/check-email:
 *   post:
 *     summary: Verificar si email de sucursal existe y necesita registro
 *     tags: [BranchRegistration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email verificado exitosamente
 *       404:
 *         description: Email no encontrado en sucursales
 */
router.post('/check-email', sanitizeBody, branchRegistrationController.checkEmail);

/**
 * @swagger
 * /api/branch-registration/register:
 *   post:
 *     summary: Registrar contraseña para sucursal
 *     tags: [BranchRegistration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               manager_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registro exitoso
 *       400:
 *         description: Sucursal ya tiene contraseña configurada
 *       404:
 *         description: Sucursal no encontrada
 */
router.post('/register', sanitizeBody, branchRegistrationController.register);

module.exports = router;