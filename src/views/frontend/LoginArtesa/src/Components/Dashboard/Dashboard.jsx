// components/Dashboard/Dashboard.jsx - VERSIÓN CORREGIDA PARA BRANCH
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaClipboardList, FaBoxOpen, FaFileInvoice, FaCog
} from "react-icons/fa";
import Banner from "./Body Section/Banner/Banner";
import bannerImage from "../../DashboardAssets/Banner_dash2.png";
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
  const [userOrders, setUserOrders] = useState([]);

  // ✅ RECONOCIMIENTO CORRECTO DE USUARIO SEGÚN TIPO
  useEffect(() => {
    if (!isAuthenticated) return;

    if (authType === AUTH_TYPES.BRANCH && branch) {
      const branchName = branch.branchname || branch.branch_name || branch.manager_name || 'Sucursal';
      setUserName(branchName);
      setUserType('Sucursal');

      console.log('✅ Dashboard configurado para usuario branch:', {
        branchName,
        email: branch.email,
        company: branch.company_name
      });
    } else if (authType === AUTH_TYPES.USER && user) {
      const principalName = user.nombre || user.name || user.email || user.mail || 'Usuario';
      setUserName(principalName);
      setUserType('Usuario Principal');

      console.log('✅ Dashboard configurado para usuario principal:', {
        name: principalName,
        email: user.email || user.mail
      });
    }
  }, [user, branch, authType, isAuthenticated]);

  // ✅ FUNCIÓN SEPARADA PARA BRANCH Y USUARIO PRINCIPAL
  useEffect(() => {
    const fetchStats = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (authType === AUTH_TYPES.BRANCH) {
          // ✅ LÓGICA ESPECÍFICA PARA BRANCH - SIN userId, SOLO TOKEN BEARER
          await fetchBranchStats();
        } else {
          // ✅ LÓGICA PARA USUARIO PRINCIPAL
          await fetchUserStats();
        }
      } catch (error) {
        console.error("❌ Error general obteniendo estadísticas:", {
          error: error.message,
          status: error.response?.status,
          authType
        });

        let errorMessage = "Error cargando datos del dashboard";
        
        if (error.response?.status === 404) {
          errorMessage = authType === AUTH_TYPES.BRANCH 
            ? "Algunos endpoints para sucursales no están disponibles"
            : "Endpoints del dashboard no encontrados";
        } else if (error.response?.status === 403) {
          errorMessage = "No tienes permisos para acceder a estos datos";
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    // ✅ FUNCIÓN ESPECÍFICA PARA BRANCH - SOLO TOKEN BEARER
    const fetchBranchStats = async () => {
      console.log('🔄 [BRANCH] Cargando estadísticas para sucursal:', {
        branchName: branch?.branchname,
        branchId: branch?.branch_id
      });

      // ✅ ENDPOINTS ESPECÍFICOS PARA BRANCH - SIN PARÁMETROS
      const branchEndpoints = {
        orders: '/branch-orders/orders',
        products: '/branch-orders/products',
        invoices: '/orders/invoices'
      };

      console.log('📡 [BRANCH] Endpoints a consultar:', branchEndpoints);

      const results = {
        totalOrders: 0,
        totalProducts: 0,
        totalInvoices: 0
      };

      // ✅ PETICIÓN DE ÓRDENES BRANCH
      try {
        console.log('🔄 [BRANCH] Consultando órdenes...');
        const ordersResponse = await API.get(branchEndpoints.orders);
        console.log('✅ [BRANCH] Órdenes obtenidas:', ordersResponse.data);
        
        const ordersData = ordersResponse.data?.data || ordersResponse.data || [];
        results.totalOrders = Array.isArray(ordersData) ? ordersData.length : 0;
        setUserOrders(Array.isArray(ordersData) ? ordersData : []);
        
        console.log(`📊 [BRANCH] Total de órdenes: ${results.totalOrders}`);
      } catch (error) {
        console.warn('⚠️ [BRANCH] Error obteniendo órdenes:', error.message);
      }

      // ✅ PETICIÓN DE PRODUCTOS BRANCH
      try {
        console.log('🔄 [BRANCH] Consultando productos heredados...');
        const productsResponse = await API.get(branchEndpoints.products);
        console.log('✅ [BRANCH] Productos obtenidos:', productsResponse.data);
        const productsData = productsResponse.data?.data?.products || [];
        results.totalProducts = Array.isArray(productsData) ? productsData.length : 0;
        
        console.log(`📊 [BRANCH] Total de productos: ${results.totalProducts}`);
      } catch (error) {
        console.warn('⚠️ [BRANCH] Error obteniendo productos:', error.message);
      }

      // ✅ PETICIÓN DE FACTURAS BRANCH
      try {
        console.log('🔄 [BRANCH] Consultando facturas...');
        const invoicesResponse = await API.get(branchEndpoints.invoices);
        console.log('✅ [BRANCH] Facturas obtenidas:', invoicesResponse.data);
        
        const invoicesData = invoicesResponse.data?.data || invoicesResponse.data || [];
        results.totalInvoices = Array.isArray(invoicesData) ? invoicesData.length : 0;
        
        console.log(`📊 [BRANCH] Total de facturas: ${results.totalInvoices}`);
      } catch (error) {
        console.warn('⚠️ [BRANCH] Error obteniendo facturas:', error.message);
      }

      // ✅ ACTUALIZAR ESTADÍSTICAS
      setStats(results);
      console.log('✅ [BRANCH] Estadísticas finales cargadas:', results);
    };

    // ✅ FUNCIÓN PARA USUARIO PRINCIPAL
    const fetchUserStats = async () => {
      const userId = user?.id;
      if (!userId) {
        console.error('❌ No se pudo obtener userId para usuario principal');
        setError('Usuario no identificado');
        return;
      }

      console.log('🔄 [USER] Cargando estadísticas para usuario principal:', {
        userId,
        userName: user?.nombre || user?.name
      });

      // ✅ ENDPOINTS ESPECÍFICOS PARA USUARIO PRINCIPAL
      const userEndpoints = {
        orders: `/orders/user/${userId}`,
        products: '/products',
        invoices: `/orders/invoices?userId=${userId}`
      };

      console.log('📡 [USER] Endpoints a consultar:', userEndpoints);

      const results = {
        totalOrders: 0,
        totalProducts: 0,
        totalInvoices: 0
      };

      // ✅ PETICIÓN DE ÓRDENES USUARIO
      try {
        console.log('🔄 [USER] Consultando órdenes del usuario...');
        const ordersResponse = await API.get(userEndpoints.orders);
        console.log('✅ [USER] Órdenes obtenidas:', ordersResponse.data);

        const ordersData = ordersResponse.data?.data || ordersResponse.data || [];
        results.totalOrders = Array.isArray(ordersData) ? ordersData.length : 0;
        setUserOrders(Array.isArray(ordersData) ? ordersData : []);

        console.log(`📊 [USER] Total de órdenes: ${results.totalOrders}`);
      } catch (error) {
        console.warn('⚠️ [USER] Error obteniendo órdenes:', error.message);
      }

      // ✅ PETICIÓN DE PRODUCTOS USUARIO
      try {
        console.log('🔄 [USER] Consultando catálogo de productos...');
        const productsResponse = await API.get(userEndpoints.products);
        console.log('✅ [USER] Productos obtenidos:', productsResponse.data);

        const productsData = productsResponse.data?.data || productsResponse.data || [];
        results.totalProducts = Array.isArray(productsData) ? productsData.length : 0;

        console.log(`📊 [USER] Total de productos: ${results.totalProducts}`);
      } catch (error) {
        console.warn('⚠️ [USER] Error obteniendo productos:', error.message);
      }

      // ✅ PETICIÓN DE FACTURAS USUARIO
      try {
        console.log('🔄 [USER] Consultando facturas del usuario...');
        const invoicesResponse = await API.get(userEndpoints.invoices);
        console.log('✅ [USER] Facturas obtenidas:', invoicesResponse.data);

        const invoicesData = invoicesResponse.data?.data || invoicesResponse.data || [];
        results.totalInvoices = Array.isArray(invoicesData) ? invoicesData.length : 0;

        console.log(`📊 [USER] Total de facturas: ${results.totalInvoices}`);
      } catch (error) {
        console.warn('⚠️ [USER] Error obteniendo facturas:', error.message);
      }

      // ✅ ACTUALIZAR ESTADÍSTICAS
      setStats(results);
      console.log('✅ [USER] Estadísticas finales cargadas:', results);
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

  // ✅ ERROR STATE
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error cargando dashboard</h3>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
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

        {/* ✅ TARJETAS CON DATOS REALES */}
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

        {/* ✅ PASAR AUTHTYPE A QUICKACCESS */}
        <QuickAccess authType={authType} />

        {/* Gráficos con configuración para Branch */}
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
              authType={authType}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;