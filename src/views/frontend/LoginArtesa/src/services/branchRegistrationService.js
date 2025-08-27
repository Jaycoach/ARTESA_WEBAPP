// services/branchRegistrationService.js - VERSIÓN CORREGIDA
import API from '../api/config';

export const branchRegistrationService = {
    // ✅ CORREGIDO: checkRegistrationStatus usando POST como indica la API
    checkRegistrationStatus: async (email) => {
        try {
            console.log('🔄 Verificando estado de registro para:', email);
            // CAMBIO CRÍTICO: POST en lugar de GET
            const response = await API.post('/branch-auth/check-registration', { email });
            
            console.log('✅ Estado de registro obtenido:', response.data);
            return {
                success: true,
                data: response.data.data || response.data // Manejar ambos formatos
            };
        } catch (error) {
            console.error('❌ Error verificando estado de registro:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error verificando estado de registro'
            };
        }
    },

    // ✅ NUEVO: Iniciar verificación de email (envío automático)
    initiateEmailVerification: async (email, recaptchaToken = null) => {
        try {
            console.log('🔄 Iniciando verificación de email para sucursal:', email);
            
            const payload = { email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            
            const response = await API.post('/branch-auth/initiate-email-verification', payload);
            
            console.log('✅ Verificación de email iniciada exitosamente');
            return {
                success: true,
                data: response.data,
                message: response.data.message || 'Correo de verificación enviado'
            };
        } catch (error) {
            console.error('❌ Error iniciando verificación de email:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error enviando correo de verificación'
            };
        }
    },

    // ✅ CORREGIDO: Reenviar verificación con parámetro consistente
    resendEmailVerification: async (email, recaptchaToken = null) => {
        try {
            console.log('🔄 Reenviando verificación de email:', email);
            
            const payload = { email }; // CAMBIO: 'email' en lugar de 'mail'
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            
            const response = await API.post('/branch-auth/resend-verification', payload);
            
            return {
                success: true,
                data: response.data,
                message: response.data.message || 'Correo de verificación reenviado'
            };
        } catch (error) {
            console.error('❌ Error reenviando verificación:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error reenviando verificación'
            };
        }
    },

    // ✅ CORREGIDO: Verificar email con token (GET correcto)
    verifyEmailToken: async (token) => {
        try {
            console.log('🔄 Verificando token de email:', token);
            const response = await API.get(`/branch-auth/verify-email/${token}`);
            
            console.log('✅ Token verificado exitosamente:', response.data);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Error verificando token:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error verificando token de email'
            };
        }
    },

    // ✅ MEJORADO: Completar registro de sucursal
    registerBranch: async (registrationData, recaptchaToken = null) => {
        try {
            console.log('🔄 Completando registro de sucursal:', registrationData.email);
            
            const payload = {
                email: registrationData.email,
                password: registrationData.password,
                manager_name: registrationData.manager_name || registrationData.branchName
            };
            
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            
            const response = await API.post('/branch-registration/register', payload);
            
            console.log('✅ Registro de sucursal completado exitosamente');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Error completando registro:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error completando el registro'
            };
        }
    },

    // ✅ NUEVO: Validar email de sucursal (para verificación previa)
    validateBranchEmail: async (email) => {
        try {
            console.log('🔄 Validando email de sucursal:', email);
            const response = await API.post('/branch-registration/check-email', { email });

            const { success, data } = response.data;

            console.log('✅ Email validado exitosamente');
            return {
                success: true,
                isValid: success,
                branchInfo: data
            };
        } catch (error) {
            console.error('❌ Error validando email:', error);

            if (error.response?.status === 400) {
                const errorMessage = error.response.data?.message || '';

                if (errorMessage.includes('ya tiene credenciales configuradas')) {
                    return {
                        success: true,
                        isValid: true,
                        branchInfo: {
                            needsRegistration: false,
                            hasPassword: true,
                            branch_name: '',
                            is_login_enabled: true,
                            ...error.response.data
                        }
                    };
                }

                return {
                    success: false,
                    error: errorMessage
                };
            }

            return {
                success: false,
                error: error.response?.data?.message || 'Error validando email de sucursal'
            };
        }
    },
    // ✅ NUEVO: Reenviar verificación de email para sucursales
    resendBranchEmailVerification: async (email, recaptchaToken = null) => {
        try {
            console.log('🔄 Reenviando verificación de email para sucursal:', email);
            
            const payload = { email }; // Usar 'email' consistentemente
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            
            const response = await API.post('/branch-auth/resend-verification', payload);
            
            console.log('✅ Reenvío de verificación exitoso');
            return {
                success: true,
                data: response.data,
                message: response.data.message || 'Correo de verificación reenviado'
            };
        } catch (error) {
            console.error('❌ Error reenviando verificación:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error reenviando verificación'
            };
        }
    }
};