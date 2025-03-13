// src/services/orderService.js
import API from '../api/config';

export const orderService = {
  // Crear una nueva orden
  async createOrder(orderData) {
    try {
      const response = await API.post('/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error.response?.data || error;
    }
  },
  
  // Obtener una orden por su ID
  async getOrderById(orderId) {
    try {
      const response = await API.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error.response?.data || error;
    }
  },
  
  // Obtener todas las órdenes de un usuario
  async getUserOrders(userId) {
    try {
      const response = await API.get(`/orders/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user orders:', error);
      throw error.response?.data || error;
    }
  }
};