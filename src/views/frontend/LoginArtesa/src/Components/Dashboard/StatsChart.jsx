import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from "../ui/Card";

const data = [
  { mes: 'Ene', Pedidos: 12 },
  { mes: 'Feb', Pedidos: 15 },
  { mes: 'Mar', Pedidos: 8 },
  { mes: 'Abr', Pedidos: 14 },
  { mes: 'May', Pedidos: 17 },
  { mes: 'Jun', Pedidos: 11 },
  { mes: 'Jul', Pedidos: 10 },
  { mes: 'Ago', Pedidos: 13 },
  { mes: 'Sep', Pedidos: 9 },
  { mes: 'Oct', Pedidos: 18 },
  { mes: 'Nov', Pedidos: 16 },
  { mes: 'Dic', Pedidos: 14 },
];

const StatsChart = () => {
  return (
    <Card className="mb-8 p-5">
      <h2 className="text-xl font-semibold mb-4">Pedidos Realizados por Mes</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid stroke="#f5f5f5" />
          <XAxis dataKey="mes" />
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