import React, { Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Importar componentes de manera normal para páginas principales
import Home from './Components/Home/Home';
import Login from './Components/Login/Login';
import Register from './Components/Register/Register';
import NotFound from './Components/NotFound/NotFound';
import ResetPassword from './Components/resetPassword/ResetPassword';
import DashboardLayout from './Components/Dashboard/DashboardLayout';

// Importar el contexto de autenticación
import { useAuth } from './hooks/useAuth';

// Componentes de Dashboard cargados de manera diferida
const Dashboard = React.lazy(() => import('./Components/Dashboard/Dashboard'));
const Products = React.lazy(() => import('./Components/Dashboard/Pages/Products/Products'));
const Orders = React.lazy(() => import('./Components/Dashboard/Pages/Orders/Orders'));
const Invoices = React.lazy(() => import('./Components/Dashboard/Pages/Invoices/Invoices'));
const Settings = React.lazy(() => import('./Components/Dashboard/Pages/Settings/Settings'));

// Componente para proteger rutas
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  if (!isAuthenticated) {
    console.log('Usuario no autenticado, redirigiendo a login');
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Componente de carga para Suspense
const Loading = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column',
    gap: '10px'
  }}>
    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Cargando...</div>
    <div style={{ 
      width: '50px', 
      height: '50px', 
      border: '5px solid #f3f3f3',
      borderTop: '5px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Configuración del router
const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/reset-password/:token',
    element: <ResetPassword />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Loading />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'products',
        element: (
          <Suspense fallback={<Loading />}>
            <Products />
          </Suspense>
        ),
      },
      {
        path: 'orders',
        element: (
          <Suspense fallback={<Loading />}>
            <Orders />
          </Suspense>
        ),
      },
      {
        path: 'invoices',
        element: (
          <Suspense fallback={<Loading />}>
            <Invoices />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<Loading />}>
            <Settings />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);

function App() {
  // Efecto para verificar la sesión al iniciar
  useEffect(() => {
    const checkSession = () => {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('Sesión activa');
      } else {
        console.log('No hay sesión activa');
      }
    };
    
    checkSession();
  }, []);

  return <RouterProvider router={router} />;
}

export default App;

  // CHAN LE CAMBIE HASTA LA MADRE!! 