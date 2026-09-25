// src/routes/backofficeCoreRoutes.js
// Montado en /api/backoffice (app.js, archivo 8). Núcleo del BackOffice: usuarios de
// plataforma, clientes (D7), configuración y sincronizaciones — todo por delegación o
// lógica propia del núcleo, nunca lógica de pedidos (clase C, permanece en el branch
// pausado). Cada ruta replica EXACTAMENTE la cadena de middlewares de su ruta original
// (fileUpload/sanitizeBody/sanitizeParams), reemplazando solo la autorización
// (checkRole/authorize) por verifyToken + requirePermission.
const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');

const { verifyToken } = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { sanitizeBody, sanitizeParams } = require('../middleware/security');
const AuthValidators = require('../validators/authValidators');
const { PERMISSIONS } = require('../constants/permissions');
const fileUploadOptions = require('../config/adminFileUploadOptions');

const platformUsersController = require('../controllers/backofficeCore/platformUsersController');
const clientsController = require('../controllers/backofficeCore/clientsController');
const settingsController = require('../controllers/backofficeCore/settingsController');
const syncController = require('../controllers/backofficeCore/syncController');

router.use(verifyToken);

// --- Usuarios de plataforma ---
router.get('/platform-users',
  requirePermission(PERMISSIONS.PLATFORM_USERS_MANAGE),
  platformUsersController.listPlatformUsers
);
// Sin sanitizeBody propio a propósito: el body ya pasa por el sanitizeBody de nivel router
// de userRoutes.js:8 y productRoutes.js:86 (montados en /api a secas ANTES de este router
// en app.js). Total 2 pasadas = misma paridad que POST /api/auth/register.
// Si se reordena app.js, revisar esta paridad (ver CHANGELOG, hallazgo multi-escape).
router.post('/platform-users',
  requirePermission(PERMISSIONS.PLATFORM_USERS_MANAGE),
  AuthValidators.validateEmail, // misma validación/normalización que register (authRoutes.js:262)
  platformUsersController.createPlatformUser
);
router.post('/platform-users/:id/resend-invitation',
  requirePermission(PERMISSIONS.PLATFORM_USERS_MANAGE),
  platformUsersController.resendInvitation
);
router.post('/platform-users/:id/activate',
  requirePermission(PERMISSIONS.PLATFORM_USERS_MANAGE),
  platformUsersController.activatePlatformUser
);
// Sin sanitizeBody propio a propósito (ver nota en POST /platform-users, arriba): 2 pasadas
// vía userRoutes.js:8 + productRoutes.js:86, misma paridad que POST /api/auth/register.
router.post('/platform-users/:id/deactivate',
  requirePermission(PERMISSIONS.PLATFORM_USERS_MANAGE),
  platformUsersController.deactivatePlatformUser
);
router.post('/platform-users/:id/role',
  requirePermission(PERMISSIONS.PLATFORM_USERS_MANAGE),
  platformUsersController.changePlatformUserRole
);

// --- Clientes (D7, activación/inactivación) ---
// GET /clients: misma cadena que clientProfileRoutes.js:8 (sanitizeParams a nivel de
// router) + :409-413 (verifyToken + checkRole([1,3]), reemplazado por requirePermission).
router.get('/clients',
  sanitizeParams,
  requirePermission(PERMISSIONS.CLIENTS_VIEW),
  clientsController.listClients
);
router.get('/clients/without-profile',
  requirePermission(PERMISSIONS.CLIENTS_VIEW),
  clientsController.listClientsWithoutProfile
);
router.get('/clients/:userId/deactivation-preview',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE_STATUS),
  clientsController.getDeactivationPreview
);
// Sin sanitizeBody propio a propósito (ver nota en POST /platform-users, arriba): 2 pasadas
// vía userRoutes.js:8 + productRoutes.js:86, misma paridad que POST /api/auth/register.
router.post('/clients/:userId/deactivate',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE_STATUS),
  clientsController.deactivateClient
);
router.post('/clients/:userId/activate',
  requirePermission(PERMISSIONS.CLIENTS_MANAGE_STATUS),
  clientsController.activateClient
);

// --- Configuración (adminRoutes.js:antigua 27-28/30-31: verifyToken + sanitizeBody a nivel de router) ---
router.get('/settings',
  sanitizeBody,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  settingsController.getSettings
);
router.post('/settings',
  sanitizeBody,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  fileUpload(fileUploadOptions), // mismo middleware y opciones que adminRoutes.js (POST /settings)
  settingsController.updateSettings
);
// Sin sanitizeBody: delega en adminController.enableBranchLogin, que escribe
// client_branches.password. userRoutes.js:10 + productRoutes.js:88 ya aplican
// sanitizeBody 2 veces antes de llegar aquí — las mismas 2 pasadas que
// branchAuthRoutes.js:163 aplica al validar el login (ver hallazgo de doble-escape en
// docs/CHANGELOG-backoffice-core.md; corregido también en adminRoutes.js, la ruta
// original que esta delega).
router.post('/settings/branches/:branchId/enable-login',
  requirePermission(PERMISSIONS.BRANCH_LOGIN_MANAGE),
  settingsController.enableBranchLogin
);
// No escribe password ni ningún campo sensible — alineado con adminRoutes.js por
// consistencia, no por necesidad funcional.
router.post('/settings/branches/:branchId/disable-login',
  requirePermission(PERMISSIONS.BRANCH_LOGIN_MANAGE),
  settingsController.disableBranchLogin
);

// --- Sincronizaciones ---
router.get('/sync/status',
  requirePermission(PERMISSIONS.SAP_SYNC_VIEW),
  syncController.getSyncStatus
);
router.get('/sync/clients/pending',
  requirePermission(PERMISSIONS.SAP_SYNC_VIEW),
  syncController.getPendingClients
);
router.post('/sync/clients/all',
  requirePermission(PERMISSIONS.SAP_SYNC_EXECUTE),
  syncController.syncAllClients
);
router.post('/sync/branches',
  requirePermission(PERMISSIONS.SAP_SYNC_EXECUTE),
  syncController.syncClientBranches
);
router.post('/sync/products',
  sanitizeParams, // mismo middleware que sapSyncRoutes.js (router-level)
  requirePermission(PERMISSIONS.SAP_SYNC_EXECUTE),
  syncController.syncProducts
);

module.exports = router;
