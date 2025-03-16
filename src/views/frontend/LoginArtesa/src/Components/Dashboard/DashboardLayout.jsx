import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import "./Dashboard.css";
import { useAuth } from "../../hooks/useAuth";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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
  
  if (loading) {
    return (
      <div className="dashboard-loading">
        <p>Cargando...</p>
      </div>
    );
  }
  
  return (
    <div className="dashboard">
      <Sidebar />
      <div className="dashboard-content">
        <Top user={user} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;