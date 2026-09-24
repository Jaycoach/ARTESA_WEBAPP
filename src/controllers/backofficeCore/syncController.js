const clientSyncController = require('../clientSyncController');
const sapSyncController = require('../sapSyncController');
const { withAudit } = require('../../services/backofficeCore/auditWrapper');

module.exports = {
  // No escriben: delegación directa, sin auditoría.
  getSyncStatus: clientSyncController.getSyncStatus,
  getPendingClients: clientSyncController.getPendingClients,

  syncAllClients: withAudit(clientSyncController.syncAllClients, {
    actionType: 'trigger_sap_sync',
    targetType: 'sap_sync',
    resolveTargetId: async () => 0,
    resolveDetails: (req, body) => ({
      sync_type: 'clients_all',
      outcome: 'completed', // clientSyncController.js:469-499 espera syncAllClientsWithSAP() antes de responder
      total: body?.data?.total,
      updated: body?.data?.updated,
      errors: body?.data?.errors,
      skipped: body?.data?.skipped,
      cardTypeChanges: body?.data?.cardTypeChanges,
      leadsToClients: body?.data?.leadsToClients
    })
  }),

  syncClientBranches: withAudit(clientSyncController.syncClientBranches, {
    actionType: 'trigger_sap_sync',
    targetType: 'sap_sync',
    resolveTargetId: async () => 0,
    resolveDetails: (req, body) => ({
      sync_type: 'branches',
      outcome: 'completed', // clientSyncController.js:1246-1400 procesa el loop antes de responder
      totalClients: body?.data?.totalClients,
      totalBranches: body?.data?.totalBranches,
      created: body?.data?.created,
      updated: body?.data?.updated,
      errors: body?.data?.errors,
      skipped: body?.data?.skipped
      // clientDetails (array grande) deliberadamente excluido
    })
  }),

  syncProducts: withAudit(sapSyncController.startSync, {
    actionType: 'trigger_sap_sync',
    targetType: 'sap_sync',
    resolveTargetId: async () => 0,
    resolveDetails: (req, body) => ({
      sync_type: 'products',
      outcome: 'started', // sapSyncController.js:51-89 dispara Promise.resolve().then(...) en segundo plano
      job_id: body?.data?.jobId
    })
  })
};
