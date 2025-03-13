import axios from 'axios';

// Usar la variable de entorno si existe, o la URL de ngrok como fallback
const baseURL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL 
  : 'https://f3e6-105-74-67-156.ngrok-free.app';

const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar el token a las peticiones
API.interceptors.request.use(
  config => {
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

// Solo para depuración
console.log('API configurada con baseURL:', baseURL);

export default API;