import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from "./context/AuthContext"; // Importar AuthProvider

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider> {/* Ahora toda la app tendrá acceso a la autenticación */}
    <App />
    </AuthProvider>
  </StrictMode>,
)
