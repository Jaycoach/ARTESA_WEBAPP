import { useState, useEffect, useCallback } from 'react';
import { orderService } from '../services/orderService';
import { useAuth } from './useAuth';

/**
 * Hook personalizado para manejar operaciones de pedidos
 */
export const useOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Función para refrescar los pedidos
  const refreshOrders = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Cargar los pedidos del usuario actual
  const fetchUserOrders = useCallback(async () => {
    if (!user || !user.id) {
      setError("Usuario no autenticado");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const data = await orderService.getUserOrders(user.id);
      setOrders(data || []);
    } catch (error) {
      console.error('Error al cargar las órdenes:', error);
      setError(error.message || 'Error al cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Obtener un pedido por su ID
  const getOrderById = useCallback(async (orderId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await orderService.getOrderById(orderId);
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Error al obtener detalles del pedido');
      }
    } catch (error) {
      console.error('Error al cargar detalles del pedido:', error);
      setError(error.message || 'Error al cargar detalles del pedido');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear un nuevo pedido
  const createOrder = useCallback(async (orderData) => {
    if (!user || !user.id) {
      throw new Error("Usuario no autenticado");
    }

    setLoading(true);
    setError(null);
    
    try {
      // Asegurarse de que user_id esté en el objeto de datos
      const orderWithUserId = {
        ...orderData,
        user_id: user.id
      };
      
      const result = await orderService.createOrder(orderWithUserId);
      
      if (result.success) {
        // Refrescar la lista de pedidos
        refreshOrders();
        return result;
      } else {
        throw new Error(result.message || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error('Error al crear pedido:', error);
      setError(error.message || 'Error al crear el pedido');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, refreshOrders]);

  // Efecto para cargar los pedidos cuando cambia el usuario o se solicita refrescar
  useEffect(() => {
    if (user && user.id) {
      fetchUserOrders();
    }
  }, [user, refreshTrigger, fetchUserOrders]);

  return {
    orders,
    loading,
    error,
    refreshOrders,
    fetchUserOrders,
    getOrderById,
    createOrder
  };
};

export default useOrders;