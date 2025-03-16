import React, { useState, useEffect } from 'react';
import '../../App.scss';
import { Link } from 'react-router-dom';
import { FaUserCircle, FaShoppingBag, FaBoxOpen, FaMoneyBillWave, FaUsers, FaSearch, FaFilter } from "react-icons/fa";
import Banner from "./Body Section/Banner/Banner";
import ClientProfile from "./ClientProfile/ClientProfile";
import bannerImage from "../../DashboardAssets/Banner_dash2.png";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Card from "../ui/Card";
import Modal from "../ui/Modal";

// Componente para tarjetas de resumen usando Tailwind directamente
const SummaryCard = ({ title, value, icon, color, link, additionalInfo }) => (
  <Link to={link} className="summary-card-link">
    <Card className="summary-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="card-icon" style={{ backgroundColor: `${color}20`, color }}>
        {icon}
      </div>
      <div className="card-content">
        <h3>{title}</h3>
        <p className="card-value">{value}</p>
        {additionalInfo && (
          <div className="additional-info">
            {additionalInfo.map((info, index) => (
              <span key={index} className="info-tag">{info}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  </Link>
);

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [recentOrders, setRecentOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0,
    totalCustomers: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    // Obtener información del usuario
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        const userData = JSON.parse(userInfo);
        setUser(userData);
        setUserName(userData.nombre || userData.name || '');
        setUserEmail(userData.email || userData.mail || '');
        
        const clientProfile = localStorage.getItem('clientProfile');
        if (clientProfile) {
          const profileData = JSON.parse(clientProfile);
          if (profileData.nombre) {
            setUserName(profileData.nombre);
          }
        }
      } catch (error) {
        console.error("Error al parsear datos del usuario:", error);
      }
    }

    // Simulación de datos para el dashboard
    setRecentOrders([
      { id: 1, cliente: "Lina Romero", productos: "Pan Blanco, Croissant", total: "$15.50" },
      { id: 2, cliente: "Lukas Zuniga", productos: "Donas, Pan Integral", total: "$10.00" }
    ]);

    setStats({
      totalOrders: 124,
      totalProducts: 35,
      totalRevenue: "$2,450.80",
      totalCustomers: 48
    });
  }, []);

  const toggleProfile = () => {
    setShowProfile(!showProfile);
  };

  const updateUserName = (name) => {
    setUserName(name);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Filtrar órdenes basado en la búsqueda
  const filteredOrders = recentOrders.filter(order => 
    order.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.productos.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full p-5 overflow-y-auto">
      {/* Header con perfil de usuario */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-semibold text-gray-800">Bienvenido, {userName || "Usuario"}</h1>
        {user && (
          <div className="flex items-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors" 
               onClick={toggleProfile}>
            <FaUserCircle className="text-3xl text-gray-600 mr-3" />
            <div className="flex flex-col">
              <span className="font-medium text-gray-800">{userName || userEmail}</span>
              <span className="text-xs text-gray-500">Ver perfil</span>
            </div>
          </div>
        )}
      </div>

      {/* Banner de Artesa */}
      <div className="w-full mb-6 rounded-xl overflow-hidden shadow-md">
        <Banner imageUrl={bannerImage} altText="Banner Artesa" />
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <SummaryCard 
          title="Pedidos Totales" 
          value={stats.totalOrders} 
          icon={<FaShoppingBag className="text-xl" />} 
          color="#f6754e"
          link="/dashboard/orders" 
        />
        <SummaryCard 
          title="Productos" 
          value={stats.totalProducts} 
          icon={<FaBoxOpen className="text-xl" />} 
          color="#4e9af6"
          link="/dashboard/products" 
        />
        <SummaryCard 
          title="Facturas" 
          value={stats.totalRevenue} 
          icon={<FaMoneyBillWave className="text-xl" />} 
          color="#4ec04e"
          link="/dashboard/invoices"
          additionalInfo={["Ver facturas", "Facturas pendientes: 3", "Facturas activas: 8"]}
        />
        <SummaryCard 
          title="Clientes" 
          value={stats.totalCustomers} 
          icon={<FaUsers className="text-xl" />} 
          color="#9a4ef6"
          link="/dashboard/clients" 
        />
      </div>

      {/* Sección de Pedidos Activos con búsqueda */}
      <Card className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-3 md:mb-0">Pedidos activos</h2>
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input 
                type="text" 
                placeholder="Buscar pedidos..." 
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={toggleFilters}
            >
              <FaFilter /> Filtros
            </Button>
            <Link to="/dashboard/orders">
              <Button variant="primary">
                Ver todos
              </Button>
            </Link>
          </div>
        </div>
        
        {showFilters && (
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-3">
            <Input 
              type="date" 
              placeholder="Filtrar por fecha" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex-grow md:flex-grow-0"
            />
            <Button 
              variant="secondary" 
              onClick={() => setDateFilter('')}
            >
              Limpiar
            </Button>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">#{order.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{order.cliente}</td>
                    <td className="px-6 py-4">{order.productos}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{order.total}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Link to={`/dashboard/orders/${order.id}`}>
                          <Button variant="secondary" className="text-xs py-1 px-3">
                            Ver
                          </Button>
                        </Link>
                        <Link to={`/dashboard/orders/${order.id}/edit`}>
                          <Button variant="primary" className="text-xs py-1 px-3">
                            Editar
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No se encontraron pedidos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sección Actividad Reciente */}
      <Card>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Actividad Reciente</h2>
        </div>
        <div className="p-4">
          <div className="space-y-6">
            <div className="flex">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 text-orange-500 mr-4">
                <FaShoppingBag />
              </div>
              <div>
                <p className="text-gray-800"><span className="font-semibold">Nuevo pedido</span> - Lina Romero ha realizado un nuevo pedido</p>
                <span className="text-xs text-gray-500">Hace 2 horas</span>
              </div>
            </div>
            <div className="flex">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-500 mr-4">
                <FaBoxOpen />
              </div>
              <div>
                <p className="text-gray-800"><span className="font-semibold">Producto actualizado</span> - El inventario de Pan Integral ha sido actualizado</p>
                <span className="text-xs text-gray-500">Hace 5 horas</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal del formulario de perfil usando el componente Modal */}
      {showProfile && user && (
        <Modal 
          isOpen={showProfile} 
          onClose={toggleProfile} 
          title="Perfil de Usuario"
        >
          <ClientProfile 
            user={user} 
            onClose={toggleProfile} 
            onProfileUpdate={updateUserName}
          />
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;