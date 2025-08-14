import { getApiUrl } from '../utils/environment';
import { ERROR_MESSAGES } from '../constants/AuthTypes';

// Configuración de Axios para sucursales
const createBranchAxiosInstance = () => {
  const axios = require('axios');
  
  const instance = axios.create({
    baseURL: getApiUrl(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    }
  });

  // Interceptor para agregar el token de sucursal
  instance.interceptors.request.use(
    (config) => {
      const branchToken = localStorage.getItem('branchAuthToken');
      if (branchToken) {
        config.headers.Authorization = `Bearer ${branchToken}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Interceptor para manejar respuestas
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Token expirado o inválido
        localStorage.removeItem('branchAuthToken');
        localStorage.removeItem('branchData');
        window.location.href = '/branch-login';
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

const branchAxiosInstance = createBranchAxiosInstance();

/**
 * Servicio para funcionalidades específicas de sucursales
 */
const branchService = {
  
  // Dashboard endpoints
  getDashboardStats: async () => {
    try {
      const response = await branchAxiosInstance.get('/api/branch-dashboard/stats');
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas del dashboard:', error);
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  getOrderHistory: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });

      const url = `/api/branch-dashboard/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await branchAxiosInstance.get(url);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error obteniendo historial de órdenes:', error);
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  getTopSellingProducts: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });

      const url = `/api/branch-dashboard/top-products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await branchAxiosInstance.get(url);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error obteniendo productos más vendidos:', error);
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  getMonthlyStats: async (months = 6) => {
    try {
      const response = await branchAxiosInstance.get(`/api/branch-dashboard/monthly-stats?months=${months}`);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas mensuales:', error);
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  getInvoiceHistory: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });

      const url = `/api/branch-dashboard/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await branchAxiosInstance.get(url);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error obteniendo historial de facturas:', error);
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  // Order management endpoints
  createOrder: async (orderData) => {
    try {
      const response = await branchAxiosInstance.post('/api/branch-orders', orderData);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: response.data.message
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error creando orden:', error);
      
      if (error.response?.data?.message) {
        return {
          success: false,
          error: error.response.data.message
        };
      }
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  getOrderDetails: async (orderId) => {
    try {
      const response = await branchAxiosInstance.get(`/api/branch-orders/${orderId}`);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error obteniendo detalles de orden:', error);
      
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Orden no encontrada o no pertenece a esta sucursal'
        };
      }
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  updateOrderStatus: async (orderId, statusData) => {
    try {
      const response = await branchAxiosInstance.put(`/api/branch-orders/${orderId}/status`, statusData);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: response.data.message
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error actualizando estado de orden:', error);
      
      if (error.response?.data?.message) {
        return {
          success: false,
          error: error.response.data.message
        };
      }
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  getProductsForBranch: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      });

      const url = `/api/branch-orders/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await branchAxiosInstance.get(url);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }

      return {
        success: false,
        error: response.data.message || ERROR_MESSAGES.UNKNOWN_ERROR
      };
    } catch (error) {
      console.error('Error obteniendo productos para sucursal:', error);
      
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  // Utilities
  getBranchInfo: () => {
    const branchData = localStorage.getItem('branchData');
    
    if (branchData) {
      try {
        return JSON.parse(branchData);
      } catch (error) {
        console.error('Error parsing branch data:', error);
        return null;
      }
    }
    
    return null;
  },

  isBranchAuthenticated: () => {
    const token = localStorage.getItem('branchAuthToken');
    const branchData = localStorage.getItem('branchData');
    
    return !!(token && branchData);
  },

  clearBranchSession: () => {
    localStorage.removeItem('branchAuthToken');
    localStorage.removeItem('branchData');
  },

  // Formatters para usar en el frontend
  formatCurrency: (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  formatDate: (date) => {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  },

  formatDateTime: (date) => {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }
};

export default branchService;