// services/branchRegistrationService.js
import API from '../api/config';

export const branchRegistrationService = {
    // Verificar el estado de registro de una sucursal
    checkRegistrationStatus: async (email) => {
        try {
            const response = await API.get('/api/branch-auth/check-registration', {
                params: { email }
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Error verificando estado de registro'
            };
        }
    },

    // Completar el registro de una sucursal
    registerBranch: async (registrationData) => {
        try {
            const response = await API.post('/api/branch-registration/register', registrationData);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Error completando el registro'
            };
        }
    },

    // Verificar si un email corresponde a una sucursal válida
    validateBranchEmail: async (email) => {
        try {
            const response = await API.get('/api/branch-auth/validate-email', {
                params: { email }
            });
            return {
                success: true,
                isValid: response.data.isValid,
                branchInfo: response.data.branchInfo
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Error validando email de sucursal'
            };
        }
    }
};