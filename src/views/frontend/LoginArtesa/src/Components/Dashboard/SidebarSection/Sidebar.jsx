import React, { useState, useEffect } from "react";
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import {
  FaHome, FaListAlt, FaFileInvoiceDollar, FaBoxes, FaCog,
  FaSignOutAlt, FaTools
} from "react-icons/fa";


const Sidebar = ({ collapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  // Verificar permisos de administración cuando cambia el usuario
  useEffect(() => {
    if (user) {
      console.log("User en Sidebar:", user);

      // Revisar todas las propiedades posibles donde podría estar el rol
      const role = user.role || user.rol;
      console.log("Propiedad role encontrada:", role, "Tipo:", typeof role);

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

      // Verificar por email o nombre del usuario como alternativa
      if (!isAdmin && user.email) {
        const adminEmails = ['admin@example.com', 'jonathan@example.com'];
        if (adminEmails.includes(user.email)) {
          isAdmin = true;
          console.log("Admin por correo electrónico");
        }
      }

      console.log("¿Tiene permisos de admin?:", isAdmin);
      setHasAdminAccess(isAdmin);
    } else {
      setHasAdminAccess(false);
    }
  }, [user]);

  // Función para determinar si una ruta está activa
  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="h-full flex flex-col text-white overflow-y-auto">
      <div className="flex-1 overflow-y-auto pt-8">
        {!collapsed && <h3 className="text-xs uppercase text-white/70 px-4 mb-2">Menú</h3>}

        <ul className="space-y-1 px-2">
          <li>
            <button
              onClick={() => navigate("/dashboard")}
              title={collapsed ? "Inicio" : undefined}
              className={`relative w-full flex items-center py-2 px-3 rounded-md transition-all duration-200 ease-in-out group
    ${isActive('/dashboard')
                  ? 'bg-accent text-white'
                  : 'hover:bg-orange-200/20 hover:text-orange-300 text-white'
                }
  `}
            >
              <FaHome className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && <span className="transition-opacity duration-200">Inicio</span>}
            </button>
          </li>

          <li>
            <button
              onClick={() => navigate("/dashboard/orders")}
              title={collapsed ? "Pedidos" : undefined}
              className={`relative w-full flex items-center py-2 px-3 rounded-md transition-all duration-200 ease-in-out group
        ${isActive('/dashboard/orders')
                  ? 'bg-accent text-white'
                  : 'hover:bg-orange-200/20 hover:text-orange-300 text-white'
                }`}
            >
              <FaListAlt className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && <span>Pedidos</span>}
            </button>
          </li>

          <li>
            <button
              onClick={() => navigate("/dashboard/invoices")}
              title={collapsed ? "Facturas" : undefined}
              className={`relative w-full flex items-center py-2 px-3 rounded-md transition-all duration-200 ease-in-out group
        ${isActive('/dashboard/invoices')
                  ? 'bg-accent text-white'
                  : 'hover:bg-orange-200/20 hover:text-orange-300 text-white'
                }`}
            >
              <FaFileInvoiceDollar className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && <span>Facturas</span>}
            </button>
          </li>

          <li>
            <button
              onClick={() => navigate("/dashboard/products")}
              title={collapsed ? "Productos" : undefined}
              className={`relative w-full flex items-center py-2 px-3 rounded-md transition-all duration-200 ease-in-out group
        ${isActive('/dashboard/products')
                  ? 'bg-accent text-white'
                  : 'hover:bg-orange-200/20 hover:text-orange-300 text-white'
                }`}
            >
              <FaBoxes className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && <span>Productos</span>}
            </button>
          </li>

          {!collapsed && <div className="border-t border-white/10 my-2 mx-4"></div>}

          <li>
            <button
              onClick={() => navigate("/dashboard/settings")}
              title={collapsed ? "Configuración" : undefined}
              className={`relative w-full flex items-center py-2 px-3 rounded-md transition-all duration-200 ease-in-out group
        ${isActive('/dashboard/settings')
                  ? 'bg-accent text-white'
                  : 'hover:bg-orange-200/20 hover:text-orange-300 text-white'
                }`}
            >
              <FaCog className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && <span>Configuración</span>}
            </button>
          </li>

          {hasAdminAccess && (
            <li>
              <button
                onClick={() => navigate("/dashboard/admin")}
                title={collapsed ? "Administración" : undefined}
                className={`relative w-full flex items-center py-2 px-3 rounded-md transition-all duration-200 ease-in-out group
          ${isActive('/dashboard/admin')
                    ? 'bg-accent text-white'
                    : 'hover:bg-orange-200/20 hover:text-orange-300 text-white'
                  }`}
              >
                <FaTools className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
                {!collapsed && <span>Administración</span>}
              </button>
            </li>
          )}
        </ul>
      </div>

      {/* Botón de cerrar sesión */}
      <div className="p-2 mt-auto">
        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar Sesión" : undefined}
          className="relative w-full flex items-center py-2 px-3 rounded-md hover:bg-orange-200/20 hover:text-orange-300 text-white transition-all duration-200 ease-in-out group"
        >
          <FaSignOutAlt className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;