// context/AuthContext.jsx - VERSIÓN DEFINITIVA SIN ERRORES
import React, {
    createContext,
    useReducer,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from 'react';
import API from '../api/config';
import { branchAuthService } from '../services/branchAuthService';
import { AUTH_TYPES, ERROR_MESSAGES } from '../constants/AuthTypes';
import { isDevelopment } from '../utils/environment';

// ============================================================================
// UTILIDADES DE EMAIL
// ============================================================================

const emailUtils = {
    // ✅ NUEVA: Función para preservar formato correcto del email
    sanitizeEmail: (email) => {
        if (!email || typeof email !== 'string') return email;

        // Preservar caracteres válidos del email: letras, números, puntos, guiones, arroba
        const sanitized = email.toLowerCase().trim();

        // Validar formato básico sin alterar el contenido
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        if (!emailRegex.test(sanitized)) {
            console.warn('⚠️ [EmailUtils] Email con formato inválido:', email);
        }

        console.log('✅ [EmailUtils] Email sanitizado:', {
            original: email,
            sanitized: sanitized,
            length: sanitized.length
        });

        return sanitized;
    },

    // ✅ NUEVA: Validar que el email mantenga su formato original
    validateEmailIntegrity: (originalEmail, processedEmail) => {
        const original = originalEmail?.toLowerCase().trim();
        const processed = processedEmail?.toLowerCase().trim();

        if (original !== processed) {
            console.error('🚨 [EmailUtils] EMAIL CORRUPTION DETECTED:', {
                original: original,
                processed: processed,
                originalLength: original?.length,
                processedLength: processed?.length
            });
            return false;
        }

        return true;
    }
};

// ============================================================================
// SERVICIOS Y CONFIGURACIÓN
// ============================================================================

const branchRegistrationService = {
    checkRegistrationStatus: async (email) => {
        try {
            console.log('🔄 Verificando estado de registro para:', email);
            const response = await API.post('/branch-auth/check-registration', { email });

            console.log('✅ Estado de registro obtenido:', response.data);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Error verificando estado de registro:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error verificando estado de registro'
            };
        }
    },

    registerBranch: async (registrationData) => {
        try {
            console.log('🔄 Registrando sucursal:', registrationData.email);

            const payload = {
                email: registrationData.email,
                password: registrationData.password,
                manager_name: registrationData.branchName || registrationData.manager_name
            };

            const response = await API.post('/branch-registration/register', payload);

            console.log('✅ Sucursal registrada exitosamente');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Error registrando sucursal:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error completando el registro'
            };
        }
    },

    verifyBranchEmail: async (token) => {
        try {
            console.log('🔄 Verificando email de sucursal con token:', token);
            // ✅ AJUSTE: Remover /api/ ya que API.defaults.baseURL lo incluye
            const response = await API.get(`/branch-auth/verify-email/${token}`);
            console.log('✅ Email de sucursal verificado exitosamente');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Error verificando email de sucursal:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error verificando email de sucursal'
            };
        }
    },

    resendBranchVerification: async (email, recaptchaToken = null) => {
        try {
            console.log('🔄 Reenviando verificación de sucursal para:', email);
            // ✅ AJUSTE: Usar 'email' consistentemente (no 'mail')
            const payload = { email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;

            const response = await API.post('/branch-auth/resend-verification', payload);
            console.log('✅ Verificación de sucursal reenviada exitosamente');
            return {
                success: true,
                message: response.data.message || 'Correo de verificación enviado'
            };
        } catch (error) {
            console.error('❌ Error reenviando verificación de sucursal:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error reenviando verificación'
            };
        }
    },

    requestBranchPasswordReset: async (email, recaptchaToken = null) => {
        try {
            console.log('🔄 Solicitando reset de contraseña para sucursal:', email);
            // ✅ AJUSTE: Usar 'email' consistentemente
            const payload = { email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;

            const response = await API.post('/branch-password/request-reset', payload);
            console.log('✅ Reset de contraseña de sucursal solicitado exitosamente');
            return {
                success: true,
                message: response.data.message || 'Correo de recuperación enviado'
            };
        } catch (error) {
            console.error('❌ Error solicitando reset de sucursal:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error solicitando reset de contraseña'
            };
        }
    },

    resetBranchPassword: async (token, newPassword) => {
        try {
            console.log('🔄 Reseteando contraseña de sucursal');
            const response = await API.post('/branch-password/reset', {
                token,
                newPassword
            });
            console.log('✅ Contraseña de sucursal actualizada exitosamente');
            return {
                success: true,
                message: response.data.message || 'Contraseña actualizada correctamente'
            };
        } catch (error) {
            console.error('❌ Error reseteando contraseña de sucursal:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Error actualizando contraseña'
            };
        }
    },

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
};

// ============================================================================
// ESTADOS Y REDUCER
// ============================================================================

const initialState = {
    authType: null,
    user: null,
    branch: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    branchVerificationStatus: null,
    isBranchVerifying: false,
};

const TYPES = {
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
    CLEAR_ERROR: 'CLEAR_ERROR',
    UPDATE_USER: 'UPDATE_USER',
    SET_BRANCH_VERIFYING: 'SET_BRANCH_VERIFYING',
    SET_BRANCH_VERIFICATION_STATUS: 'SET_BRANCH_VERIFICATION_STATUS',
    UPDATE_BRANCH: 'UPDATE_BRANCH',
};

function reducer(state, { type, payload }) {
    switch (type) {
        case TYPES.SET_LOADING:
            return { ...state, isLoading: payload };
        case TYPES.SET_ERROR:
            return { ...state, error: payload, isLoading: false };
        case TYPES.LOGIN_SUCCESS:
            return {
                ...state,
                ...payload,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                branchVerificationStatus: null,
                isBranchVerifying: false,
            };
        case TYPES.LOGOUT_SUCCESS:
            return { ...initialState, isLoading: false };
        case TYPES.CLEAR_ERROR:
            return { ...state, error: null };
        case TYPES.UPDATE_USER:
            return { ...state, user: payload };
        case TYPES.SET_BRANCH_VERIFYING:
            return { ...state, isBranchVerifying: payload };
        case TYPES.SET_BRANCH_VERIFICATION_STATUS:
            return { ...state, branchVerificationStatus: payload };
        case TYPES.UPDATE_BRANCH:
            return { ...state, branch: payload };
        default:
            return state;
    }
}

const AuthContext = createContext(null);

// ============================================================================
// PROVIDER PRINCIPAL
// ============================================================================
function AuthProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    const useAuthOptimizer = () => {
        const authCheckRef = useRef({
            isChecking: false,
            lastCheck: 0,
            hasInitialCheck: false,
            minInterval: 30000, // 30 segundos
        });

        const shouldAllowAuthCheck = useCallback(() => {
            const now = Date.now();
            const { isChecking, lastCheck, hasInitialCheck, minInterval } = authCheckRef.current;

            // Primera vez siempre permitida
            if (!hasInitialCheck) {
                authCheckRef.current.hasInitialCheck = true;
                return true;
            }

            // Evitar checks simultáneos
            if (isChecking) {
                console.log('🚫 [AuthOptimizer] Verificación ya en progreso, omitiendo...');
                return false;
            }

            // Limitar frecuencia
            if ((now - lastCheck) < minInterval) {
                const remaining = Math.ceil((minInterval - (now - lastCheck)) / 1000);
                console.log(`⏳ [AuthOptimizer] Verificación muy frecuente. Esperar ${remaining}s`);
                return false;
            }

            return true;
        }, []);

        const markAuthCheckStart = useCallback(() => {
            authCheckRef.current.isChecking = true;
            authCheckRef.current.lastCheck = Date.now();
        }, []);

        const markAuthCheckEnd = useCallback(() => {
            authCheckRef.current.isChecking = false;
        }, []);

        return { shouldAllowAuthCheck, markAuthCheckStart, markAuthCheckEnd };
    };

    const { shouldAllowAuthCheck, markAuthCheckStart, markAuthCheckEnd } = useAuthOptimizer();
    // ========================================================================
    // FUNCIONES UTILITARIAS
    // ========================================================================

    const clearStorage = useCallback(() => {
        console.log('🧹 Limpiando localStorage y headers');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('branchAuthToken');
        localStorage.removeItem('branchData');
        localStorage.removeItem('clientProfile');
        if (API.defaults.headers.common.Authorization) {
            delete API.defaults.headers.common.Authorization;
        }
    }, []);

    const normalizeUserData = useCallback((userData) => {
        if (!userData) return userData;

        // Preservar email original ANTES de cualquier procesamiento
        const originalEmail = userData.email || userData.mail;

        console.log('🔄 [NormalizeUser] Procesando usuario:', {
            originalEmail: originalEmail,
            hasEmail: !!userData.email,
            hasMail: !!userData.mail,
            userDataKeys: Object.keys(userData)
        });

        // Sanitizar email sin alterar su estructura
        if (originalEmail) {
            const sanitizedEmail = emailUtils.sanitizeEmail(originalEmail);

            // Asegurar que ambos campos tengan el mismo valor correcto
            userData.email = sanitizedEmail;
            userData.mail = sanitizedEmail;

            // VERIFICACIÓN: Confirmar integridad
            emailUtils.validateEmailIntegrity(originalEmail, sanitizedEmail);
        }

        // Normalizar is_active
        userData.is_active = userData.is_active !== undefined
            ? (typeof userData.is_active === 'string'
                ? userData.is_active.toLowerCase() === 'true'
                : Boolean(userData.is_active))
            : true;

        // Normalizar role
        if (userData.role) {
            if (typeof userData.role === 'object' && userData.role?.id) {
                userData.role = parseInt(userData.role.id);
            } else if (typeof userData.role === 'string' || typeof userData.role === 'number') {
                userData.role = parseInt(userData.role);
            }
        }

        console.log('✅ [NormalizeUser] Usuario normalizado:', {
            finalEmail: userData.email,
            finalMail: userData.mail,
            role: userData.role,
            is_active: userData.is_active
        });

        return userData;
    }, []);

    const loadClientProfile = useCallback(async (userId) => {
        // Cache simple para evitar llamadas repetidas en la misma sesión
        const cacheKey = `profile_${userId}`;
        if (window.clientProfileCache && window.clientProfileCache[cacheKey]) {
            console.log('✅ [AuthContext] Perfil obtenido desde cache de sesión');
            return window.clientProfileCache[cacheKey];
        }

        try {
            console.log('🔄 [AuthContext] Cargando perfil de cliente para usuario:', userId);

            // ✅ CRÍTICO: Verificar que tenemos token antes de hacer la llamada
            const currentToken = localStorage.getItem('token') || API.defaults.headers.common.Authorization;

            if (!currentToken) {
                console.warn('⚠️ [AuthContext] No hay token disponible para cargar perfil');
                return null;
            }

            const response = await API.get(`/client-profiles/user/${userId}`);

            if (response.data.success) {
                const clientProfile = response.data.data;
                console.log('✅ [AuthContext] ClientProfile obtenido:', clientProfile);

                const priceListData = {
                    price_list: clientProfile.price_list || null,
                    price_list_code: clientProfile.price_list_code || 'GENERAL',
                    effective_price_list_code: clientProfile.effective_price_list_code || 'GENERAL',
                    client_id: clientProfile.client_id,
                    cardcode_sap: clientProfile.cardcode_sap,
                    razonSocial: clientProfile.razonSocial,
                    nit: clientProfile.nit
                };

                // Guardar en cache de sesión
                window.clientProfileCache = window.clientProfileCache || {};
                window.clientProfileCache[cacheKey] = priceListData;

                console.log('📋 [AuthContext] Datos de lista de precios extraídos:', priceListData);
                return priceListData;
            }

            return null;
        } catch (error) {
            console.log('⚠️ [AuthContext] Usuario sin perfil de cliente registrado o sin autorización:', error.message);
            return null;
        }
    }, []);

    const enrichUserWithProfile = useCallback(async (userData) => {
        if (!userData.id) return userData;

        const priceListProfile = await loadClientProfile(userData.id);

        if (priceListProfile) {
            const enrichedUser = {
                ...userData,
                priceListProfile
            };

            localStorage.setItem('user', JSON.stringify(enrichedUser));
            localStorage.setItem('priceListProfile', JSON.stringify(priceListProfile));

            console.log('✅ [AuthContext] Usuario enriquecido con priceListProfile');
            return enrichedUser;
        }

        return userData;
    }, [loadClientProfile]);

    // ========================================================================
    // INICIALIZACIÓN
    // ========================================================================
    useEffect(() => {
        const checkAuthState = async () => {
            if (!shouldAllowAuthCheck()) {
                return;
            }

            console.log('🔄 Verificando estado de autenticación...');
            markAuthCheckStart();

            try {
                const token = localStorage.getItem("token");
                const storedUser = localStorage.getItem("user");
                const storedProfile = localStorage.getItem("clientProfile");
                const branchToken = localStorage.getItem('branchAuthToken');
                const branchData = localStorage.getItem('branchData');

                // Verificar sesión de usuario principal
                if (token && storedUser) {
                    try {
                        let userData = JSON.parse(storedUser);
                        userData = normalizeUserData(userData);

                        // Solo cargar perfil si realmente no existe
                        if (!userData.priceListProfile && !storedProfile) {
                            console.log('🔄 [AuthContext] Usuario sin priceListProfile, intentando cargar...');
                            try {
                                userData = await enrichUserWithProfile(userData);
                            } catch (error) {
                                console.warn('⚠️ Error cargando perfil, continuando sin él:', error.message);
                            }
                        } else if (storedProfile && !userData.priceListProfile) {
                            // Si hay perfil en localStorage pero no en el objeto usuario, combinarlo
                            try {
                                const profileData = JSON.parse(storedProfile);
                                userData.priceListProfile = profileData;
                                console.log('✅ [AuthContext] PriceListProfile restaurado desde localStorage');
                            } catch (error) {
                                console.warn('⚠️ Error parseando perfil guardado:', error.message);
                            }
                        }

                        console.log('✅ Sesión de usuario principal restaurada:', userData.email || userData.mail);

                        dispatch({
                            type: TYPES.LOGIN_SUCCESS,
                            payload: {
                                authType: AUTH_TYPES.USER,
                                user: userData,
                                token,
                            },
                        });
                        API.defaults.headers.common.Authorization = `Bearer ${token}`;
                        return;
                    } catch (err) {
                        console.error("❌ Error verificando sesión user:", err);
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        localStorage.removeItem('clientProfile');
                    }
                }

                if (branchToken && branchData) {
                    try {
                        // Validación básica del token
                        const tokenParts = branchToken.split('.');
                        if (tokenParts.length === 3) { // JWT básicamente válido
                            const parsedBranchData = JSON.parse(branchData);

                            console.log('🔄 Sesión de sucursal encontrada, enriqueciendo datos...');

                            // ✅ VALIDACIÓN MEJORADA: Verificar datos críticos de la sucursal
                            if (!parsedBranchData.branch_id || !parsedBranchData.user_id || !parsedBranchData.client_id) {
                                console.warn('⚠️ Datos de sucursal incompletos, recargando desde servidor...', {
                                    hasBranchId: !!parsedBranchData.branch_id,
                                    hasUserId: !!parsedBranchData.user_id,
                                    hasClientId: !!parsedBranchData.client_id
                                });
                                
                                // Configurar token temporalmente para la llamada
                                API.defaults.headers.common.Authorization = `Bearer ${branchToken}`;
                                
                                // Recargar datos completos desde el servidor
                                const freshProfileResponse = await API.get('/branch-auth/profile');
                                if (freshProfileResponse.data.success && freshProfileResponse.data.data) {
                                    const enrichedData = {
                                        ...freshProfileResponse.data.data,
                                        type: 'branch'
                                    };
                                    
                                    // Actualizar localStorage con datos completos
                                    localStorage.setItem('branchData', JSON.stringify(enrichedData));
                                    
                                    console.log('✅ Datos de sucursal recargados exitosamente:', {
                                        branch_id: enrichedData.branch_id,
                                        user_id: enrichedData.user_id,
                                        client_id: enrichedData.client_id
                                    });
                                    
                                    dispatch({
                                        type: TYPES.LOGIN_SUCCESS,
                                        payload: {
                                            authType: 'branch',
                                            branch: enrichedData,
                                            token: branchToken,
                                        },
                                    });
                                    API.defaults.headers.common.Authorization = `Bearer ${branchToken}`;
                                    return;
                                } else {
                                    console.error('❌ No se pudieron recargar los datos de sucursal');
                                    localStorage.removeItem('branchAuthToken');
                                    localStorage.removeItem('branchData');
                                }
                            } else {
                                // Los datos están completos, continuar con el flujo normal
                                console.log('✅ Datos de sucursal completos encontrados');
                                
                                // ✅ NUEVO: Enriquecer con datos completos del perfil
                                try {
                                    // Configurar temporalmente el header para la llamada
                                    API.defaults.headers.common.Authorization = `Bearer ${branchToken}`;

                                    const profileResponse = await API.get('/branch-auth/profile');

                                    if (profileResponse.data.success) {
                                        const completeProfileData = profileResponse.data.data;

                                        // Combinar datos guardados con datos completos del perfil
                                        const enrichedBranchData = {
                                            ...parsedBranchData,
                                            ...completeProfileData,
                                            type: 'branch'
                                        };

                                        // Actualizar localStorage con datos COMPLETOS enriquecidos
                                        localStorage.setItem('branchData', JSON.stringify(enrichedBranchData));

                                        console.log('✅ Sesión de sucursal enriquecida con TODOS los campos:', {
                                            branch_id: enrichedBranchData.branch_id,
                                            user_id: enrichedBranchData.user_id,
                                            email: enrichedBranchData.email,
                                            branch_name: enrichedBranchData.branch_name,
                                            company_name: enrichedBranchData.company_name,
                                            client_id: enrichedBranchData.client_id
                                        });
                                        dispatch({
                                            type: TYPES.LOGIN_SUCCESS,
                                            payload: {
                                                authType: 'branch',
                                                branch: enrichedBranchData,
                                                token: branchToken,
                                            },
                                        });
                                        API.defaults.headers.common.Authorization = `Bearer ${branchToken}`;
                                        return;
                                    } else {
                                        console.warn('⚠️ No se pudo obtener perfil completo, usando datos básicos');
                                        // Fallback a datos básicos
                                        dispatch({
                                            type: TYPES.LOGIN_SUCCESS,
                                            payload: {
                                                authType: 'branch',
                                                branch: parsedBranchData,
                                                token: branchToken,
                                            },
                                        });
                                        API.defaults.headers.common.Authorization = `Bearer ${branchToken}`;
                                        return;
                                    }
                                } catch (profileError) {
                                    console.warn('⚠️ Error obteniendo perfil completo, usando datos básicos:', profileError.message);

                                    // Fallback a datos básicos si falla la carga del perfil
                                    dispatch({
                                        type: TYPES.LOGIN_SUCCESS,
                                        payload: {
                                            authType: 'branch',
                                            branch: parsedBranchData,
                                            token: branchToken,
                                        },
                                    });
                                    API.defaults.headers.common.Authorization = `Bearer ${branchToken}`;
                                    return;
                                }
                            }
                        } else {
                            console.log('❌ Token de sucursal con formato inválido, limpiando datos');
                            localStorage.removeItem('branchAuthToken');
                            localStorage.removeItem('branchData');
                        }
                    } catch (err) {
                        console.error("❌ Error verificando sesión branch:", err);
                        localStorage.removeItem('branchAuthToken');
                        localStorage.removeItem('branchData');
                    }
                }

                console.log('ℹ️ No se encontró sesión válida');
                dispatch({ type: TYPES.SET_LOADING, payload: false });
            } finally {
                markAuthCheckEnd();
            }
        };

        checkAuthState();
    }, [shouldAllowAuthCheck,
        markAuthCheckStart,
        markAuthCheckEnd,
        normalizeUserData,
        enrichUserWithProfile]);

    

    // ========================================================================
    // LOGIN
    // ========================================================================

    const login = useCallback(async (credentials, authType = AUTH_TYPES.USER) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        dispatch({ type: TYPES.CLEAR_ERROR });
        let sanitizedInputEmail = '';

        try {
            const inputEmail = credentials.email || credentials.mail;
            sanitizedInputEmail = emailUtils.sanitizeEmail(inputEmail);

            console.log('🔄 Iniciando login:', {
                authType,
                originalEmail: inputEmail,
                sanitizedEmail: sanitizedInputEmail,
                hasPassword: !!credentials.password
            });

            if (authType === AUTH_TYPES.BRANCH) {
                const normalizedCredentials = {
                    email: sanitizedInputEmail,
                    password: credentials.password
                };

                console.log('🔄 Branch login - Email enviado:', normalizedCredentials.email);
                const branchResult = await branchAuthService.login(normalizedCredentials);

                console.log('📡 Resultado de branchAuthService:', {
                    success: branchResult?.success,
                    hasToken: !!branchResult?.token,
                    hasBranchData: !!branchResult?.branchData,
                    branchName: branchResult?.branchData?.branchname,
                    emailReceived: branchResult?.branchData?.email
                });

                if (!branchResult || !branchResult.success) {
                    throw new Error(branchResult?.error || 'Error desconocido en login de sucursal');
                }

                const { token, branchData } = branchResult;

                if (!token || !branchData) {
                    throw new Error('Datos incompletos recibidos del servicio de autenticación');
                }

                // ✅ VALIDACIÓN INMEDIATA: Verificar que todos los datos críticos estén presentes
                if (!branchData.user_id || !branchData.client_id || !branchData.branch_id) {
                    console.warn('⚠️ Respuesta de login incompleta, obteniendo perfil completo...', {
                        hasUserId: !!branchData.user_id,
                        hasClientId: !!branchData.client_id,
                        hasBranchId: !!branchData.branch_id
                    });
                    
                    try {
                        // Establecer token temporalmente para obtener perfil
                        API.defaults.headers.common.Authorization = `Bearer ${token}`;
                        
                        const profileResult = await API.get('/branch-auth/profile');
                        if (profileResult.data.success && profileResult.data.data) {
                            const completeData = {
                                ...profileResult.data.data,
                                type: 'branch'
                            };
                            
                            // Guardar datos completos
                            localStorage.setItem('branchAuthToken', token);
                            localStorage.setItem('branchData', JSON.stringify(completeData));
                            
                            dispatch({
                                type: TYPES.LOGIN_SUCCESS,
                                payload: {
                                    authType: 'branch',
                                    branch: completeData,
                                    token: token,
                                },
                            });
                            
                            console.log('✅ Login de sucursal exitoso con datos completos');
                            return { success: true, data: completeData };
                        } else {
                            throw new Error('No se pudo obtener el perfil completo');
                        }
                    } catch (profileError) {
                        console.error('❌ Error obteniendo perfil después del login:', profileError);
                        return {
                            success: false,
                            error: 'Error cargando datos completos. Intenta nuevamente.'
                        };
                    }
                }
                
                // Los datos están completos desde el login
                if (branchData.email) {
                    emailUtils.validateEmailIntegrity(sanitizedInputEmail, branchData.email);
                }

                console.log('✅ Branch login successful:', {
                    branch_id: branchData.branch_id,
                    user_id: branchData.user_id,
                    client_id: branchData.client_id,
                    emailSent: sanitizedInputEmail,
                    emailReceived: branchData.email,
                    branchname: branchData.branchname,
                    tokenLength: token.length
                });

                const enrichedBranch = { ...branchData, type: 'branch' };
                
                localStorage.setItem('branchAuthToken', token);
                localStorage.setItem('branchData', JSON.stringify(enrichedBranch));
                
                dispatch({
                    type: TYPES.LOGIN_SUCCESS,
                    payload: {
                        authType: AUTH_TYPES.BRANCH,
                        branch: enrichedBranch,
                        token: token,
                    },
                });
                
                API.defaults.headers.common.Authorization = `Bearer ${token}`;

                return { success: true, data: branchData };

            } else {
                const normalizedCredentials = {
                    mail: sanitizedInputEmail,
                    password: credentials.password
                };

                console.log('🔄 User login - Email enviado al backend:', normalizedCredentials.mail);
                const response = await API.post('/auth/login', normalizedCredentials);
                const data = response.data;

                if (!data.success) {
                    throw new Error(data.message || ERROR_MESSAGES.INVALID_CREDENTIALS);
                }

                const { token, user: userObject } = data.data;

                console.log('📡 Respuesta del backend - Usuario recibido:', {
                    emailSent: sanitizedInputEmail,
                    userEmailReceived: userObject.email,
                    userMailReceived: userObject.mail,
                    userId: userObject.id
                });

                let normalizedUser = normalizeUserData(userObject);
                const receivedEmail = normalizedUser.email || normalizedUser.mail;
                emailUtils.validateEmailIntegrity(sanitizedInputEmail, receivedEmail);
                normalizedUser = await enrichUserWithProfile(normalizedUser);

                localStorage.setItem("token", token);
                localStorage.setItem("user", JSON.stringify(normalizedUser));
                API.defaults.headers.common.Authorization = `Bearer ${token}`;

                dispatch({
                    type: TYPES.LOGIN_SUCCESS,
                    payload: {
                        authType: AUTH_TYPES.USER,
                        user: normalizedUser,
                        token
                    },
                });

                console.log('✅ User login successful:', {
                    emailSent: sanitizedInputEmail,
                    finalEmail: normalizedUser.email || normalizedUser.mail,
                    userId: normalizedUser.id
                });

                return { success: true };
            }

        } catch (err) {
            console.error('🚨 Error en login:', {
                message: err.message,
                status: err.response?.status,
                authType,
                emailUsed: sanitizedInputEmail
            });
            if (authType === AUTH_TYPES.BRANCH) {
                localStorage.removeItem('branchAuthToken');
                localStorage.removeItem('branchData');
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('clientProfile');
            }

            const errorMessage = err.response?.data?.message || err.message || ERROR_MESSAGES.UNKNOWN_ERROR;
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });

            return { success: false, error: errorMessage };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, [normalizeUserData, enrichUserWithProfile]);

    useEffect(() => {
        if (process.env.NODE_ENV === 'development' && state.user) {
            console.log('🔍 Debug AuthContext - Usuario completo:', {
                name: state.user.name,
                email: state.user.email || state.user.mail,
                role: state.user.role,
                clientProfile: state.user.clientProfile,
                tamanoEmpresa: state.user.clientProfile?.tamanoEmpresa
            });
        }
    }, [state.user]);

    // ========================================================================
    // RESTO DE FUNCIONES (sin cambios críticos)
    // ========================================================================

    const logout = useCallback(async () => {
        console.log('🔄 Iniciando logout...');
        dispatch({ type: TYPES.SET_LOADING, payload: true });

        try {
            if (state.authType === AUTH_TYPES.BRANCH) {
                console.log('🔄 Logout de sucursal...');
                await branchAuthService.logout();
                console.log('✅ Branch logout successful');
            } else {
                console.log('🔄 Logout de usuario principal...');
                console.log('✅ User logout successful');
            }
        } catch (err) {
            console.error('❌ Error during logout:', err);
        } finally {
            clearStorage();
            dispatch({ type: TYPES.LOGOUT_SUCCESS });
            console.log('✅ Logout completado');
        }
    }, [state.authType, clearStorage]);

    const checkBranchRegistration = useCallback(async (email) => {
        dispatch({ type: TYPES.SET_BRANCH_VERIFYING, payload: true });
        try {
            console.log('🔄 Verificando estado de sucursal:', email);
            
            // USAR EL SERVICIO CORREGIDO
            const response = await API.post('/branch-auth/check-registration', { email });
            
            if (response.data && response.data.data) {
                const branchData = response.data.data;
                
                console.log('✅ Estado de sucursal obtenido:', branchData);
                dispatch({ type: TYPES.SET_BRANCH_VERIFICATION_STATUS, payload: branchData });
                
                return {
                    success: true,
                    data: branchData
                };
            } else {
                throw new Error('No se encontró información de la sucursal');
            }
        } catch (err) {
            console.error('❌ Error verificando sucursal:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Error verificando estado de sucursal';
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            
            return {
                success: false,
                error: errorMessage
            };
        } finally {
            dispatch({ type: TYPES.SET_BRANCH_VERIFYING, payload: false });
        }
    }, []);

    // ✅ NUEVO: Función para iniciar verificación de email
    const initiateBranchEmailVerification = useCallback(async (email, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            console.log('📧 Iniciando verificación de email para:', email);
            
            const payload = { email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            
            const response = await API.post('/branch-auth/initiate-email-verification', payload);
            
            console.log('✅ Verificación de email iniciada');
            return {
                success: true,
                data: response.data,
                message: response.data.message || 'Correo de verificación enviado'
            };
        } catch (err) {
            console.error('❌ Error iniciando verificación:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Error enviando correo de verificación';
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            
            return {
                success: false,
                error: errorMessage
            };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const registerBranch = useCallback(async (registrationData, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const payload = { ...registrationData };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;

            const result = await branchRegistrationService.registerBranch(payload);
            if (!result.success) {
                throw new Error(result.error);
            }

            if (isDevelopment) {
                console.log('✅ Branch registration successful:', result.data);
            }

            return result.data;
        } catch (err) {
            dispatch({ type: TYPES.SET_ERROR, payload: err.message });
            throw err;
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const validateBranchEmail = useCallback(async (email) => {
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
        } catch (err) {
            console.error('❌ Error validando email:', err);

            if (err.response?.status === 400) {
                const errorMessage = err.response.data?.message || '';

                if (errorMessage.includes('ya tiene credenciales configuradas')) {
                    return {
                        success: true,
                        isValid: true,
                        branchInfo: {
                            needsRegistration: false,
                            hasPassword: true,
                            branch_name: '',
                            is_login_enabled: true,
                            ...err.response.data
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
                error: err.response?.data?.message || 'Error validando email de sucursal'
            };
        }
    }, []);

    const verifyBranchEmail = useCallback(async (token) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            console.log('🔄 Verificando token de email:', token);
            
            const response = await API.get(`/branch-auth/verify-email/${token}`);
            
            if (!response.data || response.data.success === false) {
                throw new Error(response.data?.message || 'Error verificando email de sucursal');
            }

            console.log('✅ Verificación de email de sucursal completada');
            return {
                success: true,
                data: response.data
            };
        } catch (err) {
            console.error('❌ Error verificando email:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Error verificando email de sucursal';
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            
            return { 
                success: false, 
                error: errorMessage 
            };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    //cambios
    // ✅ CORREGIDO: Función para reenviar verificación
    const resendBranchVerification = useCallback(async (email, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            console.log('🔄 Reenviando verificación de email para:', email);
            
            const payload = { email }; // CORRECCIÓN: usar 'email' no 'mail'
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            
            const response = await API.post('/branch-auth/resend-verification', payload);
            
            console.log('✅ Verificación reenviada exitosamente');
            return {
                success: true,
                data: response.data,
                message: response.data.message || 'Correo de verificación reenviado'
            };
        } catch (err) {
            console.error('❌ Error reenviando verificación:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Error reenviando verificación';
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            
            return {
                success: false,
                error: errorMessage
            };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const requestBranchPasswordReset = useCallback(async (email, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const result = await branchRegistrationService.requestBranchPasswordReset(email, recaptchaToken);

            if (!result.success) {
                dispatch({ type: TYPES.SET_ERROR, payload: result.error });
            }

            return result;
        } catch (err) {
            const errorMessage = err.message || 'Error solicitando reset de contraseña';
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            return { success: false, error: errorMessage };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const resetBranchPassword = useCallback(async (token, newPassword) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const result = await branchRegistrationService.resetBranchPassword(token, newPassword);

            if (!result.success) {
                dispatch({ type: TYPES.SET_ERROR, payload: result.error });
            }

            return result;
        } catch (err) {
            const errorMessage = err.message || 'Error actualizando contraseña';
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            return { success: false, error: errorMessage };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const resendVerificationEmail = useCallback(async (email, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const payload = { mail: email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            const res = await API.post("/auth/resend-verification", payload);
            return { success: true, message: res.data.message || 'Correo enviado' };
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Error enviando correo";
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            throw new Error(errorMessage);
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const register = useCallback(async (userData) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const res = await API.post("/auth/register", userData);
            return res.data;
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Error en el registro";
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            throw new Error(errorMessage);
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const requestPasswordReset = useCallback(async (email, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const payload = { mail: email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            const res = await API.post("/password/request-reset", payload);
            return res.data;
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Error al solicitar recuperación";
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            throw new Error(errorMessage);
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const resetPassword = useCallback(async (token, password, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const payload = { token, password };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            const res = await API.post("/password/reset", payload);
            return res.data;
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Error al restablecer contraseña";
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            throw new Error(errorMessage);
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    const isAdmin = useCallback(() => {
        const u = state.user;
        if (!u) return false;
        const role = u.role || u.rol;
        if (role === undefined || role === null) return false;
        if (typeof role === 'string') {
            const num = parseInt(role);
            return !isNaN(num) ? (num === 1 || num === 3) : (role === "1" || role === "3");
        }
        return typeof role === 'number' && (role === 1 || role === 3);
    }, [state.user]);

    const updateUserInfo = useCallback((updatedUserData) => {
        const u = state.user;
        if (!u) return;
        const isActive = u.is_active !== undefined ? u.is_active : true;
        const newUser = { ...u, ...updatedUserData, is_active: isActive };
        localStorage.setItem("user", JSON.stringify(newUser));
        if (updatedUserData.nombre) {
            const profile = {
                nombre: updatedUserData.nombre,
                email: updatedUserData.email || u.email || u.mail,
            };
            localStorage.setItem("clientProfile", JSON.stringify(profile));
        }
        dispatch({ type: TYPES.UPDATE_USER, payload: newUser });
    }, [state.user]);

    const updateBranchInfo = useCallback((updatedBranchData) => {
        const b = state.branch;
        if (!b) return;
        const newBranch = { ...b, ...updatedBranchData };
        localStorage.setItem("branchData", JSON.stringify(newBranch));
        dispatch({ type: TYPES.UPDATE_BRANCH, payload: newBranch });
    }, [state.branch]);

    const clearError = useCallback(() => {
        dispatch({ type: TYPES.CLEAR_ERROR });
    }, []);

    // ========================================================================
    // VALOR DEL CONTEXTO
    // ========================================================================
    const value = useMemo(() => ({
        // Estados
        ...state,

        // Funciones principales
        login,
        logout,
        register,
        resendVerificationEmail,
        requestPasswordReset,
        resetPassword,
        clearError,
        loadClientProfile,
        enrichUserWithProfile,

        // Funciones de utilidad
        isAdmin,
        updateUserInfo,
        updateBranchInfo,

        // Funciones de sucursales
        checkBranchRegistration,
        registerBranch,
        validateBranchEmail,
        verifyBranchEmail,
        resendBranchVerification,
        requestBranchPasswordReset,
        resetBranchPassword,
        initiateBranchEmailVerification,

        // ✅ NUEVO MÉTODO: Refrescar autenticación
        refreshAuth: useCallback(async () => {
            if (state.authType === 'branch' && state.token) {
                try {
                    console.log('🔄 Refrescando datos de autenticación...');
                    const profileResult = await API.get('/branch-auth/profile');
                    
                    if (profileResult.data.success && profileResult.data.data) {
                        const freshData = { ...profileResult.data.data, type: 'branch' };
                        localStorage.setItem('branchData', JSON.stringify(freshData));
                        
                        dispatch({
                            type: TYPES.LOGIN_SUCCESS,
                            payload: {
                                authType: 'branch',
                                branch: freshData,
                                token: state.token,
                            },
                        });
                        
                        console.log('✅ Datos refrescados exitosamente');
                        return true;
                    }
                } catch (error) {
                    console.error('❌ Error refrescando autenticación:', error);
                }
            }
            return false;
        }, [state.authType, state.token]),

        // Estados adicionales para compatibilidad
        isBranchVerifying: state.isBranchVerifying,
        branchVerificationStatus: state.branchVerificationStatus,

        // Funciones de utilidad adicionales
        isUserAuth: () => state.authType === AUTH_TYPES.USER,
        isBranchAuth: () => state.authType === AUTH_TYPES.BRANCH,
    }), [
        state,
        isAdmin,
        login,
        logout,
        register,
        resendVerificationEmail,
        requestPasswordReset,
        resetPassword,
        clearError,
        loadClientProfile,
        enrichUserWithProfile,
        updateUserInfo,
        updateBranchInfo,
        checkBranchRegistration,
        registerBranch,
        validateBranchEmail,
        verifyBranchEmail,
        resendBranchVerification,
        requestBranchPasswordReset,
        resetBranchPassword,
        initiateBranchEmailVerification
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext, AuthProvider };
export default AuthContext;