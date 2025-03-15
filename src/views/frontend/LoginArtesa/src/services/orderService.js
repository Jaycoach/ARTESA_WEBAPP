// src/services/orderService.js
import API from '../api/config';

export const orderService = {
  // Crear una nueva orden
  async createOrder(orderData, isMultipart = false) {
    try {
      // Determinar el método de envío según si hay archivos adjuntos
      const headers = isMultipart 
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };
      
        const response = await API.post('/orders', orderData, {
          headers
        });
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: 'Pedido creado exitosamente'
        };
      } else {
        throw new Error(response.data.message || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al crear el pedido',
        error: error
      };
    }
  },
  
  // Obtener una orden por su ID
  async getOrderById(orderId) {
    try {
      const response = await API.get(`/orders/${orderId}`);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        throw new Error(response.data.message || 'Error al obtener la orden');
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al obtener detalles del pedido',
        error: error
      };
    }
  },
  
  // Obtener todas las órdenes de un usuario
  async getUserOrders(userId) {
    try {
      const response = await API.get(`/orders/user/${userId}`);
      
      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error(response.data.message || 'Error al obtener los pedidos del usuario');
      }
    } catch (error) {
      console.error('Error fetching user orders:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al obtener los pedidos',
        error: error
      };
    }
  },
  
  // Obtener configuración del sitio (incluyendo orderTimeLimit)
  async getSiteSettings() {
    try {
      const response = await API.get('/admin/settings');
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data || { orderTimeLimit: '18:00' } // Valor por defecto
        };
      } else {
        throw new Error(response.data.message || 'Error al obtener la configuración');
      }
    } catch (error) {
      console.error('Error fetching site settings:', error);
      return {
        success: false,
        data: { orderTimeLimit: '18:00' }, // Valor por defecto
        message: error.message || 'Error al obtener configuración'
      };
    }
  }
}