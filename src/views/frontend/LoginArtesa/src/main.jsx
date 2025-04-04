import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from "./context/AuthContext";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import './App.css'

const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

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