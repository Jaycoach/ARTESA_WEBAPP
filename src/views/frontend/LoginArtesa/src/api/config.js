// src/api/config.js
import axios from 'axios';

// Determinar la URL base según las variables de entorno o usar ngrok si está habilitado
let baseURL;

// Verificamos si estamos usando ngrok
if (import.meta.env.VITE_USE_NGROK === 'true' && import.meta.env.VITE_NGROK_URL) {
  // Si usamos ngrok, usamos esa URL
  baseURL = `${import.meta.env.VITE_NGROK_URL}/api`;
} else {
  // De lo contrario, usamos la URL de API configurada o localhost como fallback
  baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
}

console.log("API URL configurada:", baseURL);

const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    // Estos headers son necesarios para trabajar con ngrok
    'ngrok-skip-browser-warning': '69420',
    'Bypass-Tunnel-Reminder': 'true'
  },
  // No incluir credenciales para peticiones cross-origin
  withCredentials: false
});

// Log para depuración
console.log("Axios configurado con baseURL:", baseURL);

// Interceptor para agregar el token a las peticiones
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default API;