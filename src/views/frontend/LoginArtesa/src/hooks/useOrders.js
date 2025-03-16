import { useState, useEffect } from 'react';
import API from '../api/config';

export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUserOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = localStorage.getItem('userId');
      const response = await API.get(`/api/orders/user/${userId}`);
      if (response.data.success) {
        setOrders(response.data.data);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('Error al cargar las órdenes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderById = async (orderId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get(`/api/orders/${orderId}`);
      if (response.data.success) {
        return response.data.data;
      } else {
        setError(response.data.message);
        return null;
      }
    } catch (error) {
      setError('Error al cargar los detalles de la orden');
      console.error(error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refreshOrders = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
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