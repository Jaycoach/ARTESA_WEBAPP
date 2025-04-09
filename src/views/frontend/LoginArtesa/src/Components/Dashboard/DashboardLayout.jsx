import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import Sidebar from "./SidebarSection/Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { FaBars, FaTimes } from "react-icons/fa";

const DashboardLayout = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("No hay token disponible, redireccionando a login");
        navigate('/login');
        return;
      }
    }
    setLoading(false);
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Botón de menú móvil */}
      <button 
        className="fixed top-4 right-4 z-50 md:hidden bg-primary text-white p-2 rounded-md shadow-md"
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        aria-label="Toggle menu"
      >
        {showMobileMenu ? <FaTimes /> : <FaBars />}
      </button>
      
      {/* Sidebar normal (para tablets y desktop) */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Menu modal para dispositivos móviles */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        >
          <div 
            className="absolute right-0 top-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-primary">Menú</h3>
                <button 
                  onClick={() => setShowMobileMenu(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FaTimes />
                </button>
              </div>
              
              <ul className="space-y-4">
                <li>
                  <Link 
                    to="/dashboard" 
                    className="flex items-center py-2 text-gray-700 hover:text-accent"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <FaHome className="mr-3" /> Dashboard
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/dashboard/orders" 
                    className="flex items-center py-2 text-gray-700 hover:text-accent"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <FaListAlt className="mr-3" /> Pedidos
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/dashboard/invoices" 
                    className="flex items-center py-2 text-gray-700 hover:text-accent"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <FaFileInvoiceDollar className="mr-3" /> Facturas
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/dashboard/products" 
                    className="flex items-center py-2 text-gray-700 hover:text-accent"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <FaBoxes className="mr-3" /> Productos
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/dashboard/settings" 
                    className="flex items-center py-2 text-gray-700 hover:text-accent"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <FaCog className="mr-3" /> Configuración
                  </Link>
                </li>
                
                {user && (user.role === 1 || user.role === 3) && (
                  <li>
                    <Link 
                      to="/dashboard/admin" 
                      className="flex items-center py-2 text-gray-700 hover:text-accent"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <FaTools className="mr-3" /> Administración
                    </Link>
                  </li>
                )}
                
                <li className="border-t border-gray-200 pt-4 mt-4">
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      handleLogout();
                    }}
                    className="flex items-center py-2 text-gray-700 hover:text-red-500 w-full text-left"
                  >
                    <FaSignOutAlt className="mr-3" /> Cerrar Sesión
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Contenido principal */}
      <div className="dashboard-content">
        <div className="main-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;