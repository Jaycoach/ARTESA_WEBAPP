import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from "./context/AuthContext";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { logEnvironmentInfo } from './utils/environment';
import './App.css'

const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// Verificación opcional para entornos de desarrollo
if (!recaptchaKey) {
  console.warn('La clave de reCAPTCHA no está definida en las variables de entorno.');
}

if (import.meta.env.DEV) {
  logEnvironmentInfo();
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleReCaptchaProvider
      reCaptchaKey={recaptchaKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleReCaptchaProvider>
  </React.StrictMode>,
)