const ROLES = require('./roles');

/**
 * Matriz de capacidades del BackOffice (núcleo).
 * Ref. Fase 0/checkpoint aprobado: BACKOFFICE (4) sin ninguna capacidad en el
 * núcleo (se define cuando se publique la gestión de pedidos). USER (2) nunca
 * aparece aquí porque no tiene acceso al BackOffice en ninguna capacidad.
 */
const PERMISSIONS = Object.freeze({
  // Usuarios de plataforma: listar, crear con invitación, activar/inactivar, modificar rol.
  PLATFORM_USERS_MANAGE: 'platform_users.manage',

  // Configuración del portal: hora de cierre y banner (ya existente en admin_settings).
  SETTINGS_MANAGE: 'settings.manage',

  // Habilitar/deshabilitar login de una sucursal (ya existente, adminRoutes.js:41-47).
  BRANCH_LOGIN_MANAGE: 'branch_login.manage',

  // Ver listado de clientes y descargar sus documentos (ya existente, ClientList).
  CLIENTS_VIEW: 'clients.view',

  // Activar/inactivar clientes (rol 2) — D7. Necesaria ya (no en el archivo 9) porque
  // backofficeCoreRoutes.js/clientsController.js la usan desde el archivo 7.
  CLIENTS_MANAGE_STATUS: 'clients.manage_status',

  // Subir/eliminar imágenes de producto (ya existente, productImageRoutes).
  PRODUCT_IMAGES_MANAGE: 'product_images.manage',

  // Ver/gestionar archivos subidos (uploadRoutes.js) — subida y borrado individual.
  UPLOADS_MANAGE: 'uploads.manage',

  // Borrado masivo de archivos subidos — destructivo, solo ADMIN.
  UPLOADS_BULK_DELETE: 'uploads.bulk_delete',

  // CRUD de catálogo de productos (productRoutes.js) — ya existente como [1,3].
  PRODUCTS_MANAGE: 'products.manage',

  // Disparar sincronizaciones SAP (clientes, productos, sucursales, listas de precios, etc.).
  SAP_SYNC_EXECUTE: 'sap_sync.execute',

  // Ver estado/historial de sincronizaciones SAP sin poder dispararlas.
  SAP_SYNC_VIEW: 'sap_sync.view',

  // Funciones de seguridad: revocar sesiones/tokens de un tercero, ver active_tokens, config de autenticación.
  SECURITY_TOKENS_MANAGE: 'security.tokens_manage',

  // Ver el historial de auditoría (backoffice_actions).
  AUDIT_VIEW: 'audit.view',

  // Borrado de un cliente (clientProfileRoutes.js:780) — destructivo, solo ADMIN.
  CLIENTS_DELETE: 'clients.delete',

  // Endpoints de diagnóstico/debug/infraestructura — nunca de negocio, solo ADMIN.
  SYSTEM_DIAGNOSTICS: 'system.diagnostics',

  // Mantenimiento local de pedidos sin efectos en SAP (process-pending, verify-trm).
  ORDERS_MAINTENANCE: 'orders.maintenance',
});

/**
 * capacidad -> lista de rol_id que la tienen.
 * ADMIN (1) tiene todas por definición explícita (no hay atajo implícito: se listan
 * una por una para que la matriz sea la única fuente de verdad, auditable a simple vista).
 * Congelada (objeto y cada array interno) para que nadie la mute en tiempo de ejecución.
 */
const ROLE_PERMISSIONS = Object.freeze({
  [PERMISSIONS.PLATFORM_USERS_MANAGE]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.SETTINGS_MANAGE]: Object.freeze([ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN]),
  [PERMISSIONS.BRANCH_LOGIN_MANAGE]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.CLIENTS_VIEW]: Object.freeze([ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN]),
  [PERMISSIONS.CLIENTS_MANAGE_STATUS]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.PRODUCT_IMAGES_MANAGE]: Object.freeze([ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN]),
  [PERMISSIONS.SAP_SYNC_EXECUTE]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.SAP_SYNC_VIEW]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.SECURITY_TOKENS_MANAGE]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.AUDIT_VIEW]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.UPLOADS_MANAGE]: Object.freeze([ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN]),
  [PERMISSIONS.UPLOADS_BULK_DELETE]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.PRODUCTS_MANAGE]: Object.freeze([ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN]),
  [PERMISSIONS.CLIENTS_DELETE]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.SYSTEM_DIAGNOSTICS]: Object.freeze([ROLES.ADMIN]),
  [PERMISSIONS.ORDERS_MAINTENANCE]: Object.freeze([ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN]),
});

/**
 * @param {number|string} roleId - req.user.rol_id
 * @param {string} permission - una de las claves de PERMISSIONS (string, no la clave del objeto)
 * @returns {boolean} false por defecto ante cualquier capacidad desconocida, mal escrita,
 *   heredada del prototipo (p.ej. "constructor"), o un roleId no numérico.
 */
const roleHasPermission = (roleId, permission) => {
  if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, permission)) return false;
  const allowedRoles = ROLE_PERMISSIONS[permission];
  if (!Array.isArray(allowedRoles)) return false;
  const id = Number(roleId);
  if (!Number.isInteger(id)) return false;
  return allowedRoles.includes(id);
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHasPermission,
};
