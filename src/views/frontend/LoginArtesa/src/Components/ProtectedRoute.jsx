import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';      // ← Import agregado
import { AUTH_TYPES } from '../constants/AuthTypes';

const ProtectedRoute = ({ children, allowTypes = [] }) => {
  const { isAuthenticated, authType, isLoading, error } = useAuth();  // ← Uso de useAuth

  const location = useLocation();
  if (isLoading) return <LoadingSpinner />;
  if (error)       return <Navigate to="/login" state={{ from: location, error }} replace />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowTypes.length > 0 && !allowTypes.includes(authType)) {
    const target = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
    return <Navigate to={target} replace />;
  }
  return children;
};

export default ProtectedRoute;