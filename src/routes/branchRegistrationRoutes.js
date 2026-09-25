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
// Sin sanitizeBody propio (a diferencia de /check-email): esta ruta escribe
// client_branches.password. userRoutes.js:10 + productRoutes.js:88 (ambos montados en
// /api a secas, ver hallazgo de doble-escape en docs/CHANGELOG-backoffice-core.md) ya
// aplican sanitizeBody 2 veces antes de llegar aquí — exactamente las mismas 2 pasadas
// que branchAuthRoutes.js:163 (branchAuthController.login) aplica al validar. Un
// sanitizeBody adicional aquí rompía esa paridad (3 escrituras vs. 2 en login),
// bloqueando el login de cualquier sucursal cuya contraseña tuviera '/', '&', '<', '>',
// '"' o '\''.
router.post('/register', branchRegistrationController.register);

module.exports = router;