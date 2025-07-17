import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from "./context/AuthContext";
import { ErrorProvider } from "./context/ErrorContext";
import { logEnvironmentInfo } from './utils/environment';
import './App.css';

// **Logs de desarrollo**
console.log("Modo de ejecución:", import.meta.env.MODE);
console.log("API URL:", import.meta.env.VITE_API_URL);
console.log("Usando ngrok:", import.meta.env.VITE_USE_NGROK);
console.log("URL de ngrok:", import.meta.env.VITE_NGROK_URL);

// **Función para test de API asíncrono**
const initializeApiConnection = async () => {
  try {
    // Test de conectividad dinámico
    const { testApiConnection } = await import('./utils/apiHelper');
    const success = await testApiConnection();

    if (success) {
      console.log('🟢 API HTTPS connection verified');
    } else {
      console.warn('🔴 API HTTPS connection failed - check certificate acceptance');
    }
  } catch (error) {
    console.error('🔴 Error al verificar conectividad API:', error);
  }
};


// **Inicialización de la aplicación**
const initializeApp = async () => {
  // Registrar información del entorno en desarrollo
  if (import.meta.env.DEV) {
    logEnvironmentInfo();

    // Ejecutar tests de API de forma asíncrona
    await Promise.all([
      initializeApiConnection(),
    ]);
  }

  // Renderizar la aplicación
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorProvider>
    </React.StrictMode>
  );
};

// **Inicializar aplicación**
initializeApp().catch(error => {
  console.error('Error al inicializar la aplicación:', error);

  // Fallback: renderizar la aplicación sin tests
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorProvider>
    </React.StrictMode>
  );
});