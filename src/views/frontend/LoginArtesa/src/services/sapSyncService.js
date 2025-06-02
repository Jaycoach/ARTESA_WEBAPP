import API from '../api/config';

class SAPSyncService {
  
  // Obtener estado general de sincronización SAP
  async getSyncStatus() {
    try {
      const response = await API.get('/client-sync/status');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting SAP sync status:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Error al obtener estado de sincronización'
      };
    }
  }

  // Obtener clientes pendientes de activación
  async getPendingClients() {
    try {
      const response = await API.get('/client-sync/clients/pending');
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      console.error('Error getting pending clients:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Error al obtener clientes pendientes'
      };
    }
  }

  // Verificar si un usuario específico está pendiente de sincronización
  async isUserPendingSync(userId) {
    try {
      const pendingResult = await this.getPendingClients();
      if (!pendingResult.success) return false;

      const pendingClients = pendingResult.data || [];
      return pendingClients.some(client => 
        client.user_id === userId || 
        client.id === userId ||
        client.userId === userId
      );
    } catch (error) {
      console.error('Error checking if user is pending sync:', error);
      return false;
    }
  }

  // Activar un cliente manualmente
  async activateClient(userId) {
    try {
      const response = await API.post(`/client-sync/client/${userId}/activate`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error activating client:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Error al activar cliente'
      };
    }
  }

  // Iniciar sincronización manual completa
  async triggerFullSync() {
    try {
      const response = await API.post('/client-sync/sync');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error triggering sync:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Error al iniciar sincronización'
      };
    }
  }

  // Iniciar sincronización completa de todos los clientes
  async triggerSyncAll() {
    try {
      const response = await API.post('/client-sync/sync-all');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error triggering sync all:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Error al sincronizar todos los clientes'
      };
    }
  }
}

export const sapSyncService = new SAPSyncService();