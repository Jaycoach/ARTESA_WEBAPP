import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from "./context/AuthContext"; // Importar AuthProvider
import './App.scss'
import './App.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider> {/* Ahora toda la app tendrá acceso a la autenticación */}
    <App />
    </AuthProvider>
    </React.StrictMode>,
)
