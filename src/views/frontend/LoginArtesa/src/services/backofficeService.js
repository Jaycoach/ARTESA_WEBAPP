import API from '../api/config';

export const backofficeService = {
  /**
   * Valida si el usuario tiene permisos de BackOffice (rol ADMIN o BACKOFFICE)
   * @param {Object} user - Objeto de usuario con información de rol
   * @returns {Boolean}
   */
  hasBackofficePermission(user) {
    if (!user) return false;
    const role = parseInt(user.role);
    return role === 1 || role === 4;
  },

  async getClients(search = '') {
    try {
      const response = await API.get('/backoffice/clients', { params: search ? { search } : {} });
      return response.data;
    } catch (error) {
      console.error('Error fetching backoffice clients:', error);
      throw error.response?.data || error;
    }
  },

  async getClientBranches(clientId) {
    try {
      const response = await API.get(`/backoffice/clients/${clientId}/branches`);
      return response.data;
    } catch (error) {
      console.error('Error fetching backoffice client branches:', error);
      throw error.response?.data || error;
    }
  },

  async activateClient(userId) {
    try {
      const response = await API.post(`/backoffice/clients/${userId}/activate`);
      return response.data;
    } catch (error) {
      console.error('Error activating client:', error);
      throw error.response?.data || error;
    }
  },

  async deactivateClient(userId) {
    try {
      const response = await API.post(`/backoffice/clients/${userId}/deactivate`);
      return response.data;
    } catch (error) {
      console.error('Error deactivating client:', error);
      throw error.response?.data || error;
    }
  },

  async resetBranchPassword(branchId) {
    try {
      const response = await API.post(`/backoffice/branches/${branchId}/reset-password`);
      return response.data;
    } catch (error) {
      console.error('Error resetting branch password:', error);
      throw error.response?.data || error;
    }
  },

  async getClientProductPrices(clientId, productCodes) {
    try {
      const response = await API.post(`/backoffice/clients/${clientId}/product-prices`, {
        product_codes: productCodes
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching client product prices:', error);
      throw error.response?.data || error;
    }
  },

  async createOrderForClient(orderData) {
    try {
      const response = await API.post('/backoffice/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating backoffice order:', error);
      throw error.response?.data || error;
    }
  },

  async getProducts() {
    try {
      const response = await API.get('/products');
      return response.data;
    } catch (error) {
      console.error('Error fetching products for backoffice:', error);
      throw error.response?.data || error;
    }
  }
};

export default backofficeService;
