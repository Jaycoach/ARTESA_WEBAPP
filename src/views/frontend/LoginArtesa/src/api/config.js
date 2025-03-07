import axios from 'axios';

// Determinar la URL base según el entorno
const getBaseUrl = () => {
  // Para desarrollo local (si estás trabajando localmente, usa esta URL)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000/api'; // Ajusta al puerto correcto de tu servidor
  }
  
  // Para entorno ngrok o producción
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // URL de ngrok (si estás usando ngrok para el desarrollo)
  // Asegúrate de actualizar esto con tu URL específica de ngrok
  const ngrokUrl = 'https://3660-149-88-111-131.ngrok-free.app/api';
  
  return ngrokUrl;
};

const API = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor para agregar el token de autenticación
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log del error para depuración
    console.error('Error en la respuesta:', error);
    
    // Si el error tiene respuesta, mostrar detalles
    if (error.response) {
      console.log('Respuesta del servidor:', error.response.data);
      console.log('Estado HTTP:', error.response.status);
    } else if (error.request) {
      console.log('No se recibió respuesta del servidor');
    }
    
    return Promise.reject(error);
  }
);

export default API;