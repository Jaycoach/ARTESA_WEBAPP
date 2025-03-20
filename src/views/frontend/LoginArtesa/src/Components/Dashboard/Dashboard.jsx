import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaClipboardList, FaBoxOpen, FaFileInvoice, FaUsers, FaSearch, FaFilter, FaBell, FaMoon, FaSun } from "react-icons/fa";
import Banner from "./Body Section/Banner/Banner";
import ClientProfile from "./ClientProfile/ClientProfile";
import bannerImage from "../../DashboardAssets/Banner_dash2.png";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";
import Modal from "../ui/Modal";
import QuickAccess from "./QuickAccess";
import StatsChart from "./StatsChart";

const SummaryCard = ({ title, value, icon, color, link }) => (
  <Link to={link}>
    <Card className="flex items-center justify-between p-5 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full`} style={{ backgroundColor: `${color}20`, color }}>
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
  const [recentOrders, setRecentOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userInfo);
    setUserName(userInfo.nombre || userInfo.name || 'Usuario');

    setRecentOrders([
      { id: 1, cliente: "Lina Romero", productos: "Pan Blanco, Croissant", total: "$15.50" },
      { id: 2, cliente: "Lukas Zuniga", productos: "Donas, Pan Integral", total: "$10.00" }
    ]);

    setStats({
      totalOrders: 12,
      totalProducts: 35,
      totalInvoices: 8,
      totalPendingInvoices: 3
    });
  }, []);

  return (
    <div className={`w-full px-8 py-6 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold">Bienvenido, {userName}</h1>
      <Button variant="outline" onClick={() => setDarkMode(!darkMode)} className="shadow-sm">
        {darkMode ? <FaSun /> : <FaMoon />}
      </Button>
    </div>
  
    <div className="mb-8 rounded-xl shadow-lg overflow-hidden">
      <Banner imageUrl={bannerImage} altText="Banner Artesa" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <SummaryCard title="Mis Pedidos" value={stats.totalOrders} icon={<FaClipboardList />} color="#f6754e" link="/dashboard/orders" />
        <SummaryCard title="Productos Disponibles" value={stats.totalProducts} icon={<FaBoxOpen />} color="#4e9af6" link="/dashboard/products" />
        <SummaryCard title="Facturas" value={stats.totalInvoices} icon={<FaFileInvoice />} color="#4ec04e" link="/dashboard/invoices" />
        <SummaryCard title="Pendientes" value={stats.totalPendingInvoices} icon={<FaUsers />} color="#9a4ef6" link="/dashboard/invoices/pending" />
    </div>
    <QuickAccess />
  
    <StatsChart />
  </div>
  );
};

export default Dashboard;