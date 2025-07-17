import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { AUTH_TYPES } from "../../../constants/AuthTypes";
import {
  FaHome, FaListAlt, FaFileInvoiceDollar, FaBoxes, FaCog,
  FaSignOutAlt, FaTools, FaUsers
} from "react-icons/fa";

const Sidebar = ({ collapsed, mobileMenuOpen, onCloseMobileMenu, onToggleCollapse, authType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);
  const { user, logout } = useAuth();
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  // Verificar permisos de administración
  useEffect(() => {
    if (user) {
      const role = user.role || user.rol;
      let isAdmin = false;

      if (role !== undefined && role !== null) {
        const roleNumber = parseInt(role);
        if (!isNaN(roleNumber)) {
          isAdmin = roleNumber === 1 || roleNumber === 3;
        } else {
          isAdmin = role === "1" || role === "3";
        }
      }

      if (!isAdmin && user.email) {
        const adminEmails = ['admin@example.com', 'jonathan@example.com'];
        if (adminEmails.includes(user.email)) {
          isAdmin = true;
        }
      }

      setHasAdminAccess(isAdmin);
    } else {
      setHasAdminAccess(false);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        if (mobileMenuOpen && onCloseMobileMenu) onCloseMobileMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen, onCloseMobileMenu]);

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleMenuClick = (path) => {
    navigate(path);
    if (mobileMenuOpen && onCloseMobileMenu) onCloseMobileMenu();
  };

  const handleLogout = async () => {
  await logout();                // espera limpieza
  navigate('/login', { replace:true });
};
  // Definir ítems del menú y filtrar según authType
  const menuItems = [
    { path: "/dashboard", icon: FaHome, label: "Inicio" },
    { path: "/dashboard/orders", icon: FaListAlt, label: "Pedidos" },
    { path: "/dashboard/invoices", icon: FaFileInvoiceDollar, label: "Facturas" },
    { path: "/dashboard/products", icon: FaBoxes, label: "Productos" },
    { path: "/dashboard/Users", icon: FaUsers, label: "Clientes", restricted: true }, // Ocultar para branches
    { path: "/dashboard/settings", icon: FaCog, label: "Configuración" },
    { path: "/dashboard/admin", icon: FaTools, label: "Administración", adminOnly: true } // Solo admins
  ];

  const filteredItems = menuItems.filter(item => {
    if (authType === AUTH_TYPES.BRANCH) {
      return !item.restricted && !item.adminOnly;
    }
    return !item.adminOnly || hasAdminAccess;
  });

  return (
    <div className="h-full flex flex-col text-white overflow-y-auto">
      <div className="flex-1 overflow-y-auto pt-8">
        {!collapsed && <h3 className="text-xs uppercase text-white/70 px-4 mb-2">Menú</h3>}

        <ul className="space-y-1 px-2">
          {filteredItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => handleMenuClick(item.path)}
                title={collapsed ? item.label : undefined}
                className={`relative w-full flex items-center py-2 px-3 rounded-md transition-all duration-200 ease-in-out group
                  ${isActive(item.path)
                    ? 'bg-secondary-600 text-white'
                    : 'hover:bg-secondary-200/20 hover:text-secondary-300 text-white'
                  }`}
              >
                <item.icon className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
                {!collapsed && <span className="transition-opacity duration-200">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Botón de cerrar sesión */}
      <div className="p-2 mt-auto">
        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar Sesión" : undefined}
          className="relative w-full flex items-center py-2 px-3 rounded-md hover:bg-secondary-200/20 hover:text-secondary-300 text-white transition-all duration-200 ease-in-out group"
        >
          <FaSignOutAlt className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;