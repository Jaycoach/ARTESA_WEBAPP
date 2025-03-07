import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../../App.scss";

const Sidebar = ({ setActiveSection }) => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/"); // Redirigir a la página de login
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <nav className="sidebar_menu">
        <ul className="sidebar_list">
          <li>
            <button onClick={() => navigate("/dashboard")}>
              <i className="fas fa-home"></i> <span>Inicio</span>
            </button>
          </li>
          <li>
            <button onClick={() => navigate("/dashboard/orders")}>
              <i className="fas fa-box"></i> <span>Pedidos</span>
            </button>
          </li>
          <li>
        <button onClick={() => navigate("/dashboard/invoices")}>
          <i className="fas fa-file-invoice"></i> <span>Facturas</span>
        </button>
      </li>
      <li>
        <button onClick={() => navigate("/dashboard/products")}>
          <i className="fas fa-box-open"></i> <span>Productos</span>
        </button>
      </li>

      <li className="sidebar_separator"><hr /></li>

      <li>
        <button onClick={() => navigate('/dashboard/settings')}>
          <i className="fas fa-cog"></i> <span>Configuración</span>
        </button>
      </li>
    </ul>
  </nav>
  <div className="sidebar_footer">
    <button onClick={handleLogout} className="sidebar_logout">
      <i className="fas fa-sign-out-alt"></i> <span>Cerrar Sesión</span>
    </button>
  </div>
</aside>
  );
};

export default Sidebar;