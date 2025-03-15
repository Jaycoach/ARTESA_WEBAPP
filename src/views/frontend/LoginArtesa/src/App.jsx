import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Importar componentes de manera normal para páginas principales
import Home from './Components/Home/home2';

const AdminPage = lazy(() => import('./Components/Dashboard/Pages/Admin/AdminPage'));

// Importar el contexto de autenticación
import { useAuth } from './hooks/useAuth';

// Componentes de Dashboard cargados de manera diferida
const Login = lazy(() => import('./Components/Login/Login'));
const Register = lazy(() => import('./Components/Register/Register'));
const ResetPassword = lazy(() => import('./Components/resetPassword/ResetPassword'));
const NotFound = lazy(() => import('./Components/NotFound/NotFound'));
const DashboardLayout = lazy(() => import('./Components/Dashboard/DashboardLayout'));
const Dashboard = lazy(() => import('./Components/Dashboard/Dashboard'));
const Products = lazy(() => import('./Components/Dashboard/Pages/Products/Products'));
const Orders = lazy(() => import('./Components/Dashboard/Pages/Orders/Orders'));
const OrderDetails = lazy(() => import('./Components/Dashboard/Pages/Orders/OrderDetails'));
const Invoices = lazy(() => import('./Components/Dashboard/Pages/Invoices/Invoices'));
const Settings = lazy(() => import('./Components/Dashboard/Pages/Settings/Settings'));

// Componente de carga para Suspense
const LoadingScreen = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    background: '#687e8d',
    color: 'white',
    flexDirection: 'column',
    gap: '10px'
  }}>
    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Cargando...</div>
    <div style={{ 
      width: '50px', 
      height: '50px', 
      border: '5px solid #f3f3f3',
      borderTop: '5px solid #f6754e',
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

// Componente para proteger rutas
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  if (!isAuthenticated) {
    console.log('Usuario no autenticado, redirigiendo a login');
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Configuración del router
const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <Login />
      </Suspense>
    ),
  },
  // Ruta corregida para recuperación de contraseña (kebab-case)
  {
    path: '/reset-password/:token',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ResetPassword />
      </Suspense>
    ),
  },
  // Mantener también la ruta anterior por compatibilidad temporal
  {
    path: '/ResetPassword/:token',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ResetPassword />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <Register />
      </Suspense>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: "products",
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <Products />
          </Suspense>
        ),
      },
      {
        path: "orders",
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <Orders />
          </Suspense>
        ),
      },
      {
        path: "orders/:orderId",
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <OrderDetails />
          </Suspense>
        ),
      },
      {
        path: "invoices",
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <Invoices />
          </Suspense>
        ),
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <Settings />
          </Suspense>
        ),
      },
      {
        path: "admin",
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <AdminPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <NotFound />
      </Suspense>
    ),
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