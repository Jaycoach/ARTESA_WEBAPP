// src/api/config.js
import axios from 'axios';

// Obtener la URL base de la API desde las variables de entorno
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Crear una instancia de Axios con la configuración base
const API = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Interceptor para incluir el token JWT en las solicitudes
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

// Interceptor para manejar errores de respuesta
API.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("Error en la respuesta:", error);
    
    // Si hay una respuesta del servidor, log para debugging
    if (error.response) {
      console.log("Respuesta del servidor:", error.response.data);
      console.log("Estado HTTP:", error.response.status);
      
      // Manejo de token expirado o inválido (401)
      if (error.response.status === 401) {
        // Opcional: redirigir al login o mostrar mensaje
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirigir a login (requiere acceso al router)
        // window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default API;