import React, {
    createContext,
    useReducer,
    useEffect,
    useMemo,
    useCallback,
} from 'react';
import API from '../api/config';
import { branchAuthService } from '../services/branchAuthService';
import { AUTH_TYPES, ERROR_MESSAGES } from '../constants/AuthTypes';
import { isDevelopment } from '../utils/environment';

if (!user && isAuthenticated) {
    console.error('Estado inconsistente: isAuthenticated=true pero user=null');
    return <div>Error en la autenticación. Por favor, inicie sesión nuevamente.</div>;
}

// ============================================================================
// SERVICIO DE REGISTRO DE SUCURSALES INTEGRADO
// ============================================================================
const branchRegistrationService = {
    // Cambiar de GET a POST según documentación
    checkRegistrationStatus: async (email) => {
        try {
            const response = await API.post('/branch-auth/check-registration', {
                email  // Enviar email en el body, no como parámetro
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

    // Corregir ruta y estructura de datos
    registerBranch: async (registrationData) => {
        try {
            // Mapear campos según documentación del backend
            const payload = {
                email: registrationData.email,
                password: registrationData.password,
                manager_name: registrationData.branchName // Mapear branchName a manager_name
            };

            const response = await API.post('/branch-registration/register', payload);
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

    // Cambiar a POST según documentación
    validateBranchEmail: async (email) => {
        try {
            const response = await API.post('/branch-registration/check-email', {
                email: email  
            });

            
            const { success, data } = response.data;

            return {
                success: true,
                isValid: success, 
                branchInfo: data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Error validando email de sucursal'
            };
        }
    }
};

// ============================================================================
// ESTADOS Y CONFIGURACIÓN
// ============================================================================

// Estado inicial
const initialState = {
    authType: null,        // 'user' | 'branch'
    user: null,
    branch: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    // Nuevos estados para manejo de sucursales
    branchVerificationStatus: null,
    isBranchVerifying: false,
};

// Acciones
const TYPES = {
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
    CLEAR_ERROR: 'CLEAR_ERROR',
    UPDATE_USER: 'UPDATE_USER',
    // Nuevas acciones para sucursales
    SET_BRANCH_VERIFYING: 'SET_BRANCH_VERIFYING',
    SET_BRANCH_VERIFICATION_STATUS: 'SET_BRANCH_VERIFICATION_STATUS',
    UPDATE_BRANCH: 'UPDATE_BRANCH',
};

// Reducer actualizado
function reducer(state, { type, payload }) {
    switch (type) {
        case TYPES.SET_LOADING:
            return { ...state, isLoading: payload };
        case TYPES.SET_ERROR:
            return { ...state, error: payload, isLoading: false };
        case TYPES.LOGIN_SUCCESS:
            return {
                ...state,
                ...payload,             // authType, user or branch, token
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

// Contexto
export const AuthContext = createContext(null);

// ============================================================================
// PROVIDER PRINCIPAL
// ============================================================================
export function AuthProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    // ========================================================================
    // FUNCIONES UTILITARIAS
    // ========================================================================

    // Limpieza de storage y headers
    const clearStorage = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('branchAuthToken');
        localStorage.removeItem('branchData');
        localStorage.removeItem('clientProfile');
        if (API.defaults.headers.common.Authorization) {
            delete API.defaults.headers.common.Authorization;
        }
    }, []);

    // Normalizar datos de usuario
    const normalizeUserData = useCallback((userData) => {
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

        return userData;
    }, []);

    // ========================================================================
    // FUNCIONES DE SUCURSALES (NUEVAS)
    // ========================================================================

    // Verificar estado de registro de sucursal
    const checkBranchRegistration = useCallback(async (email) => {
        dispatch({ type: TYPES.SET_BRANCH_VERIFYING, payload: true });
        try {
            const result = await branchRegistrationService.checkRegistrationStatus(email);
            if (!result.success) {
                throw new Error(result.error);
            }

            dispatch({ type: TYPES.SET_BRANCH_VERIFICATION_STATUS, payload: result.data });
            return result.data;
        } catch (err) {
            dispatch({ type: TYPES.SET_ERROR, payload: err.message });
            throw err;
        } finally {
            dispatch({ type: TYPES.SET_BRANCH_VERIFYING, payload: false });
        }
    }, []);

    // Registrar sucursal
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
                console.log('Branch registration successful:', result.data);
            }

            return result.data;
        } catch (err) {
            dispatch({ type: TYPES.SET_ERROR, payload: err.message });
            throw err;
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    // Validar email de sucursal
    const validateBranchEmail = useCallback(async (email) => {
        try {
            const result = await branchRegistrationService.validateBranchEmail(email);
            return result;
        } catch (err) {
            console.error('Error validating branch email:', err);
            return { success: false, error: err.message };
        }
    }, []);

    // ========================================================================
    // INICIALIZACIÓN Y VERIFICACIÓN DE SESIÓN
    // ========================================================================
    useEffect(() => {
        const checkAuthState = async () => {
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

                    // Combinar con perfil si existe
                    if (storedProfile) {
                        const profileData = JSON.parse(storedProfile);
                        const isActive = userData.is_active;
                        userData = { ...userData, ...profileData, is_active: isActive };
                    }

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
                    console.error("Error verificando sesión user:", err);
                    clearStorage();
                    dispatch({ type: TYPES.SET_ERROR, payload: "Sesión inválida" });
                }
            }

            // Verificar sesión de sucursal
            if (branchToken && branchData) {
                try {
                    const valid = await branchAuthService.validateToken();
                    if (valid) {
                        const parsedBranchData = JSON.parse(branchData);
                        dispatch({
                            type: TYPES.LOGIN_SUCCESS,
                            payload: {
                                authType: AUTH_TYPES.BRANCH,
                                branch: parsedBranchData,
                                token: branchToken,
                            },
                        });
                        API.defaults.headers.common.Authorization = `Bearer ${branchToken}`;
                        return;
                    }
                } catch (err) {
                    console.error("Error verificando sesión branch:", err);
                }
            }

            clearStorage();
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        };

        checkAuthState();
    }, [clearStorage, normalizeUserData]);

    // ========================================================================
    // FUNCIONES DE AUTENTICACIÓN
    // ========================================================================

    // Login unificado con soporte completo para sucursales
    const login = useCallback(async (credentials, authType = AUTH_TYPES.USER) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            let result;

            if (authType === AUTH_TYPES.BRANCH) {
                // Login para sucursales (este bloque se mantiene igual)
                result = await branchAuthService.login(credentials);
                if (!result.success) throw new Error(result.error);

                localStorage.setItem('branchAuthToken', result.token);
                localStorage.setItem('branchData', JSON.stringify(result.branchData));
                API.defaults.headers.common.Authorization = `Bearer ${result.token}`;

                dispatch({
                    type: TYPES.LOGIN_SUCCESS,
                    payload: {
                        authType: AUTH_TYPES.BRANCH,
                        branch: result.branchData,
                        token: result.token,
                    },
                });

                if (isDevelopment) {
                    console.log('Branch login successful:', result.branchData);
                }
            } else {
                // Login para usuarios principales
                const res = await API.post('/auth/login', credentials);
                const data = res.data;
                if (!data.success) throw new Error(data.message || ERROR_MESSAGES.INVALID_CREDENTIALS);
                const { token, user: userObject } = data.data;

                // Normalizar datos de usuario
                const normalizedUser = normalizeUserData(userObject);

                // Combinar con perfil almacenado si existe
                const storedProfile = localStorage.getItem("clientProfile");
                let userWithProfile = normalizedUser;
                if (storedProfile) {
                    const profileData = JSON.parse(storedProfile);
                    if (profileData.nombre && profileData.email === (normalizedUser.email || normalizedUser.mail)) {
                        userWithProfile = { ...normalizedUser, ...profileData, is_active: normalizedUser.is_active };
                    }
                }

                // Almacenar datos de usuario
                localStorage.setItem("token", token);
                localStorage.setItem("user", JSON.stringify(userWithProfile));
                API.defaults.headers.common.Authorization = `Bearer ${token}`;

                dispatch({
                    type: TYPES.LOGIN_SUCCESS,
                    payload: { authType: AUTH_TYPES.USER, user: userWithProfile, token },
                });

                if (isDevelopment) {
                    console.log('User login successful:', userWithProfile);
                }
            }

            return { success: true };
        } catch (err) {
            clearStorage();

            // 🔥 AQUÍ ESTÁ EL CAMBIO CLAVE: Extraer el mensaje exacto de la API
            const errorMessage = err.response?.data?.message || err.message || ERROR_MESSAGES.UNKNOWN_ERROR;

            // Para debugging - puedes quitar este console.log después
            if (isDevelopment) {
                console.log('🔍 Error capturado en AuthContext:', {
                    hasResponse: !!err.response,
                    hasData: !!err.response?.data,
                    apiMessage: err.response?.data?.message,
                    fallbackMessage: err.message,
                    finalMessage: errorMessage
                });
            }

            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            return { success: false, error: errorMessage };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, [clearStorage, normalizeUserData]);

    // Logout mejorado
    const logout = useCallback(async () => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            if (state.authType === AUTH_TYPES.BRANCH) {
                await branchAuthService.logout();
                if (isDevelopment) {
                    console.log('Branch logout successful');
                }
            } else if (isDevelopment) {
                console.log('User logout successful');
            }
        } catch (err) {
            console.error('Error during logout:', err);
        } finally {
            clearStorage();
            dispatch({ type: TYPES.LOGOUT_SUCCESS });
        }
    }, [state.authType, clearStorage]);

    // ========================================================================
    // FUNCIONES EXISTENTES (MANTENIDAS SIN CAMBIOS)
    // ========================================================================

    // Resend verification email
    const resendVerificationEmail = useCallback(async (email, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const payload = { mail: email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            const res = await API.post("/auth/resend-verification", payload);
            return { success: true, message: res.data.message || 'Correo enviado' };
        } catch (err) {
            dispatch({ type: TYPES.SET_ERROR, payload: err.message });
            throw err;
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    // Register
    const register = useCallback(async (userData) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const res = await API.post("/auth/register", userData);
            return res.data;
        } catch (err) {
            // 🔥 CAMBIO: Priorizar mensaje de la API
            const errorMessage = err.response?.data?.message || err.message || "Error en el registro";
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            throw new Error(errorMessage); // Cambiar para que propague el mensaje correcto
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    // Request password reset
    const requestPasswordReset = useCallback(async (email, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const payload = { mail: email };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            const res = await API.post("/password/request-reset", payload);
            return res.data;
        } catch (err) {
            // 🔥 CAMBIO: Priorizar mensaje de la API
            const errorMessage = err.response?.data?.message || err.message || "Error al solicitar recuperación";
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            throw new Error(errorMessage);
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    // Reset password
    const resetPassword = useCallback(async (token, password, recaptchaToken = null) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const payload = { token, password };
            if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
            const res = await API.post("/password/reset", payload);
            return res.data;
        } catch (err) {
            // 🔥 CAMBIO: Priorizar mensaje de la API
            const errorMessage = err.response?.data?.message || err.message || "Error al restablecer contraseña";
            dispatch({ type: TYPES.SET_ERROR, payload: errorMessage });
            throw new Error(errorMessage);
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, []);

    // isAdmin
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

    // Update user info
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

    // Update branch info (Nueva función para sucursales)
    const updateBranchInfo = useCallback((updatedBranchData) => {
        const b = state.branch;
        if (!b) return;
        const newBranch = { ...b, ...updatedBranchData };
        localStorage.setItem("branchData", JSON.stringify(newBranch));
        dispatch({ type: TYPES.UPDATE_BRANCH, payload: newBranch });
    }, [state.branch]);

    // Clear error
    const clearError = useCallback(() => {
        dispatch({ type: TYPES.CLEAR_ERROR });
    }, []);

    // ========================================================================
    // VALOR DEL CONTEXTO
    // ========================================================================
    const value = useMemo(() => ({
        // Estados existentes
        ...state,

        // Funciones existentes
        login,
        logout,
        resendVerificationEmail,
        register,
        requestPasswordReset,
        resetPassword,
        isAdmin,
        updateUserInfo,
        clearError,

        // Nuevas funciones para sucursales
        checkBranchRegistration,
        registerBranch,
        validateBranchEmail,
        updateBranchInfo,

        // Estados adicionales para sucursales
        isBranchVerifying: state.isBranchVerifying,
        branchVerificationStatus: state.branchVerificationStatus,
    }), [
        state,
        login,
        logout,
        resendVerificationEmail,
        register,
        requestPasswordReset,
        resetPassword,
        isAdmin,
        updateUserInfo,
        clearError,
        checkBranchRegistration,
        registerBranch,
        validateBranchEmail,
        updateBranchInfo,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;