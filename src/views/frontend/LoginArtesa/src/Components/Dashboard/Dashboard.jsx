import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaClipboardList, FaBoxOpen, FaFileInvoice, FaCog,
  FaMoon, FaSun
} from "react-icons/fa";
import Banner from "./Body Section/Banner/Banner";
import ClientProfile from "./ClientProfile/ClientProfile";
import bannerImage from "../../DashboardAssets/Banner_dash2.png";
import Button from "../ui/Button";
import Card from "../ui/Card";
import QuickAccess from "./QuickAccess";
import StatsChart from "./StatsChart";
import TopProductsChart from "./TopProductsChart";
import API from "../../api/config";

// Reutilizamos tu SummaryCard
const SummaryCard = ({ title, value, icon, color, link }) => (
  <Link to={link}>
    <Card className="flex flex-col sm:flex-row items-center sm:justify-between p-3 sm:p-4 md:p-5 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto justify-center sm:justify-start mb-2 sm:mb-0">
        <div className="p-2 sm:p-3 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
        <span className="text-gray-700 font-medium">{title}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
    </Card>
  </Link>
);

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState('');

  // Para las tarjetas
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalProducts: 0,
    totalInvoices: 0
  });

  // Aquí guardamos los pedidos del usuario
  const [userOrders, setUserOrders] = useState([]);

  useEffect(() => {
    // Cargamos el usuario logueado desde localStorage
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userInfo);
    setUserName(userInfo.nombre || userInfo.name || 'Usuario');
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!user || !user.id) return;
        const userId = user.id;

        // Obtenemos pedidos, productos y facturas del usuario
        const [ordersRes, productsRes, invoicesRes] = await Promise.all([
          API.get(`/orders/user/${userId}`),
          API.get('/products'),
          API.get(`/orders/invoices?userId=${userId}`)
        ]);

        // Extraemos la data
        const ordersData = ordersRes?.data?.data || [];
        const productsData = productsRes?.data?.data || [];
        const invoicesData = invoicesRes?.data?.data || [];

        // Guardamos todos los pedidos en userOrders
        setUserOrders(ordersData);

        // Para las tarjetas
        setStats({
          totalOrders: ordersData.length,
          totalProducts: productsData.length,
          totalInvoices: invoicesData.length
        });
      } catch (error) {
        console.error("Error obteniendo estadísticas del dashboard:", error);
      }
    };

    fetchStats();
  }, [user]);

  return (
    <div className="w-full h-full">
      <div className="mb-8 rounded-xl shadow-lg overflow-hidden">
        <Banner imageUrl={bannerImage} altText="Banner Artesa" />
      </div>
      <div className={`w-full px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-white rounded-xl shadow-lg ${showProfile ? 'hidden' : ''}`}>
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Bienvenido al Portal Institucional Artesa, {userName}</h1>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <SummaryCard
            title="Mis Pedidos"
            value={stats.totalOrders}
            icon={<FaClipboardList />}
            color="#f6754e"
            link="/dashboard/orders"
          />
          <SummaryCard
            title="Catálogo de Productos"
            value={stats.totalProducts}
            icon={<FaBoxOpen />}
            color="#4e9af6"
            link="/dashboard/products"
          />
          <SummaryCard
            title="Facturas"
            value={stats.totalInvoices}
            icon={<FaFileInvoice />}
            color="#4ec04e"
            link="/dashboard/invoices"
          />
          <SummaryCard
            title="Configuración"
            value=""
            icon={<FaCog />}
            color="#6c5ce7"
            link="/dashboard/settings"
          />
        </div>

        <QuickAccess />

        {/* Gráfico de barras con los pedidos reales del usuario */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden h-[400px] flex flex-col">
            <StatsChart />
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden h-[400px] flex flex-col">
            <TopProductsChart userId={user?.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;