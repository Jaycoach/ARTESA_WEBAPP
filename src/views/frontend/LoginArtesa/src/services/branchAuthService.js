// services/branchAuthService.js - CORREGIDO CON SEGURIDAD
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

// *** INTERCEPTOR DE SOLICITUD SEGURO ***
branchAxiosInstance.interceptors.request.use(
  (config) => {
    const branchToken = localStorage.getItem('branchAuthToken');
    if (branchToken) {
      config.headers.Authorization = `Bearer ${branchToken}`;
    }

    // 🛡️ SEGURIDAD: Evitar loggear datos sensibles
    if (process.env.NODE_ENV !== 'production') {
      const logConfig = { ...config };
      if (logConfig.data && typeof logConfig.data === 'string') {
        try {
          const parsedData = JSON.parse(logConfig.data);
          if (parsedData.password) {
            parsedData.password = '***HIDDEN***';
          }
          logConfig.data = JSON.stringify(parsedData);
        } catch (e) {
          // Si no se puede parsear, ocultar todo el data
          logConfig.data = '***HIDDEN***';
        }
      }
      console.log('🔐 Request config (safe):', {
        method: config.method,
        url: config.url,
        headers: logConfig.headers,
        data: logConfig.data
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas y errores
branchAxiosInstance.interceptors.response.use(
  (response) => {
    // 🛡️ SEGURIDAD: No loggear respuesta completa que puede contener tokens
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Response received:', {
        status: response.status,
        url: response.config.url,
        success: response.data?.success,
        message: response.data?.message
      });
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('branchAuthToken');
      localStorage.removeItem('branchData');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const branchAuthService = {
  // Login de sucursal - VERSIÓN SEGURA Y OPTIMIZADA
  login: async (credentials) => {
    try {
      console.log('🔄 branchAuthService: Iniciando login para:', credentials.email);

      const response = await branchAxiosInstance.post(API_ENDPOINTS.BRANCH_LOGIN, {
        email: credentials.email,
        password: credentials.password
      });

      console.log('📡 branchAuthService: Login response:', {
        success: response.data?.success,
        message: response.data?.message,
        hasToken: !!response.data?.data?.token,
        hasBranchData: !!response.data?.data?.branch
      });

      if (response.data && response.data.success) {
        // Extraer datos de la respuesta
        const { token, branch } = response.data.data;

        // 🎯 MAPEO MEJORADO DE DATOS DE SUCURSAL
        const branchData = {
          // IDs principales
          branch_id: branch.branch_id,
          client_id: branch.client_id,

          // Información básica
          email: branch.email_branch,
          branchname: branch.branch_name,
          manager_name: branch.manager_name,
          company_name: branch.company_name,

          // Dirección completa
          address: branch.address,
          city: branch.city,
          state: branch.state,
          country: branch.country,
          zip_code: branch.zip_code,
          municipality_code: branch.municipality_code,

          // Información de contacto
          phone: branch.phone,
          contact_person: branch.contact_person,

          // Información fiscal
          nit_number: branch.nit_number,
          verification_digit: branch.verification_digit,

          // Configuración SAP
          ship_to_code: branch.ship_to_code,

          // Estados y configuración
          is_default: branch.is_default,
          is_login_enabled: branch.is_login_enabled,
          type: branch.type,

          // Fechas importantes
          last_login: branch.last_login,
          created_at: branch.created_at,
          updated_at: branch.updated_at,

          // Campos adicionales para compatibilidad
          name: branch.branch_name, // Alias
          branchName: branch.branch_name, // Alias
        };

        console.log('🔍 Datos mapeados de sucursal:', {
          branch_id: branchData.branch_id,
          email: branchData.email,
          branchname: branchData.branchname,
          company_name: branchData.company_name,
          is_login_enabled: branchData.is_login_enabled
        });

        if (token && branchData) {
          // Guardar datos en localStorage
          localStorage.setItem('branchAuthToken', token);
          localStorage.setItem('branchData', JSON.stringify(branchData));

          console.log('💾 Datos de sucursal guardados correctamente');

          return {
            success: true,
            token,
            branchData,
            data: branchData // Para compatibilidad
          };
        } else {
          console.error('❌ Token o branchData faltantes después de mapeo');
          return {
            success: false,
            error: 'Datos incompletos del servidor'
          };
        }
      }

      console.log('❌ Respuesta sin success o estructura incorrecta');
      return {
        success: false,
        error: ERROR_MESSAGES.INVALID_CREDENTIALS
      };
    } catch (error) {
      console.error('🚨 Error en login de sucursal:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        url: error.config?.url
      });

      if (error.response?.status === 404) {
        return { success: false, error: ERROR_MESSAGES.BRANCH_NOT_FOUND };
      }
      if (error.response?.status === 401) {
        return { success: false, error: ERROR_MESSAGES.INVALID_CREDENTIALS };
      }
      if (error.response?.status === 403) {
        return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
      }

      return {
        success: false,
        error: error.response?.data?.message || ERROR_MESSAGES.NETWORK_ERROR
      };
    }
  },

  // Resto de funciones sin cambios pero con logging seguro...
  logout: async () => {
    try {
      console.log('🔄 branchAuthService: Iniciando logout');
      await branchAxiosInstance.post(API_ENDPOINTS.BRANCH_LOGOUT);

      localStorage.removeItem('branchAuthToken');
      localStorage.removeItem('branchData');

      console.log('✅ Logout exitoso, datos limpiados');
      return { success: true };
    } catch (error) {
      console.error('❌ Error en logout:', error.message);

      // Limpiar datos locales aunque haya error
      localStorage.removeItem('branchAuthToken');
      localStorage.removeItem('branchData');

      return { success: false, error: ERROR_MESSAGES.UNKNOWN_ERROR };
    }
  },

  validateToken: async () => {
    try {
      const token = localStorage.getItem('branchAuthToken');
      if (!token) {
        console.log('🔍 validateToken: No hay token');
        return false;
      }

      console.log('🔍 validateToken: Verificando token con servidor');
      const response = await branchAxiosInstance.get(API_ENDPOINTS.BRANCH_PROFILE);

      const isValid = response.data && response.data.success;
      console.log('🔍 validateToken resultado:', isValid);

      return isValid;
    } catch (error) {
      console.log('❌ validateToken error:', error.message);
      return false;
    }
  }
};

export default branchAuthService;