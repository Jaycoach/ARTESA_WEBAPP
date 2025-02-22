import React, { useState } from "react";
import "./Sidebar.scss";

const Sidebar = ({ setActiveSection }) => {
  const [collapsed, setCollapsed] = useState(true);

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
          <button onClick={() => setActiveSection("home")}>Inicio</button>
        </li>
        <li>
          <button onClick={() => setActiveSection("orders")}>Pedidos</button>
        </li>
        <li>
          <button onClick={() => setActiveSection("invoices")}>Facturas</button>
        </li>
        <li>
          <button onClick={() => setActiveSection("products")}>Productos</button>
        </li>
        <li>
          <button onClick={() => setActiveSection("settings")}>Configuración</button>
        </li>
      </ul>
    </div>
  </div>
);
};

export default Sidebar;