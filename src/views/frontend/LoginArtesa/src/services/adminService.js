// src/services/adminService.js
import API from '../api/config';

export const adminService = {
  /**
   * Obtener la configuración actual del portal
   */
  async getSettings() {
    try {
      const response = await API.get('/admin/settings');
      return response.data;
    } catch (error) {
      console.error('Error fetching admin settings:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Actualizar la configuración del portal
   * @param {Object} formData - FormData con los datos a actualizar
   */
  async updateSettings(formData) {
    try {
      const response = await API.post('/admin/settings', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error updating admin settings:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Validar si el usuario tiene permisos de administración
   * @param {Object} user - Objeto de usuario con información de rol
   * @returns {Boolean} - true si tiene permisos, false si no
   */
  hasAdminPermission(user) {
    return user && (user.role === 1 || user.role === 3);
  }
};

export default adminService;