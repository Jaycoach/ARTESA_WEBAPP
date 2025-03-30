import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import API from "../../api/config";

/**
 * Muestra un gráfico de barras con pedidos por mes de los últimos 6 meses
 */
const StatsChart = ({ orders }) => {
  const [monthlyOrders, setMonthlyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMonthlyOrders = async () => {
      try {
        // Obtener el ID del usuario del localStorage
        const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = userInfo.id;
        
        if (!userId) {
          setError("Usuario no identificado");
          return;
        }
        
        const response = await API.get('/orders/monthly-stats', {
          params: { userId, months: 6 }
        });
        
        if (response.data.success) {
          // Transformar datos para el gráfico
          setMonthlyOrders(response.data.data);
        } else {
          throw new Error(response.data.message || 'Error al obtener estadísticas mensuales');
        }
      } catch (err) {
        console.error("Error obteniendo estadísticas mensuales:", err);
        setError("No se pudieron cargar las estadísticas mensuales");
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyOrders();
  }, []);

  if (loading) {
    return (
      <div className="p-5 w-full h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Pedidos de los Últimos 6 Meses</h2>
        <div className="flex justify-center items-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 w-full h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Pedidos de los Últimos 6 Meses</h2>
        <div className="text-red-500 text-center h-[300px] flex items-center justify-center">
          {error}
        </div>
      </div>
    );
  }

  if (monthlyOrders.length === 0) {
    return (
      <div className="p-5 w-full h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Pedidos de los Últimos 6 Meses</h2>
        <div className="text-gray-500 text-center h-[300px] flex items-center justify-center">
          No hay datos disponibles para el período seleccionado
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 w-full h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Pedidos de los Últimos 6 Meses</h2>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthlyOrders}>
          <CartesianGrid stroke="#f5f5f5" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => [`${value} pedidos`, 'Cantidad']} />
          <Legend />
          <Bar dataKey="count" fill="#4e73df" name="Pedidos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;