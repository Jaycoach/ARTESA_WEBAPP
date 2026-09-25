const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');
const { sanitizeBody } = require('../middleware/security');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Endpoints para administración del portal
 */

// Configuración para express-fileupload (compartida con backofficeCoreRoutes.js)
const fileUploadOptions = require('../config/adminFileUploadOptions');

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

// Obtener configuración del portal - permitir a todos los usuarios autenticados
router.get('/settings', adminController.getSettings);

// Actualizar configuración del portal - solo administradores (roles 1 y 3)
// sanitizeBody explícito (ya no router.use compartido): esta ruta necesita 3 pasadas
// de escape en total (userRoutes.js:10 + productRoutes.js:88 + esta), en paridad con
// POST /api/backoffice/settings — sin cambios de comportamiento aquí.
router.post('/settings',
  sanitizeBody,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  fileUpload(fileUploadOptions),
  adminController.updateSettings);
  // Gestión de login de sucursales - solo administradores
// Sin sanitizeBody propio: esta ruta escribe client_branches.password.
// userRoutes.js:10 + productRoutes.js:88 ya aplican sanitizeBody 2 veces antes de
// llegar aquí — las mismas 2 pasadas que branchAuthRoutes.js:163 aplica al validar el
// login. Antes, el router.use(sanitizeBody) de este archivo sumaba una 3ra pasada aquí,
// rompiendo esa paridad. Ver hallazgo de doble-escape en docs/CHANGELOG-backoffice-core.md.
router.post('/branches/:branchId/enable-login',
  requirePermission(PERMISSIONS.BRANCH_LOGIN_MANAGE),
  adminController.enableBranchLogin);

// No escribe password ni ningún campo sensible (solo is_login_enabled = false) — no
// depende de ninguna paridad de pasadas, se deja sin sanitizeBody por consistencia con
// enable-login.
router.post('/branches/:branchId/disable-login',
  requirePermission(PERMISSIONS.BRANCH_LOGIN_MANAGE),
  adminController.disableBranchLogin);

module.exports = router;