// src/api/config.js
import axios from 'axios';

// Configura la URL base según el entorno
const baseURL = 'http://localhost:3000/api';
// Para usar con ngrok, comenta la línea anterior y descomenta la siguiente:
// const baseURL = 'https://tu-subdominio-ngrok.ngrok-free.app/api';

console.log("API conectada a:", baseURL);

const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
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