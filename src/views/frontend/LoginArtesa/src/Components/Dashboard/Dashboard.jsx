// components/Dashboard/Dashboard.jsx - VERSIÓN CORREGIDA
import * as React from 'react';
import { useState, useEffect } from 'react';
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
import { useAuth } from "../../hooks/useAuth";
import { AUTH_TYPES } from "../../constants/AuthTypes";

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

const getEndpoints = (authType, userId) => {
  if (authType === AUTH_TYPES.BRANCH) {
    return {
      orders: '/branch-orders',
      products: '/branch-dashboard/products',
      invoices: `/branch-orders/invoices?userId=${userId}` // Asumiendo endpoint para facturas branch
    };
  } else {
    return {
      orders: `/orders/user/${userId}`,
      products: '/products',
      invoices: `/orders/invoices?userId=${userId}`
    };
  }
};

const Dashboard = () => {
  const { user, branch, authType, isAuthenticated } = useAuth();

  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState('');
  const [userType, setUserType] = useState('');

  // Para las tarjetas
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalProducts: 0,
    totalInvoices: 0
  });

  // Estados para manejo de carga y errores
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Aquí guardamos los pedidos del usuario
  const [userOrders, setUserOrders] = useState([]);

  // ✅ RECONOCIMIENTO CORRECTO DE USUARIO SEGÚN TIPO
  useEffect(() => {
    if (!isAuthenticated) return;

    if (authType === AUTH_TYPES.BRANCH && branch) {
      // Usuario Branch/Sucursal
      const branchName = branch.branchname || branch.branch_name || branch.manager_name || 'Sucursal';
      setUserName(branchName);
      setUserType('Sucursal');

      console.log('✅ Dashboard configurado para usuario branch:', {
        branchName,
        email: branch.email,
        company: branch.company_name
      });
    } else if (authType === AUTH_TYPES.USER && user) {
      // Usuario Principal
      const principalName = user.nombre || user.name || user.email || user.mail || 'Usuario';
      setUserName(principalName);
      setUserType('Usuario Principal');

      console.log('✅ Dashboard configurado para usuario principal:', {
        name: principalName,
        email: user.email || user.mail
      });
    }
  }, [user, branch, authType, isAuthenticated]);

  // ✅ NUEVA VERSIÓN: Obtener estadísticas con endpoints específicos
  useEffect(() => {
    const fetchStats = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let userId;
        if (authType === AUTH_TYPES.BRANCH && branch) {
          userId = branch.branch_id || branch.client_id;
        } else if (authType === AUTH_TYPES.USER && user) {
          userId = user.id;
        }

        if (!userId) {
          console.error('❌ No se pudo obtener userId:', {
            authType,
            hasUser: !!user,
            hasBranch: !!branch
          });
          setError('Usuario no identificado');
          setLoading(false);
          return;
        }

        console.log('🔄 Cargando estadísticas del dashboard para:', {
          authType,
          userId,
          userName: authType === AUTH_TYPES.BRANCH 
            ? (branch?.branchname || branch?.manager_name) 
            : (user?.nombre || user?.name)
        });

        // ✅ OBTENER ENDPOINTS ESPECÍFICOS SEGÚN TIPO DE USUARIO
        const endpoints = getEndpoints(authType, userId);

        console.log('📡 Endpoints a consultar:', endpoints);

        // ✅ REALIZAR PETICIONES EN PARALELO CON ENDPOINTS CORRECTOS
        const [ordersRes, productsRes, invoicesRes] = await Promise.all([
          API.get(endpoints.orders),
          API.get(endpoints.products),
          API.get(endpoints.invoices).catch(err => {
            console.warn('⚠️ Endpoint de facturas no disponible:', err.message);
            return { data: { data: [] } }; // Fallback si no existe el endpoint
          })
        ]);

        // Extraemos la data con fallbacks
        const ordersData = ordersRes?.data?.data || ordersRes?.data || [];
        const productsData = productsRes?.data?.data || productsRes?.data || [];
        const invoicesData = invoicesRes?.data?.data || invoicesRes?.data || [];

        // Guardamos todos los pedidos en userOrders
        setUserOrders(ordersData);

        // Para las tarjetas
        setStats({
          totalOrders: Array.isArray(ordersData) ? ordersData.length : 0,
          totalProducts: Array.isArray(productsData) ? productsData.length : 0,
          totalInvoices: Array.isArray(invoicesData) ? invoicesData.length : 0
        });

        console.log('✅ Estadísticas cargadas exitosamente:', {
          authType,
          orders: Array.isArray(ordersData) ? ordersData.length : 0,
          products: Array.isArray(productsData) ? productsData.length : 0,
          invoices: Array.isArray(invoicesData) ? invoicesData.length : 0
        });

      } catch (error) {
        console.error("❌ Error obteniendo estadísticas del dashboard:", {
          error: error.message,
          status: error.response?.status,
          authType,
          endpoints: getEndpoints(authType, userId)
        });

        // Mensaje de error específico
        let errorMessage = "Error cargando datos del dashboard";
        
        if (error.response?.status === 404) {
          errorMessage = authType === AUTH_TYPES.BRANCH 
            ? "Algunos endpoints para sucursales aún no están disponibles"
            : "Endpoints del dashboard no encontrados";
        } else if (error.response?.status === 403) {
          errorMessage = "No tienes permisos para acceder a estos datos";
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, branch, authType, isAuthenticated]);

  // ✅ RUTAS DINÁMICAS SEGÚN TIPO DE USUARIO
  const getRoutePrefix = () => {
    return authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
  };

  // ✅ LOADING STATE
  if (loading && isAuthenticated) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        <span className="ml-3">Cargando estadísticas...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="mb-8 rounded-xl shadow-lg overflow-hidden">
        <Banner imageUrl={bannerImage} altText="Banner Artesa" />
      </div>

      <div className={`w-full px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-white rounded-xl shadow-lg ${showProfile ? 'hidden' : ''}`}>
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          {/* ✅ MENSAJE PERSONALIZADO SEGÚN TIPO DE USUARIO */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              Bienvenido al Portal Institucional Artesa, {userName}
            </h1>
            {userType && (
              <p className="text-sm text-blue-600 font-medium mt-1">
                {userType}
                {authType === AUTH_TYPES.BRANCH && branch?.company_name && (
                  <span className="text-gray-600"> • {branch.company_name}</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* ✅ TARJETAS CON RUTAS DINÁMICAS */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <SummaryCard
            title="Mis Pedidos"
            value={stats.totalOrders}
            icon={<FaClipboardList />}
            color="#f6754e"
            link={`${getRoutePrefix()}/orders`}
          />
          <SummaryCard
            title="Catálogo de Productos"
            value={stats.totalProducts}
            icon={<FaBoxOpen />}
            color="#4e9af6"
            link={`${getRoutePrefix()}/products`}
          />
          <SummaryCard
            title="Facturas"
            value={stats.totalInvoices}
            icon={<FaFileInvoice />}
            color="#4ec04e"
            link={`${getRoutePrefix()}/invoices`}
          />
          <SummaryCard
            title="Configuración"
            value=""
            icon={<FaCog />}
            color="#6c5ce7"
            link={`${getRoutePrefix()}/settings`}
          />
        </div>

        <QuickAccess />

        {/* Gráficos con ID dinámico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden h-[400px] flex flex-col">
            <StatsChart />
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden h-[400px] flex flex-col">
            <TopProductsChart
              userId={
                authType === AUTH_TYPES.BRANCH
                  ? branch?.branch_id || branch?.client_id
                  : user?.id
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;