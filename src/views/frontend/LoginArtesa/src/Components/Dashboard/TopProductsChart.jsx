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
import Card from "../ui/Card";
import API from "../../api/config";

/**
 * Componente que muestra el Top 5 de productos más pedidos
 */
const TopProductsChart = ({ userId }) => {
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopProducts = async () => {
      try {
        if (!userId) return;
        
        // Calculamos fecha de hace 30 días
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        
        // Formato YYYY-MM-DD para la API
        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = endDate.toISOString().split('T')[0];
        
        // Llamada a la API con los parámetros
        const response = await API.get(`/orders/top-products`, {
          params: {
            limit: 5,
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            userId
          }
        });
        
        if (response.data.success) {
          // Transformar datos para el gráfico
          const chartData = response.data.data.map(product => ({
            name: product.product_name,
            cantidad: parseInt(product.quantity),
            product_id: product.product_id
          }));
          
          setTopProducts(chartData);
        }
      } catch (err) {
        console.error("Error obteniendo top productos:", err);
        setError("No se pudieron cargar los productos más vendidos");
      } finally {
        setLoading(false);
      }
    };

    fetchTopProducts();
  }, [userId]);

  if (loading) {
    return (
        <div className="p-5 w-full h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Top 5 Productos</h2>
        <div className="flex justify-center items-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-5 w-full h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Top 5 Productos</h2>
        <div className="text-red-500 text-center h-[300px] flex items-center justify-center">
          {error}
        </div>
        </div>
    );
  }

  if (topProducts.length === 0) {
    return (
        <div className="p-5 w-full h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Top 5 Productos</h2>
        <div className="text-gray-500 text-center h-[300px] flex items-center justify-center">
          No hay datos disponibles para el período seleccionado
        </div>
        </div>
    );
  }

  return (
    <div className="p-5 w-full h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Top 5 Productos (Últimos 30 días)</h2>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={topProducts}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={180}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => {
                return value.length > 20 ? value.substring(0, 20) + '...' : value;
            }}
            />
          <Tooltip 
            formatter={(value, name) => [value, 'Cantidad']}
            labelFormatter={(label) => `Producto: ${label}`}
            />
          <Legend />
          <Bar dataKey="cantidad" fill="#4e9af6" name="Cantidad" />
        </BarChart>
      </ResponsiveContainer>
      </div>
  );
};

export default TopProductsChart;