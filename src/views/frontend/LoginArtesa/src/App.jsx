/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense, useEffect } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './context/AuthContext';

// 2️⃣  Imports sincrónicos (landing)
import Home from './Components/Home/Home';
import OriginalHome from './Components/Home/home2';
import ErrorBoundary from './Components/ErrorBoundary.jsx';
import RecaptchaWrapper from './components/RecaptchaWrapper';

// 3️⃣  Imports diferidos
const Login               = lazy(() => import('./Components/Login/Login'));
const Register            = lazy(() => import('./Components/Register/Register'));
const ResetPassword       = lazy(() => import('./Components/resetPassword/ResetPassword'));
const NotFound            = lazy(() => import('./Components/NotFound/NotFound'));
const DashboardLayout     = lazy(() => import('./Components/Dashboard/DashboardLayout'));
const Dashboard           = lazy(() => import('./Components/Dashboard/Dashboard'));
const Products            = lazy(() => import('./Components/Dashboard/Pages/Products/Products'));
const Orders              = lazy(() => import('./Components/Dashboard/Pages/Orders/Orders.jsx'));
const OrderDetails        = lazy(() => import('./Components/Dashboard/Pages/Orders/OrderDetails'));
const CreateOrderForm     = lazy(() => import('./Components/Dashboard/Pages/Orders/CreateOrderForm'));
const EditOrderForm       = lazy(() => import('./Components/Dashboard/Pages/Orders/EditOrderForm'));
const Invoices            = lazy(() => import('./Components/Dashboard/Pages/Invoices/Invoices'));
const Settings            = lazy(() => import('./Components/Dashboard/Pages/Settings/Settings'));
const AdminPage           = lazy(() => import('./Components/Dashboard/Pages/Admin/AdminPage'));
const Users               = lazy(() => import('./Components/Dashboard/Pages/Users/ClientList'));
const EmailVerification   = lazy(() => import('./Components/Register/EmailVerification'));
const ResendVerification  = lazy(() => import('./Components/Register/ResendVerification'));
const EmailVerificationPending = lazy(() => import('./Components/Login/EmailVerificationPending.jsx'));
const RegistrationSuccess = lazy(() => import('./Components/Register/RegistrationSuccess'));
const DashboardBranchLayout = lazy(() => import('./Components/Dashboard/DashboardBranchLayout'));

// 4️⃣  Pantalla de carga
const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center h-screen gap-2 bg-slate-600 text-white">
    <p className="text-lg font-semibold">Cargando…</p>
    <div className="w-12 h-12 border-4 border-white border-t-orange-400 rounded-full animate-spin" />
  </div>
);

/* ----------- COMPONENTE PROTEGIDO UNIVERSAL ----------- */
const ProtectedRoute = ({ allowTypes = [], children }) => {
  const { isAuthenticated, authType, isLoading } = useAuth();  // ← Uso de useAuth

  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (allowTypes.length && !allowTypes.includes(authType)) {
    const fallback = authType === 'branch' ? '/dashboard-branch' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }
  return children || <Outlet />;
};

/* ----------- CONFIGURACIÓN DE RUTAS ----------- */
const router = createBrowserRouter([
  // 1️⃣ Páginas públicas
  { path: '/', element: <Home /> },
  {
    path: '/original-home',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <OriginalHome />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <Login />
        </ErrorBoundary>
      </Suspense>
    ),
  },
  // 2️⃣ Registro y recuperación
  {
    path: '/register',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <Register />
        </ErrorBoundary>
      </Suspense>
    ),
  },
  {
    path: '/verify-email/:token',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <EmailVerification />
        </ErrorBoundary>
      </Suspense>
    ),
  },
  {
    path: '/resend-verification',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <ResendVerification />
        </ErrorBoundary>
      </Suspense>
    ),
  },
  {
    path: '/email-verification-pending/:token',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <EmailVerificationPending />
        </ErrorBoundary>
      </Suspense>
    ),
  },
  {
    path: '/registration-success',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <RegistrationSuccess />
        </ErrorBoundary>
      </Suspense>
    ),
  },
  {
    path: '/reset-password/:token',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <ResetPassword />
        </ErrorBoundary>
      </Suspense>
    ),
  },
  {
    path: '/ResetPassword/:token',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <ResetPassword />
        </ErrorBoundary>
      </Suspense>
    ),
  },

  // 3️⃣ Dashboard USUARIO PRINCIPAL
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <ProtectedRoute allowTypes={['user']}>
            <DashboardLayout />
          </ProtectedRoute>
        </ErrorBoundary>
      </Suspense>
    ),
    children: [
      { index: true, element: <Suspense fallback={<LoadingScreen />}><Dashboard /></Suspense> },
      { path: 'products', element: <Suspense fallback={<LoadingScreen />}><Products /></Suspense> },
      { path: 'orders', element: <Suspense fallback={<LoadingScreen />}><Orders /></Suspense> },
      { path: 'orders/new', element: <Suspense fallback={<LoadingScreen />}><CreateOrderForm /></Suspense> },
      { path: 'orders/:orderId', element: <Suspense fallback={<LoadingScreen />}><OrderDetails /></Suspense> },
      { path: 'orders/:orderId/edit', element: <Suspense fallback={<LoadingScreen />}><EditOrderForm /></Suspense> },
      { path: 'invoices', element: <Suspense fallback={<LoadingScreen />}><Invoices /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<LoadingScreen />}><Settings /></Suspense> },
      { path: 'admin', element: <Suspense fallback={<LoadingScreen />}><AdminPage /></Suspense> },
      { path: 'users', element: <Suspense fallback={<LoadingScreen />}><Users /></Suspense> },
    ],
  },

  // 4️⃣ Dashboard SUCURSAL
  {
    path: '/dashboard-branch',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <ProtectedRoute allowTypes={['branch']}>
            <DashboardBranchLayout />
          </ProtectedRoute>
        </ErrorBoundary>
      </Suspense>
    ),
    children: [
      { index: true, element: <Suspense fallback={<LoadingScreen />}><Dashboard /></Suspense> },
      { path: 'products', element: <Suspense fallback={<LoadingScreen />}><Products /></Suspense> },
      { path: 'orders', element: <Suspense fallback={<LoadingScreen />}><Orders /></Suspense> },
      { path: 'orders/new', element: <Suspense fallback={<LoadingScreen />}><CreateOrderForm /></Suspense> },
      { path: 'orders/:orderId', element: <Suspense fallback={<LoadingScreen />}><OrderDetails /></Suspense> },
      { path: 'orders/:orderId/edit', element: <Suspense fallback={<LoadingScreen />}><EditOrderForm /></Suspense> },
      { path: 'invoices', element: <Suspense fallback={<LoadingScreen />}><Invoices /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<LoadingScreen />}><Settings /></Suspense> },
    ],
  },

  // 5️⃣ 404
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <NotFound />
        </ErrorBoundary>
      </Suspense>
    ),
  },
]);

function App() {
  useEffect(() => {
    const branchToken = localStorage.getItem('branchAuthToken');
    const userToken   = localStorage.getItem('token');
    console.info(branchToken || userToken ? '[ARTESA] sesión detectada' : '[ARTESA] sin sesión');
  }, []);

  return (
    <AuthProvider>
      <RecaptchaWrapper>
        <RouterProvider router={router} />
      </RecaptchaWrapper>
    </AuthProvider>
  );
}

export default App;