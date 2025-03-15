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
  
  // Actualizar una orden existente
  async updateOrder(orderId, orderData, isMultipart = false) {
    try {
      // Determinar el método de envío según si hay archivos adjuntos
      const headers = isMultipart 
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };
      
      const response = await API.put(`/orders/${orderId}`, orderData, {
        headers
      });
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: 'Pedido actualizado exitosamente'
        };
      } else {
        throw new Error(response.data.message || 'Error al actualizar el pedido');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al actualizar el pedido',
        error: error
      };
    }
  },
  
  // Obtener una orden por su ID
  async getOrderById(orderId) {
    try {
      if (!orderId) {
        throw new Error('ID de orden no proporcionado o inválido');
      }

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
  
  // Verificar si un pedido puede ser editado
  async canEditOrder(orderId, orderTimeLimit = '18:00') {
    try {
      const orderResult = await this.getOrderById(orderId);
      
      if (!orderResult.success) {
        return {
          canEdit: false,
          reason: 'No se pudo obtener información del pedido'
        };
      }
      
      const order = orderResult.data;
      
      // Verificar si el pedido está en un estado que permite edición
      if (['completado', 'completed', 'entregado', 'delivered', 'cancelado', 'canceled'].includes(
        order.status?.toLowerCase()
      )) {
        return {
          canEdit: false,
          reason: `No se puede editar un pedido con estado: ${order.status}`
        };
      }
      
      // Verificar la hora límite para edición
      const orderDate = new Date(order.order_date);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      
      // Si el pedido es de un día anterior, verificar la hora límite
      if (orderDay.getTime() < today.getTime()) {
        const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
        const limitTime = new Date();
        limitTime.setHours(limitHours, limitMinutes, 0, 0);
        
        if (now > limitTime) {
          return {
            canEdit: false,
            reason: `No se puede editar después de las ${orderTimeLimit}`
          };
        }
      }
      
      return {
        canEdit: true
      };
    } catch (error) {
      console.error('Error checking if order can be edited:', error);
      return {
        canEdit: false,
        reason: error.message || 'Error al verificar si el pedido puede ser editado'
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