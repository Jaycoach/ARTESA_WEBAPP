import React, { useMemo } from 'react';
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

/**
 * Recibe "orders", agrupa los pedidos por día de los últimos 5 días
 * y muestra un BarChart con Recharts.
 */
const StatsChart = ({ orders = [] }) => {
  // useMemo para evitar recalcular en cada render
  const chartData = useMemo(() => {
    // 1. Construimos un arreglo con las fechas de los últimos 5 días (hoy y 4 atrás)
    const days = [];
    const today = new Date();
    for (let i = 4; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      // Normalizamos la hora para comparar solo fechas
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }

    // 2. Creamos un objeto para contar pedidos { "YYYY-MM-DD": numero }
    const countByDay = {};
    days.forEach(d => {
      const dateKey = d.toISOString().split("T")[0];
      countByDay[dateKey] = 0;
    });

    // 3. Recorremos tus pedidos y los sumamos si caen en esos 5 días
    orders.forEach(order => {
      if (!order.order_date) return;
      const orderDate = new Date(order.order_date);
      // normalizamos
      orderDate.setHours(0, 0, 0, 0);
      const dateKey = orderDate.toISOString().split("T")[0];
      if (countByDay[dateKey] !== undefined) {
        countByDay[dateKey]++;
      }
    });

    // 4. Preparamos el array final para Recharts, ej: [{ day: "2025-03-22", Pedidos: 3 }, ... ]
    return days.map(d => {
      const dateKey = d.toISOString().split("T")[0];
      return {
        day: dateKey,
        Pedidos: countByDay[dateKey]
      };
    });
  }, [orders]);

  return (
    <Card className="p-5">
      <h2 className="text-xl font-semibold mb-4">Pedidos de los Últimos 5 Días</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid stroke="#f5f5f5" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Pedidos" fill="#4e73df" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default StatsChart;