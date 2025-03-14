// src/api/config.js
import axios from 'axios';

// Configura la URL base según el entorno 
const baseURL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:3000/api';
// Para usar con ngrok, comenta la línea anterior y descomenta la siguiente:
//const baseURL = 'https://7878-105-74-0-29.ngrok-free.app/api';

console.log("API conectada a:", baseURL);

const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420',
    'Bypass-Tunnel-Reminder': 'true'
    // Removed the problematic headers
  }
});

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