// Espejo en frontend de src/constants/permissions.js (backend). SOLO para mostrar u
// ocultar elementos de UI — la seguridad real vive en el backend (requirePermission).
// Si esta matriz y la del backend divergen, el backend manda; esto solo decide qué
// botones se muestran, nunca qué se permite ejecutar.

export const ROLES = Object.freeze({
  ADMIN: 1,
  USER: 2,
  FUNCTIONAL_ADMIN: 3,
  BACKOFFICE: 4,
});

export const PERMISSIONS = Object.freeze({
  PLATFORM_USERS_MANAGE: 'platform_users.manage',
  SETTINGS_MANAGE: 'settings.manage',
  BRANCH_LOGIN_MANAGE: 'branch_login.manage',
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_MANAGE_STATUS: 'clients.manage_status',
  PRODUCT_IMAGES_MANAGE: 'product_images.manage',
  SAP_SYNC_EXECUTE: 'sap_sync.execute',
  SAP_SYNC_VIEW: 'sap_sync.view',
  SECURITY_TOKENS_MANAGE: 'security.tokens_manage',
  AUDIT_VIEW: 'audit.view',
  UPLOADS_MANAGE: 'uploads.manage',
  UPLOADS_DELETE: 'uploads.delete',
  UPLOADS_BULK_DELETE: 'uploads.bulk_delete',
  PRODUCTS_MANAGE: 'products.manage',
  CLIENTS_DELETE: 'clients.delete',
  SYSTEM_DIAGNOSTICS: 'system.diagnostics',
  ORDERS_MAINTENANCE: 'orders.maintenance',
});

const ROLE_PERMISSIONS = Object.freeze({
  [PERMISSIONS.PLATFORM_USERS_MANAGE]: [ROLES.ADMIN],
  [PERMISSIONS.SETTINGS_MANAGE]: [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN],
  [PERMISSIONS.BRANCH_LOGIN_MANAGE]: [ROLES.ADMIN],
  [PERMISSIONS.CLIENTS_VIEW]: [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN],
  [PERMISSIONS.CLIENTS_MANAGE_STATUS]: [ROLES.ADMIN],
  [PERMISSIONS.PRODUCT_IMAGES_MANAGE]: [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN],
  [PERMISSIONS.SAP_SYNC_EXECUTE]: [ROLES.ADMIN],
  [PERMISSIONS.SAP_SYNC_VIEW]: [ROLES.ADMIN],
  [PERMISSIONS.SECURITY_TOKENS_MANAGE]: [ROLES.ADMIN],
  [PERMISSIONS.AUDIT_VIEW]: [ROLES.ADMIN],
  [PERMISSIONS.UPLOADS_MANAGE]: [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN],
  [PERMISSIONS.UPLOADS_DELETE]: [ROLES.ADMIN],
  [PERMISSIONS.UPLOADS_BULK_DELETE]: [ROLES.ADMIN],
  [PERMISSIONS.PRODUCTS_MANAGE]: [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN],
  [PERMISSIONS.CLIENTS_DELETE]: [ROLES.ADMIN],
  [PERMISSIONS.SYSTEM_DIAGNOSTICS]: [ROLES.ADMIN],
  [PERMISSIONS.ORDERS_MAINTENANCE]: [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN],
});

/**
 * @param {number|string} roleId
 * @param {string} permission
 * @returns {boolean}
 */
export function roleHasPermission(roleId, permission) {
  const allowed = ROLE_PERMISSIONS[permission];
  if (!Array.isArray(allowed)) return false;
  const id = Number(roleId);
  if (!Number.isInteger(id)) return false;
  return allowed.includes(id);
}
