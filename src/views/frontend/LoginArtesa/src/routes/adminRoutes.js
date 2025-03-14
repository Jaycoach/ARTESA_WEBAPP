// src/routes/adminRoutes.js
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { adminService } from '../services/adminService';

// Cargar el componente de administración de manera diferida
const AdminPage = lazy(() => import('../Components/Dashboard/Pages/Admin/AdminPage'));

// HOC para proteger rutas administrativas
const AdminRoute = ({ children }) => {
  // Obtener usuario del localStorage (o mejor aún, del contexto de autenticación)
  const userStr = localStorage.getItem('user');
  let user = null;
  
  try {
    if (userStr) {
      user = JSON.parse(userStr);
    }
  } catch (e) {
    console.error('Error parsing user from localStorage:', e);
  }
  
  // Verificar si el usuario tiene permisos administrativos
  const hasPermission = adminService.hasAdminPermission(user);
  
  if (!hasPermission) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Definición de rutas administrativas
const adminRoutes = [
  {
    path: "admin",
    element: (
      <AdminRoute>
        <AdminPage />
      </AdminRoute>
    ),
  }
];

export default adminRoutes;