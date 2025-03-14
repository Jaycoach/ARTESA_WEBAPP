import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../../App.scss";
import { useAuth } from "../../../hooks/useAuth"; // Importar el hook de autenticación
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
  const { user } = useAuth(); // Obtener el usuario del contexto
  
  // Verificar si el usuario tiene permisos de administración (rol 1 o 3)
  const hasAdminPermission = user && (user.role === 1 || user.role === 3);
  
  // Detectar la ruta activa para resaltar el menú correspondiente
  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') {
      return true;
    }
    return location.pathname.startsWith(path);
  };
  
  const handleLogout = () => {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('clientProfile');
    
    console.log('Sesión cerrada');
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
          {hasAdminPermission && (
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