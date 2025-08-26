import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from "./context/AuthContext";
import { ErrorProvider } from "./context/ErrorContext";
import { logEnvironmentInfo } from './utils/environment';
import ErrorBoundary from './Components/ErrorBoundary.jsx';
import './App.css';

console.log("🚀 Iniciando aplicación...");
console.log("Modo de ejecución:", import.meta.env.MODE);
console.log("API URL:", import.meta.env.VITE_API_URL);

// ✅ VERSIÓN SIMPLE SIN ASYNC
const renderApp = () => {
  try {
    createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <ErrorBoundary>
          <ErrorProvider>
            <ErrorBoundary>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ErrorBoundary>
          </ErrorProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("✅ App renderizada exitosamente");
  } catch (error) {
    console.error("❌ Error al renderizar:", error);
  }
};

// ✅ EJECUTAR INMEDIATAMENTE
renderApp();