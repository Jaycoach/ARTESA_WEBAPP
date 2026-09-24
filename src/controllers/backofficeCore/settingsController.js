const pool = require('../../config/db');
const adminController = require('../adminController');
const { withAudit } = require('../../services/backofficeCore/auditWrapper');

const readAdminSettingsRow = async () => {
  const { rows } = await pool.query('SELECT id, order_time_limit FROM admin_settings LIMIT 1');
  return rows[0] || null;
};

module.exports = {
  // No escribe: delegación directa, sin auditoría.
  getSettings: adminController.getSettings,

  updateSettings: withAudit(adminController.updateSettings, {
    actionType: 'update_admin_settings',
    targetType: 'admin_settings',
    resolveBefore: readAdminSettingsRow,
    resolveTargetId: async (req, body, before) => before?.id ?? 0,
    resolveDetails: (req, body, before) => ({
      // Único escalar que acepta updateSettings (adminController.js:165, AdminSettings.js:78-127).
      before: { orderTimeLimit: before?.order_time_limit ?? null },
      // "requested", no "after": si ok es false, este valor nunca se aplicó.
      requested: { orderTimeLimit: req.body.orderTimeLimit ?? null },
      // Nunca el contenido del banner (imagen), solo si se intentó cambiar.
      banner_changed: !!(req.files && req.files.homeBannerImage)
    })
  }),

  enableBranchLogin: withAudit(adminController.enableBranchLogin, {
    actionType: 'enable_branch_login',
    targetType: 'client_branch',
    resolveTargetId: async (req) => Number(req.params.branchId) || 0
  }),

  disableBranchLogin: withAudit(adminController.disableBranchLogin, {
    actionType: 'disable_branch_login',
    targetType: 'client_branch',
    resolveTargetId: async (req) => Number(req.params.branchId) || 0
  })
};
