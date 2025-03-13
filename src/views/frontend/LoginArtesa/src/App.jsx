import Home from './Components/Home/Home';
import DashboardLayout from './Components/Dashboard/DashboardLayout';
import Dashboard from './Components/Dashboard/Dashboard';
import Login from './Components/Login/Login';
import Register from './Components/Register/Register';
import NotFound from './Components/NotFound/NotFound';
import ResetPassword from './Components/resetPassword/ResetPassword';

// Páginas dentro del Dashboard
import Products from "./Components/Dashboard/Pages/Products/Products";
import Orders from "./Components/Dashboard/Pages/Orders/Orders";
import Invoices from "./Components/Dashboard/Pages/Invoices/Invoices";
import Settings from "./Components/Dashboard/Pages/Settings/Settings";
import ClientProfile from './Components/Dashboard/Pages/ClientProfile/ClientProfile';

// Import React Router
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

// Crear Router con estructura mejorada
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
    path: '/reset-password/:token',
    element: <ResetPassword />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: "/dashboard/*",
    element: <DashboardLayout />, // 📌 Dashboard usa el layout general
    children: [
      { index: true, element: <Dashboard />},
      { path: "products", element: <Products /> },
      { path: "orders", element: <Orders /> },
      { path: "invoices", element: <Invoices /> },
      { path: "settings", element: <Settings /> },
      { path: "client-profile", element: <ClientProfile /> },
    ],
  },
  {
    path: '*', // Ruta 404 para páginas no encontradas
    element: <NotFound />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
  
}

export default App;