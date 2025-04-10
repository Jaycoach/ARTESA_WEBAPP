import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import Sidebar from "./SidebarSection/Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { FaBars, FaTimes } from "react-icons/fa";

const DashboardLayout = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, isAuthenticated } = useAuth();

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
    return <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Barra superior */}
      <div className="fixed top-0 left-0 right-0 z-30 h-14 bg-primary text-white">
        <Top user={user} onToggleSidebar={toggleSidebar} />
      </div>

      <div className="flex mt-14 w-full">
        {/* Sidebar con transición suave */}
        <div className={`fixed left-0 top-14 bottom-0 overflow-y-auto transition-all duration-300 bg-primary z-20 ${sidebarCollapsed ? 'w-16' : 'w-64'
          }`}>
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </div>

        {/* Contenido principal con margen ajustado */}
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'
          }`}>
          <main className="p-4 md:p-6 lg:p-8 h-[calc(100vh-3.5rem)] overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;