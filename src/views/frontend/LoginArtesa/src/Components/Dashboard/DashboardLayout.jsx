import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import "./Dashboard.css";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Verificar si hay usuario en localStorage
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token) {
      console.error("No hay token disponible, redireccionando a login");
      navigate('/login');
      return;
    }

    try {
      // Parsear el usuario si existe
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        console.log("Usuario cargado:", userData);
      } else {
        console.error("No hay información de usuario, redireccionando a login");
        navigate('/login');
        return;
      }
    } catch (error) {
      console.error("Error al parsear datos del usuario:", error);
      navigate('/login');
      return;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

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
      <Top user={user} />

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