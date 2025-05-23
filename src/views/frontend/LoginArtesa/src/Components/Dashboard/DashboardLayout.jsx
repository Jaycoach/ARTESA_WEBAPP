import React, { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import { useAuth } from "../../hooks/useAuth";
import { FaBars, FaTimes } from "react-icons/fa";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Efecto para manejar cambios de tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      // En móvil, controlamos la visualización del menú móvil
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      // En desktop, controlamos el colapso/expansión del sidebar
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      {/* Barra superior */}
      <div className="fixed top-0 left-0 right-0 z-30 h-14 bg-primary text-white">
        <Top user={user} onToggleSidebar={toggleSidebar} />
      </div>

      <div className="flex mt-14 w-full">
        {/* Sidebar para escritorio - oculto en móvil por defecto */}
        <div
          className={`
    fixed left-0 top-14 bottom-0 
    overflow-y-auto bg-primary z-20
    transition-all duration-300 ease-in-out
    hidden md:block
    ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'}
  `}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            mobileMenuOpen={false}  // No es menú móvil aquí
            onCloseMobileMenu={() => { }}  // No hace nada en escritorio
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Overlay para menú móvil */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
        )}

        {/* Menú móvil */}
        <div
          className={`
    fixed left-0 top-14 bottom-0 
    overflow-y-auto bg-primary z-30
    transition-all duration-300 ease-in-out
    md:hidden
    ${mobileMenuOpen ? 'w-64' : 'w-0'}
  `}
        >
          {mobileMenuOpen && (
            <Sidebar
              collapsed={false}
              mobileMenuOpen={mobileMenuOpen}
              onCloseMobileMenu={() => setMobileMenuOpen(false)}
              onToggleCollapse={toggleSidebar}
            />
          )}
        </div>

        {/* Contenido principal con márgenes dinámicos adaptados a dispositivos */}
        <div
          className={`
            flex-1 transition-all duration-300
            w-full 
            ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}
          `}
        >
          <main className="px-2 sm:px-4 md:px-5 lg:px-6 py-3 sm:py-4 md:py-5 h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="w-full mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;