import React from "react";
import { Outlet } from "react-router-dom"; // Para renderizar contenido dinámico
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import "../../App.css";
import "./Dashboard.css";

const DashboardLayout = () => {
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