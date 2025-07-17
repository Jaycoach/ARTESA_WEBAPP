import axios from 'axios';
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants/AuthTypes';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Crear instancia de axios para autenticación de sucursales
const branchAxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de sucursal a las peticiones
branchAxiosInstance.interceptors.request.use(
  (config) => {
    const branchToken = localStorage.getItem('branchAuthToken');
    if (branchToken) {
      config.headers.Authorization = `Bearer ${branchToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas y errores
branchAxiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('branchAuthToken');
      localStorage.removeItem('branchData');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const branchAuthService = {
  // Login de sucursal
  login: async (credentials) => {
    try {
      const response = await branchAxiosInstance.post(API_ENDPOINTS.BRANCH_LOGIN, {
        email: credentials.email,
        password: credentials.password
      });

      if (response.data.success) {
        const { token, branchData } = response.data;

        // Guardar token y datos de sucursal
        localStorage.setItem('branchAuthToken', token);
        localStorage.setItem('branchData', JSON.stringify(branchData));

        return {
          success: true,
          token,
          branchData
        };
      }

      return {
        success: false,
        error: ERROR_MESSAGES.INVALID_CREDENTIALS
      };
    } catch (error) {
      console.error('Error en login de sucursal:', error);

      if (error.response?.status === 404) {
        return {
          success: false,
          error: ERROR_MESSAGES.BRANCH_NOT_FOUND
        };
      }

      if (error.response?.status === 401) {
        return {
          success: false,
          error: ERROR_MESSAGES.INVALID_CREDENTIALS
        };
      }

      if (error.response?.status === 403) {
        return {
          success: false,
          error: ERROR_MESSAGES.UNAUTHORIZED
        };
      }

      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  // Logout de sucursal
  logout: async () => {
    try {
      await branchAxiosInstance.post(API_ENDPOINTS.BRANCH_LOGOUT);

      // Limpiar datos locales
      localStorage.removeItem('branchAuthToken');
      localStorage.removeItem('branchData');

      return { success: true };
    } catch (error) {
      console.error('Error en logout de sucursal:', error);

      // Limpiar datos locales aunque haya error
      localStorage.removeItem('branchAuthToken');
      localStorage.removeItem('branchData');

      return { success: false, error: ERROR_MESSAGES.UNKNOWN_ERROR };
    }
  },

  // Obtener perfil de sucursal
  getProfile: async () => {
    try {
      const response = await branchAxiosInstance.get(API_ENDPOINTS.BRANCH_PROFILE);

      if (response.data.success) {
        return {
          success: true,
          profile: response.data.profile
        };
      }

      return {
        success: false,
        error: ERROR_MESSAGES.UNAUTHORIZED
      };
    } catch (error) {
      console.error('Error obteniendo perfil de sucursal:', error);

      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  // Obtener sucursales por cliente
  getBranchesByClient: async (clientId) => {
    try {
      const response = await branchAxiosInstance.get(`${API_ENDPOINTS.CLIENT_BRANCHES}/${clientId}`);

      if (response.data.success) {
        return {
          success: true,
          branches: response.data.branches
        };
      }

      return {
        success: false,
        error: ERROR_MESSAGES.BRANCH_NOT_FOUND
      };
    } catch (error) {
      console.error('Error obteniendo sucursales:', error);

      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  // Obtener sucursales por usuario
  getBranchesByUser: async (userId) => {
    try {
      const response = await branchAxiosInstance.get(`${API_ENDPOINTS.USER_BRANCHES}/${userId}`);

      if (response.data.success) {
        return {
          success: true,
          branches: response.data.branches
        };
      }

      return {
        success: false,
        error: ERROR_MESSAGES.BRANCH_NOT_FOUND
      };
    } catch (error) {
      console.error('Error obteniendo sucursales por usuario:', error);

      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  // Verificar si el token es válido
  validateToken: async () => {
    try {
      const token = localStorage.getItem('branchAuthToken');
      if (!token) return false;

      const response = await branchAxiosInstance.get(API_ENDPOINTS.BRANCH_PROFILE);
      return response.data.success;
    } catch (error) {
      return false;
    }
  }
};

export default branchAuthService;
