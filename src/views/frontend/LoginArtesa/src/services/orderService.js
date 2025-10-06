// src/services/orderService.js
import API from '../api/config';

// ✅ FUNCIÓN PARA DETECTAR CONTEXTO DE USUARIO
const detectUserContext = () => {
  const branchToken = localStorage.getItem('branchAuthToken');
  const userToken = localStorage.getItem('token');
  const branchData = localStorage.getItem('branchData');
  
  if (branchToken && branchData) {
    return {
      type: 'branch',
      data: JSON.parse(branchData),
      token: branchToken,
      endpoint: '/branch-orders' // ← ENDPOINT ESPECÍFICO PARA BRANCH
    };
  } else if (userToken) {
    return {
      type: 'user', 
      token: userToken,
      endpoint: '/orders' // ← ENDPOINT ORIGINAL PARA USUARIOS
    };
  }
  
  return null;
};

// ✅ FUNCIÓN PARA VALIDAR DATOS SEGÚN CONTEXTO
const validateOrderData = (orderData, isMultipart, userContext) => {
  if (userContext.type === 'branch') {
    // Validaciones para Branch
    if (!isMultipart) {
      if (!orderData.branch_id) {
        console.error('Error: branch_id no encontrado en datos de Branch order', orderData);
        throw new Error('ID de sucursal requerido');
      }
      if (!orderData.user_id) {
        console.error('Error: user_id no encontrado en datos de Branch order', orderData);
        throw new Error('ID de usuario principal requerido');
      }
    } else if (isMultipart && orderData instanceof FormData) {
      const hasBranchId = orderData.has('branch_id');
      const hasUserId = orderData.has('user_id'); 
      const orderDataJson = orderData.get('orderData');
      
      if (!hasBranchId && (!orderDataJson || !JSON.parse(orderDataJson).branch_id)) {
        throw new Error('ID de sucursal requerido en FormData');
      }
      if (!hasUserId && (!orderDataJson || !JSON.parse(orderDataJson).user_id)) {
        throw new Error('ID de usuario principal requerido en FormData');
      }
    }
  } else {
    // Validaciones para Usuario Principal (lógica original)
    if (!isMultipart && (!orderData.user_id || orderData.user_id === undefined)) {
      console.error('Error: user_id no encontrado en los datos de la orden', orderData);
      throw new Error('ID de usuario requerido');
    }

    // ✅ NUEVA VALIDACIÓN: branch_id obligatorio para usuarios principales
    if (!isMultipart && (!orderData.branch_id || orderData.branch_id === undefined)) {
      console.error('Error: branch_id no encontrado en los datos de la orden', orderData);
      throw new Error('ID de sucursal requerido - todo pedido debe tener una sucursal asignada');
    }
    
    if (isMultipart && orderData instanceof FormData) {
      const hasUserId = orderData.has('user_id');
      const orderDataJson = orderData.get('orderData');
      
      if (!hasUserId && (!orderDataJson || !JSON.parse(orderDataJson).user_id)) {
        console.error('Error: user_id no encontrado en FormData', orderData);
        throw new Error('ID de usuario requerido');
      }

      // ✅ VALIDAR branch_id en FormData
      const orderDataParsed = orderDataJson ? JSON.parse(orderDataJson) : {};
      if (!orderDataParsed.branch_id) {
        throw new Error('ID de sucursal requerido en FormData');
      }
    }
  }
};

export const orderService = {
  // ✅ CREAR ORDEN ADAPTADA PARA DUAL CONTEXT
  async createOrder(orderData, isMultipart = false) {
    try {
      // ✅ DETECTAR CONTEXTO AUTOMÁTICAMENTE
      const userContext = detectUserContext();
      
      if (!userContext) {
        throw new Error('No se pudo determinar el contexto de usuario');
      }
      
      console.log(`🔍 Contexto detectado: ${userContext.type.toUpperCase()}`);
      console.log(`📡 Endpoint a usar: ${userContext.endpoint}`);

      // ✅ VALIDAR DATOS SEGÚN CONTEXTO
      validateOrderData(orderData, isMultipart, userContext);

      // ✅ CONFIGURAR HEADERS
      const headers = isMultipart
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

        // ✅ CONFIGURAR DATOS SEGÚN TIPO DE CONTENIDO
        let finalOrderData = orderData;
        
        // Si es multipart/form-data, asegurar que incluya orderData JSON
        if (isMultipart && !(orderData instanceof FormData)) {
          // Si no es FormData pero se especificó multipart, crear FormData
          const formData = new FormData();
          formData.append('orderData', JSON.stringify(orderData));
          finalOrderData = formData;
          console.log('📦 Datos convertidos a FormData con orderData JSON');
        } else if (isMultipart && orderData instanceof FormData) {
          // Si ya es FormData, verificar que tenga orderData
          if (!orderData.has('orderData')) {
            console.warn('⚠️ FormData no contiene campo orderData, agregándolo');
            // Extraer datos del FormData existente y crear orderData JSON
            const extractedData = {};
            for (let [key, value] of orderData.entries()) {
              if (key !== 'orderData') {
                extractedData[key] = value;
              }
            }
            orderData.append('orderData', JSON.stringify(extractedData));
          }
          finalOrderData = orderData;
          console.log('📦 FormData verificado con orderData JSON');
        }

      // ✅ LOG DETALLADO SEGÚN CONTEXTO
      if (userContext.type === 'branch') {
        console.log(`🏢 Enviando orden de SUCURSAL a ${userContext.endpoint}${isMultipart ? ' (multipart)' : ' (JSON)'}:`);
        console.log('🏢 Datos de sucursal:', {
          branch_id: userContext.data.branch_id,
          branch_name: userContext.data.branch_name || userContext.data.branchname,
          user_id: userContext.data.user_id,
          company_name: userContext.data.company_name
        });
      } else {
        console.log(`👤 Enviando orden de USUARIO a ${userContext.endpoint}${isMultipart ? ' (multipart)' : ' (JSON)'}:`);
      }

      if (!isMultipart) {
        console.log('📦 Payload:', orderData);
      } else {
        console.log('📦 FormData (contenido no visible por seguridad)');
      }

      // ✅ ENVIAR A ENDPOINT CORRECTO
      const response = await API.post(userContext.endpoint, finalOrderData, {
        headers
      });

      if (response.data.success) {
        console.log(`✅ Orden ${userContext.type.toUpperCase()} creada exitosamente`);
        return {
          success: true,
          data: response.data.data,
          message: 'Pedido creado exitosamente',
          context: userContext.type // ← Info adicional
        };
      } else {
        throw new Error(response.data.message || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error(`❌ Error creando orden:`, error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al crear el pedido',
        error: error
      };
    }
  },

  // ✅ ACTUALIZAR ORDEN ADAPTADA CORREGIDA
  async updateOrder(orderId, orderData, isMultipart = false) {
    try {
      const userContext = detectUserContext();
      
      if (!userContext) {
        throw new Error('No se pudo determinar el contexto de usuario');
      }
  
      // Asegurar que los comentarios se incluyan en los datos
      if (orderData.notes) {
        orderData.comments = orderData.notes;
      }

      const headers = isMultipart
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

      console.log(`🔄 Actualizando orden ${userContext.type.toUpperCase()}: ${orderId}`);

      let endpoint, response;

      if (userContext.type === 'branch') {
        // ✅ PARA BRANCH: Usar endpoint específico de actualización de estado
        // Si solo se está cambiando el estado, usar el endpoint de status
        if (orderData.status_id && Object.keys(orderData).length === 1) {
          endpoint = `/branch-orders/${orderId}/status`;
          response = await API.put(endpoint, {
            status_id: orderData.status_id,
            note: orderData.note || 'Actualización desde sucursal'
          }, { headers });
        } else {
          // ✅ PARA BRANCH: Para actualizaciones completas, usar endpoint principal con permisos
          endpoint = `/orders/${orderId}`;
          response = await API.put(endpoint, orderData, { headers });
        }
      } else {
        // ✅ PARA USUARIO PRINCIPAL: Usar endpoint estándar
        endpoint = `/orders/${orderId}`;
        response = await API.put(endpoint, orderData, { headers });
      }

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: 'Pedido actualizado exitosamente',
          context: userContext.type
        };
      } else {
        throw new Error(response.data.message || 'Error al actualizar el pedido');
      }
    } catch (error) {
      console.error('❌ Error updating order:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al actualizar el pedido',
        error: error
      };
    }
  },

  // ✅ OBTENER ORDEN POR ID ADAPTADA
  async getOrderById(orderId) {
    try {
      if (!orderId) {
        throw new Error('ID de orden no proporcionado o inválido');
      }

      const userContext = detectUserContext();
      
      if (!userContext) {
        throw new Error('No se pudo determinar el contexto de usuario');
      }

      console.log(`🔍 Obteniendo orden ${userContext.type.toUpperCase()}: ${orderId}`);

      // ✅ USAR ENDPOINT CORRECTO
      const endpoint = `${userContext.endpoint}/${orderId}`;
      const response = await API.get(endpoint);

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          context: userContext.type
        };
      } else {
        throw new Error(response.data.message || 'Error al obtener la orden');
      }
    } catch (error) {
      console.error('❌ Error fetching order details:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al obtener detalles del pedido',
        error: error
      };
    }
  },

  // ✅ OBTENER ÓRDENES DE USUARIO ADAPTADA
  async getUserOrders(userId) {
    try {
      const userContext = detectUserContext();
      
      if (!userContext) {
        throw new Error('No se pudo determinar el contexto de usuario');
      }

      let endpoint;
      if (userContext.type === 'branch') {
        // Para branch, obtener órdenes de la sucursal
        endpoint = '/branch-orders/orders'; // Sin userId en la ruta
        console.log('🏢 Obteniendo órdenes de sucursal');
      } else {
        // Para usuario principal, usar lógica original
        endpoint = `/orders/user/${userId}`;
        console.log(`👤 Obteniendo órdenes de usuario: ${userId}`);
      }

      const response = await API.get(endpoint);

      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error(response.data.message || 'Error al obtener los pedidos del usuario');
      }
    } catch (error) {
      console.error('❌ Error fetching user orders:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al obtener los pedidos',
        error: error
      };
    }
  },

  // ✅ RESTO DE FUNCIONES SIN CAMBIOS (pueden usar endpoint genérico)
  async getOrdersByDeliveryDate(deliveryDate, statusId = null) {
    try {
      const params = new URLSearchParams({ deliveryDate });
      if (statusId) {
        params.append('statusId', statusId);
      }

      const response = await API.get(`/orders/byDeliveryDate?${params.toString()}`);

      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error(response.data.message || 'Error al obtener las órdenes por fecha de entrega');
      }
    } catch (error) {
      console.error('Error fetching orders by delivery date:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al obtener las órdenes por fecha',
        error
      };
    }
  },

  // ✅ CAN EDIT ORDER ADAPTADA
  async canEditOrder(orderId, orderTimeLimit = null) {
    try {
      console.log(`🔍 Verificando si se puede editar la orden ${orderId} con límite ${orderTimeLimit}`);
      
      // Usar la función adaptada que ya detecta contexto
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

      // Resto de la lógica de validación igual...
      // (mantener toda la lógica de validación de tiempo y estado)

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

      // ✅ NUEVA LÓGICA: Validar según fecha de entrega y hora límite
      const deliveryDate = new Date(order.delivery_date);
      const now = new Date();

      // Normalizar fechas para comparación (sin horas)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const deliveryDay = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate());

      // Calcular días de diferencia entre hoy y la fecha de entrega
      const diffTime = deliveryDay.getTime() - today.getTime();
      const daysUntilDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log(`📅 Validación de edición:`, {
        today: today.toLocaleDateString('es-ES'),
        deliveryDate: deliveryDay.toLocaleDateString('es-ES'),
        daysUntilDelivery,
        currentTime: now.toLocaleTimeString('es-ES')
      });

      // Si la fecha de entrega ya pasó, no se puede editar
      if (daysUntilDelivery < 0) {
        console.log(`❌ No se puede editar - La fecha de entrega ya pasó`);
        return {
          canEdit: false,
          reason: 'No se puede editar un pedido cuya fecha de entrega ya pasó'
        };
      }

      // Si faltan 2 días o menos para la entrega, verificar la hora límite
      if (daysUntilDelivery <= 2) {
        const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
        const limitTime = new Date();
        limitTime.setHours(limitHours, limitMinutes, 0, 0);

        console.log(`⏰ Verificando hora límite:`, {
          daysUntilDelivery,
          currentTime: now.toLocaleTimeString('es-ES'),
          limitTime: limitTime.toLocaleTimeString('es-ES'),
          isPastLimit: now > limitTime
        });

        if (now > limitTime) {
          console.log(`❌ No se puede editar - Ya pasó la hora límite (${orderTimeLimit})`);
          return {
            canEdit: false,
            reason: `No se puede editar después de las ${orderTimeLimit} cuando faltan ${daysUntilDelivery} días o menos para la entrega`
          };
        }
      }

      // Si llegamos aquí, el pedido puede ser editado
      console.log('✅ El pedido puede ser editado');
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

  // ✅ OBTENER CONFIGURACIÓN (sin cambios)
  async getSiteSettings() {
    try {
      const response = await API.get('/admin/settings');

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data || { orderTimeLimit: '18:00' }
        };
      } else {
        throw new Error(response.data.message || 'Error al obtener la configuración');
      }
    } catch (error) {
      console.error('Error fetching site settings:', error);
      return {
        success: false,
        data: { orderTimeLimit: '18:00' },
        message: error.message || 'Error al obtener configuración'
      };
    }
  },

  // ✅ OBTENER SUCURSALES DEL USUARIO (sin cambios de contexto)
  async getUserBranches() {
    try {
      const response = await API.get('/orders/user-branches');

      if (response.data.success) {
        return response.data.data || [];
      } else {
        throw new Error(response.data.message || 'Error al obtener las sucursales');
      }
    } catch (error) {
      console.error('Error fetching user branches:', error);
      throw {
        success: false,
        message: error.response?.data?.message || error.message || 'Error al obtener las sucursales',
        error
      };
    }
  }
};