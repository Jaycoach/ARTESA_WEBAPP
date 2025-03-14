import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../../App.scss";
import { useAuth } from "../../../hooks/useAuth"; 
import { 
  FaHome, 
  FaListAlt, 
  FaFileInvoiceDollar, 
  FaBoxes,
  FaCog,
  FaSignOutAlt,
  FaAngleLeft,
  FaAngleRight,
  FaTools // Icono para administración
} from "react-icons/fa";

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth(); // Obtener el usuario y la función logout del contexto
  
  // Verificar si el usuario tiene permisos de administración (rol 1 o 3)
  console.log("User en Sidebar:", user);
  const hasAdminPermission = user && (user.role === 1 || user.role === 3);
  console.log("¿Tiene permisos de admin?:", hasAdminPermission, "Role:", user?.role);
  
  // Detectar la ruta activa para resaltar el menú correspondiente
  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') {
      return true;
    }
    return location.pathname.startsWith(path);
  };
  
  const handleLogout = () => {
    // Usar la función logout del contexto
    logout();
    navigate("/"); // Redirigir a la página de inicio
  };

  return (
    <div
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      onMouseEnter={() => setCollapsed(false)}  
      onMouseLeave={() => setCollapsed(true)}
    >
      <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? <FaAngleRight /> : <FaAngleLeft />}
      </button>

      <div className="sidebar-menu">
        {!collapsed && <h3>Menú</h3>}
        <ul>
          <li>
            <button 
              className={isActive('/dashboard') && location.pathname === '/dashboard' ? 'active' : ''}
              onClick={() => navigate("/dashboard")}
            >
              <FaHome className="menu-icon" />
              <span className="menu-text">Inicio</span>
            </button>
          </li>
          <li>
            <button 
              className={isActive('/dashboard/orders') ? 'active' : ''}
              onClick={() => navigate("/dashboard/orders")}
            >
              <FaListAlt className="menu-icon" />
              <span className="menu-text">Pedidos</span>
            </button>
          </li>
          <li>
            <button 
              className={isActive('/dashboard/invoices') ? 'active' : ''}
              onClick={() => navigate("/dashboard/invoices")}
            >
              <FaFileInvoiceDollar className="menu-icon" />
              <span className="menu-text">Facturas</span>
            </button>
          </li>
          <li>
            <button 
              className={isActive('/dashboard/products') ? 'active' : ''}
              onClick={() => navigate("/dashboard/products")}
            >
              <FaBoxes className="menu-icon" />
              <span className="menu-text">Productos</span>
            </button>
          </li>
          
          {!collapsed && (
            <li className="separator">
              <hr />
            </li>
          )}
          
          <li>
            <button 
              className={isActive('/dashboard/settings') ? 'active' : ''}
              onClick={() => navigate('/dashboard/settings')}
            >
              <FaCog className="menu-icon" />
              <span className="menu-text">Configuración</span>
            </button>
          </li>
          
          {/* Opción de Administración - Solo visible para roles 1 y 3 */}
          {/* Opción de Administración - Solo visible para roles 1 y 3 */}
          {user && (parseInt(user.role) === 1 || parseInt(user.role) === 3) && (
            <li>
              <button 
                className={isActive('/dashboard/admin') ? 'active' : ''}
                onClick={() => navigate('/dashboard/admin')}
              >
                <FaTools className="menu-icon" />
                <span className="menu-text">Administración</span>
              </button>
            </li>
          )}
          
          <li>
            <button onClick={handleLogout}>
              <FaSignOutAlt className="menu-icon" />
              <span className="menu-text">Cerrar Sesión</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;