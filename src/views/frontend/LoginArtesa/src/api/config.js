// src/api/config.js
import axios from 'axios';

const API = axios.create({
<<<<<<< HEAD
  baseURL: 'http://localhost:3000/api',
=======
  baseURL: 'https://f686-160-173-184-21.ngrok-free.app/api',
>>>>>>> feature/frontend
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