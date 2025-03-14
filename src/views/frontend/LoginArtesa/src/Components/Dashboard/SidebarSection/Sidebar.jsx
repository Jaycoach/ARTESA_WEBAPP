import React, { useState, useEffect } from "react";
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
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  
  // Verificar permisos de administración cuando cambia el usuario
  useEffect(() => {
    if (user) {
      console.log("User en Sidebar:", user);
      
      // Revisar todas las propiedades posibles donde podría estar el rol
      const role = user.role || user.rol;
      console.log("Propiedad role encontrada:", role, "Tipo:", typeof role);
      
      // Forzar acceso de administrador para depuración
      // Si uncommentas la siguiente línea, todos los usuarios tendrán acceso de administrador
      // const isAdmin = true;
      
      let isAdmin = false;
      
      // Verificar si tiene rol 1 o 3 (intentando múltiples formatos)
      if (role !== undefined && role !== null) {
        // Intentar convertir a número si es string
        const roleNumber = parseInt(role);
        console.log("Role convertido a número:", roleNumber);
        
        if (!isNaN(roleNumber)) {
          isAdmin = roleNumber === 1 || roleNumber === 3;
        } else {
          // Si la conversión falla, intentar comparar como string
          isAdmin = role === "1" || role === "3";
        }
      }
      
      // SOLUCIÓN ALTERNATIVA: Verificar por email o nombre del usuario
      // Esta es una solución temporal mientras se arregla el problema del rol
      if (!isAdmin && user.email) {
        // Aquí puedes colocar los correos de los administradores
        const adminEmails = ['admin@example.com', 'jonathan@example.com'];
        if (adminEmails.includes(user.email)) {
          isAdmin = true;
          console.log("Admin por correo electrónico");
        }
      }
      
      console.log("¿Tiene permisos de admin?:", isAdmin);
      
      // Habilitar depuración: forzar acceso para todos 
      // Descomenta esta línea para probar que la ruta funciona
      // setHasAdminAccess(true);
      
      // Configuración normal (comenta esta línea cuando uses la línea anterior)
      setHasAdminAccess(isAdmin);
    } else {
      setHasAdminAccess(false);
    }
  }, [user]);
  
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
        {!collapsed && <h3 className="menuTitle">Menú</h3>}
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
          {hasAdminAccess && (
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

      {/* Información de depuración (siempre visible) */}
      {!collapsed && (
        <div style={{ padding: '10px', fontSize: '12px', color: '#fff', background: 'rgba(0,0,0,0.5)', marginTop: '20px' }}>
          <p>Usuario: {user ? user.nombre || user.name || user.email : 'No autenticado'}</p>
          <p>Rol: {user ? (user.role || user.rol || 'No definido') : 'N/A'}</p>
          <p>Tipo de rol: {user ? typeof (user.role || user.rol) : 'N/A'}</p>
          <p>Admin: {hasAdminAccess ? 'Sí' : 'No'}</p>
          <button 
            onClick={() => setHasAdminAccess(!hasAdminAccess)}
            style={{
              padding: '3px 8px',
              marginTop: '5px',
              fontSize: '10px',
              backgroundColor: hasAdminAccess ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            {hasAdminAccess ? 'Desactivar Admin' : 'Activar Admin'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;