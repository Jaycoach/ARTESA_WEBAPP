import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from "./context/AuthContext";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { logEnvironmentInfo } from './utils/environment';
import './App.css'

// Asegurarnos de que la clave de reCAPTCHA siempre tenga un valor, incluso en desarrollo
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// Usar clave de prueba en desarrollo si no hay clave configurada
const finalRecaptchaKey = import.meta.env.DEV && !recaptchaKey 
  ? '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI' // Clave de prueba de Google
  : recaptchaKey;

// Informar que usamos clave de prueba
if (import.meta.env.DEV && finalRecaptchaKey === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI') {
  console.warn('ATENCIÓN: Usando clave de prueba de Google reCAPTCHA. Esta clave permite cualquier validación en desarrollo.');
}

// Depuración de variables de entorno
console.log("Variables de entorno cargadas:");
console.log("- VITE_API_URL:", import.meta.env.VITE_API_URL);
console.log("- VITE_USE_NGROK:", import.meta.env.VITE_USE_NGROK);
console.log("- VITE_NGROK_URL:", import.meta.env.VITE_NGROK_URL);
console.log("- VITE_RECAPTCHA_SITE_KEY:", recaptchaKey ? "Configurada correctamente" : "NO CONFIGURADA");

// Alertar si falta la clave (en cualquier entorno)
if (!recaptchaKey) {
  console.error('ERROR: La clave de reCAPTCHA no está definida en las variables de entorno. La validación de seguridad no funcionará correctamente.');
}

if (import.meta.env.DEV) {
  logEnvironmentInfo();
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleReCaptchaProvider
      reCaptchaKey={finalRecaptchaKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
        nonce: '',  // Para compatibilidad con CSP
      }}
      useRecaptchaNet={true}
      useEnterprise={false}
      language="es"
      container={{
        parameters: {
          badge: 'bottomright',
          theme: 'light',
        }
      }}
      onLoad={() => {
        console.log('reCAPTCHA cargado correctamente');
        // Puedes establecer una variable de estado aquí si necesitas
      }}
      onError={(error) => {
        console.error('Error al cargar reCAPTCHA:', error);
        // Manejar el error de carga
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleReCaptchaProvider>
  </React.StrictMode>,
)