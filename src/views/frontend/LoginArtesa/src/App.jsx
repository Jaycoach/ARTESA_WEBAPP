import './App.css';
import Dashboard from './Components/Dashboard/Dashboard';
import Login from './Components/Login/Login';
import Register from './Components/Register/Register';
import NotFound from './Components/NotFound/NotFound';
import ResetPassword from './Components/resetPassword/ResetPassword';

// Import React Router
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

// Crear Router con estructura mejorada
const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/ResetPassword/:token',
    element: <ResetPassword />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/dashboard',
    element: <Dashboard />,
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