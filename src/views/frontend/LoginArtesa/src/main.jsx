import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from "./context/AuthContext";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { logEnvironmentInfo } from './utils/environment';
console.log("Modo de ejecución:", import.meta.env.MODE);
console.log("API URL:", import.meta.env.VITE_API_URL);
console.log("Usando ngrok:", import.meta.env.VITE_USE_NGROK);
console.log("URL de ngrok:", import.meta.env.VITE_NGROK_URL);
import { RECAPTCHA_SITE_KEY, RECAPTCHA_DEV_MODE } from './config/env';
import './App.css';

// Comprobar conectividad API
const apiTestURL = import.meta.env.VITE_USE_NGROK === 'true' 
  ? 'http://localhost:3000/api' 
  : '/api';

console.log(`Probando conectividad API en: ${apiTestURL}`);
fetch(apiTestURL)
  .then(response => {
    console.log('Estado de respuesta API principal:', response.status);
    return response.text();
  })
  .then(data => {
    console.log('Respuesta API:', data);
  })
  .catch(error => {
    console.error('Error al verificar API:', error);
  });

// Usar la configuración centralizada para reCAPTCHA
const finalRecaptchaKey = import.meta.env.DEV && !RECAPTCHA_SITE_KEY
  ? '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI' // Clave de prueba de Google
  : RECAPTCHA_SITE_KEY;

// Informar que usamos clave de prueba
if (import.meta.env.DEV && finalRecaptchaKey === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI') {
  console.warn('ATENCIÓN: Usando clave de prueba de Google reCAPTCHA. Esta clave permite cualquier validación en desarrollo.');
}

// Registrar información en desarrollo
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
      }}
      onError={(error) => {
        console.error('Error al cargar reCAPTCHA:', error);
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleReCaptchaProvider>
  </React.StrictMode>,
);