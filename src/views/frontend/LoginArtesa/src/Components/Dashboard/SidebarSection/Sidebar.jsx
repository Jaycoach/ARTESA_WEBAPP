import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Sidebar.scss";

const Sidebar = ({ setActiveSection }) => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const handleLogout = () => {
    navigate("/"); // Redirigir a la página de login
  };

  return (
    <div
    className={`sidebar ${collapsed ? "collapsed" : ""}`}
    onMouseEnter={() => setCollapsed(false)}  
    onMouseLeave={() => setCollapsed(true)}
    >
    <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)}>
      {collapsed ? "▶" : "◀"}
    </button>

    <div className="sidebar-menu">
      {!collapsed && <h3>Menú</h3>}
      <ul>
        <li>
          <button onClick={() => navigate("/dashboard")}>Inicio</button>
        </li>
        <li>
          <button onClick={() => navigate("/dashboard/orders")}>Pedidos</button>
        </li>
        <li>
          <button onClick={() => navigate("/dashboard/invoices")}>Facturas</button>
        </li>
        <li>
          <button onClick={() => navigate("/dashboard/products")}>Productos</button>
        </li>
        {!collapsed && (
          <li className="separator">
          <hr />
        </li>
        )
        }
        <li>
          <button onClick={() => navigate('/dashboard/settings')}>Configuracion</button>
        </li>
        <li>
          <button onClick={handleLogout}>Cerrar Sesion</button>
        </li>
      </ul>
    </div>
  </div>
);
};

export default Sidebar;