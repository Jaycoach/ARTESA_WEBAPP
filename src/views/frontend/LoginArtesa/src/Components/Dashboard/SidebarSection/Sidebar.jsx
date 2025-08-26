// components/Dashboard/Sidebar.jsx - VERSIÓN FINAL RESTAURADA
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { AUTH_TYPES } from "../../../constants/AuthTypes";
import {
  FaHome, FaListAlt, FaFileInvoiceDollar, FaBoxes, FaCog,
  FaSignOutAlt, FaTools, FaUsers
} from "react-icons/fa";

const Sidebar = ({ collapsed, mobileMenuOpen, onCloseMobileMenu, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);

  // *** AMPLIADO: Obtener datos del contexto incluyendo branch ***
  const { user, branch, authType, logout } = useAuth();

  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  // *** MANTENIDO: Verificar permisos de administración (lógica original) ***
  useEffect(() => {
    // Solo verificar permisos para usuarios principales
    if (authType !== AUTH_TYPES.BRANCH && user) {
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
  }, [user, authType]);

  // *** MANTENIDO: Click fuera para cerrar menú móvil (lógica original) ***
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        if (mobileMenuOpen && onCloseMobileMenu) onCloseMobileMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen, onCloseMobileMenu]);

  // *** MANTENIDO: Función isActive original ***
  const isActive = (path) => {
    if (path === '/dashboard' || path === '/dashboard-branch') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // *** MANTENIDO: Función handleMenuClick original ***
  const handleMenuClick = (path) => {
    navigate(path);
    if (mobileMenuOpen && onCloseMobileMenu) onCloseMobileMenu();
  };

  // *** MANTENIDO: Función handleLogout original ***
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // *** MEJORADO: Definir ítems del menú según tipo de usuario ***
  const getMenuItems = () => {
    if (authType === AUTH_TYPES.BRANCH) {
      // Menú específico para usuarios branch
      return [
        { path: "/dashboard-branch", icon: FaHome, label: "Inicio" },
        { path: "/dashboard-branch/orders", icon: FaListAlt, label: "Pedidos" },
        { path: "/dashboard-branch/invoices", icon: FaFileInvoiceDollar, label: "Facturas" },
        { path: "/dashboard-branch/products", icon: FaBoxes, label: "Productos" },
        { path: "/dashboard-branch/settings", icon: FaCog, label: "Configuración" }
      ];
    } else {
      // Menú para usuarios principales (lógica original)
      return [
        { path: "/dashboard", icon: FaHome, label: "Inicio" },
        { path: "/dashboard/orders", icon: FaListAlt, label: "Pedidos" },
        { path: "/dashboard/invoices", icon: FaFileInvoiceDollar, label: "Facturas" },
        { path: "/dashboard/products", icon: FaBoxes, label: "Productos" },
        { path: "/dashboard/Users", icon: FaUsers, label: "Clientes", restricted: true },
        { path: "/dashboard/settings", icon: FaCog, label: "Configuración" },
        { path: "/dashboard/admin", icon: FaTools, label: "Administración", adminOnly: true }
      ];
    }
  };

  const menuItems = getMenuItems();

  // *** MEJORADO: Filtrar ítems según permisos (usuarios principales únicamente) ***
  const filteredItems = authType === AUTH_TYPES.BRANCH
    ? menuItems // Para branch, mostrar todos los elementos
    : menuItems.filter(item => !item.adminOnly || hasAdminAccess); // Para usuarios principales, filtrar por permisos

  return (
    // *** MANTENIDO: Estructura y clases originales exactas ***
    <div className="h-full flex flex-col text-white overflow-y-auto" ref={sidebarRef}>
      <div className="flex-1 overflow-y-auto pt-8">
        {/* *** MANTENIDO: Header del menú original *** */}
        {!collapsed && (
          <h3 className="text-xs uppercase text-white/70 px-4 mb-2">
            {authType === AUTH_TYPES.BRANCH ? 'Menú Sucursal' : 'Menú'}
          </h3>
        )}

        {/* *** MANTENIDO: Lista de menús con estilos originales *** */}
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
                <item.icon
                  className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'
                    }`}
                />
                {!collapsed && (
                  <span className="transition-opacity duration-200">{item.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* *** MANTENIDO: Botón de cerrar sesión original *** */}
      <div className="p-2 mt-auto">
        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar Sesión" : undefined}
          className="relative w-full flex items-center py-2 px-3 rounded-md hover:bg-secondary-200/20 hover:text-secondary-300 text-white transition-all duration-200 ease-in-out group"
        >
          <FaSignOutAlt
            className={`text-lg transform transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'
              }`}
          />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;