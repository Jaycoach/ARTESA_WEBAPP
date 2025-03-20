import API from '../api/config';

export const orderService = {
  // Crear una nueva orden
async createOrder(orderData, isMultipart = false) {
  try {
    // Verificar si tenemos user_id en los datos
    if (!isMultipart && (!orderData.user_id || orderData.user_id === undefined)) {
      console.error('Error: user_id no encontrado en los datos de la orden', orderData);
      throw new Error('ID de usuario requerido');
    }
    
    // Si es multipart, verificar que el FormData contiene user_id o está en orderData
    if (isMultipart && orderData instanceof FormData) {
      const hasUserId = orderData.has('user_id');
      const orderDataJson = orderData.get('orderData');
      
      if (!hasUserId && (!orderDataJson || !JSON.parse(orderDataJson).user_id)) {
        console.error('Error: user_id no encontrado en FormData', orderData);
        throw new Error('ID de usuario requerido');
      }
    }
    
    // Determinar el método de envío según si hay archivos adjuntos
    const headers = isMultipart 
      ? { 'Content-Type': 'multipart/form-data' }
      : { 'Content-Type': 'application/json' };
    
    console.log(`Enviando orden a API${isMultipart ? ' (multipart)' : ' (JSON)'}:`, 
      isMultipart ? 'FormData (contenido no visible)' : orderData);
    
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
  async canEditOrder(orderId, orderTimeLimit = null) {
  try {
    console.log(`Verificando si se puede editar la orden ${orderId} con límite ${orderTimeLimit}`);
    const orderResult = await this.getOrderById(orderId);

    // Obtener la configuración actualizada del sitio si no se proporcionó
    if (!orderTimeLimit) {
      try {
        const siteConfigResponse = await API.get('/admin/settings');
        if (siteConfigResponse.data && siteConfigResponse.data.success) {
          orderTimeLimit = siteConfigResponse.data.data.orderTimeLimit || '18:00';
          console.log(`Límite obtenido de configuración: ${orderTimeLimit}`);
        }
      } catch (error) {
        console.warn('No se pudo obtener la configuración, usando valor predeterminado');
        orderTimeLimit = '18:00';
      }
    }
    
    if (!orderResult.success) {
      console.log('No se pudo obtener información del pedido');
      return {
        canEdit: false,
        reason: 'No se pudo obtener información del pedido'
      };
    }
    
    const order = orderResult.data;
    console.log('Datos del pedido:', order);
    
    // Obtener la configuración actualizada del sitio
    let actualOrderTimeLimit = orderTimeLimit;
    try {
      const siteConfigResponse = await API.get('/admin/settings');
      if (siteConfigResponse.data && siteConfigResponse.data.success) {
        actualOrderTimeLimit = siteConfigResponse.data.data.orderTimeLimit || orderTimeLimit;
        console.log(`Límite actualizado de configuración: ${actualOrderTimeLimit}`);
      }
    } catch (error) {
      console.warn('No se pudo obtener la configuración actualizada, usando valor predeterminado');
    }
    
    // Verificar si el pedido está en un estado que permite edición
    if (['completado', 'completed', 'entregado', 'delivered', 'cancelado', 'canceled'].includes(
      order.status?.toLowerCase()
    )) {
      console.log(`No se puede editar - Estado no permitido: ${order.status}`);
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
    
    // Calcular días transcurridos
    const diffTime = Math.abs(today - orderDay);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    console.log(`Días entre la creación y hoy: ${diffDays}`);
    console.log(`Fecha de pedido: ${orderDate.toLocaleString()}, Hoy: ${now.toLocaleString()}`);
    
    // Si el pedido es de más de un día, verificar la hora límite
    if (diffDays > 1) {
      console.log(`Pedido de hace más de 1 día - no editable`);
      return {
        canEdit: false,
        reason: 'Los pedidos solo pueden editarse el mismo día o al día siguiente'
      };
    }
    
    // Si el pedido es de un día diferente al actual, no se puede editar
    if (diffDays > 0) {
      console.log(`Pedido de un día diferente al actual - no editable`);
      return {
        canEdit: false,
        reason: `Solo puedes editar pedidos el mismo día de su creación`
      };
    }

    // Si es el mismo día, verificar la hora límite
    const [limitHours, limitMinutes] = actualOrderTimeLimit.split(':').map(Number);
    const limitTime = new Date();
    limitTime.setHours(limitHours, limitMinutes, 0, 0);

    console.log(`Hora actual: ${now.toLocaleTimeString()}, Hora límite: ${limitTime.toLocaleTimeString()}`);

    if (now > limitTime) {
      console.log(`Fuera de la hora límite de edición`);
      return {
        canEdit: false,
        reason: `No se puede editar después de las ${actualOrderTimeLimit}`
      };
    }
    
    console.log('El pedido puede ser editado');
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