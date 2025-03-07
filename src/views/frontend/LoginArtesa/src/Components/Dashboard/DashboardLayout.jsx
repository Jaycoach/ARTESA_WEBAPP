import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import "./Dashboard.css";
import { useAuth } from "../../hooks/useAuth"; // Importar el hook de autenticación

const DashboardLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth(); // Obtener user y estado de autenticación del contexto

  useEffect(() => {
    // Verificar autenticación usando el contexto
    if (!isAuthenticated) {
      // Si no está autenticado según el contexto, verificar el token local
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("No hay token disponible, redireccionando a login");
        navigate('/login');
        return;
      }
    }
    
    // Si llegamos aquí, el usuario está autenticado
    setLoading(false);
  }, [isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <h2>Cargando dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Navbar superior */}
      <Top />

      {/* Contenedor principal con Sidebar y área de contenido */}
      <div className="dashboard-layout">
        {/* Sidebar a la izquierda */}
        <Sidebar />

        {/* Contenido dinámico a la derecha */}
        <div className="dashboard-content">
          <Outlet /> {/* Aquí se renderizarán las demás páginas */}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;