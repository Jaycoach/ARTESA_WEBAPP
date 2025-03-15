// src/services/orderService.js
import API from '../api/config';

export const orderService = {
  // Crear una nueva orden
  async createOrder(orderData) {
    try {
      const response = await API.post('/orders', orderData);
      
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
  }
};