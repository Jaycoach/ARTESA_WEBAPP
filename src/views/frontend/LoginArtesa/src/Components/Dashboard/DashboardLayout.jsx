import React, { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import { useAuth } from "../../hooks/useAuth";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className={`dashboard`}>
  <Sidebar 
    collapsed={sidebarCollapsed} 
    onToggle={toggleSidebar}
  />
  <div className="dashboard-content">
    <Top user={user} onToggleSidebar={toggleSidebar} />
    <main className="main-content">
      <Outlet />
    </main>
  </div>
</div>
  );
};

export default DashboardLayout;