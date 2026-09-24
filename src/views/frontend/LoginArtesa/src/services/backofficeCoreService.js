import API from '../api/config';

// Cliente del núcleo del BackOffice (/api/backoffice/*). Nombre distinto de
// backofficeService.js (que pertenece al branch pausado, clase B/C) para no chocar
// en la Fase 7.
const wrap = async (promise) => {
  try {
    const response = await promise;
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      error: error.response?.data?.message || 'Error de comunicación con el servidor'
    };
  }
};

const backofficeCoreService = {
  // --- Usuarios de plataforma ---
  getPlatformUsers: () => wrap(API.get('/backoffice/platform-users')),
  createPlatformUser: (payload) => wrap(API.post('/backoffice/platform-users', payload)),
  resendInvitation: (id) => wrap(API.post(`/backoffice/platform-users/${id}/resend-invitation`)),
  activatePlatformUser: (id) => wrap(API.post(`/backoffice/platform-users/${id}/activate`)),
  deactivatePlatformUser: (id, reason) =>
    wrap(API.post(`/backoffice/platform-users/${id}/deactivate`, { reason })),
  changePlatformUserRole: (id, newRoleId) =>
    wrap(API.post(`/backoffice/platform-users/${id}/role`, { newRoleId })),

  // --- Clientes ---
  getClients: () => wrap(API.get('/backoffice/clients')),
  getClientsWithoutProfile: () => wrap(API.get('/backoffice/clients/without-profile')),
  getDeactivationPreview: (userId) =>
    wrap(API.get(`/backoffice/clients/${userId}/deactivation-preview`)),
  deactivateClient: (userId, reason) =>
    wrap(API.post(`/backoffice/clients/${userId}/deactivate`, { reason })),
  activateClient: (userId) => wrap(API.post(`/backoffice/clients/${userId}/activate`)),

  // --- Configuración ---
  getSettings: () => wrap(API.get('/backoffice/settings')),
  updateSettings: (formData) =>
    wrap(API.post('/backoffice/settings', formData, {
      headers: formData instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined
    })),
  enableBranchLogin: (branchId, payload) =>
    wrap(API.post(`/backoffice/settings/branches/${branchId}/enable-login`, payload)),
  disableBranchLogin: (branchId) =>
    wrap(API.post(`/backoffice/settings/branches/${branchId}/disable-login`)),

  // --- Sincronizaciones ---
  getSyncStatus: () => wrap(API.get('/backoffice/sync/status')),
  getPendingClients: () => wrap(API.get('/backoffice/sync/clients/pending')),
  syncAllClients: () => wrap(API.post('/backoffice/sync/clients/all')),
  syncBranches: () => wrap(API.post('/backoffice/sync/branches')),
  syncProducts: () => wrap(API.post('/backoffice/sync/products'))
};

export default backofficeCoreService;
