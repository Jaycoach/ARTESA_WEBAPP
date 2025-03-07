import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const location = useLocation();

  useEffect(() => {
    // Verificar si hay un token válido en localStorage
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  // Mientras se verifica la autenticación, mostrar un loader
  if (isAuthenticated === null) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div>Verificando autenticación...</div>
      </div>
    );
  }
  
  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Si está autenticado, renderizar los hijos (componente protegido)
  return children;
};

export default ProtectedRoute;