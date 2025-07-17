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

// Estado inicial
const initialState = {
    authType: null,        // 'user' | 'branch'
    user: null,
    branch: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
};

// Acciones
const TYPES = {
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
    CLEAR_ERROR: 'CLEAR_ERROR',
    UPDATE_USER: 'UPDATE_USER',
};

// Reducer
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
            };
        case TYPES.LOGOUT_SUCCESS:
            return { ...initialState, isLoading: false };
        case TYPES.CLEAR_ERROR:
            return { ...state, error: null };
        case TYPES.UPDATE_USER:
            return { ...state, user: payload };
        default:
            return state;
    }
}

// Contexto
export const AuthContext = createContext(null);

// Provider
export function AuthProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

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

    // Inicialización con verificación de sesión (integrado del antiguo)
    useEffect(() => {
        const checkAuthState = async () => {
            const token = localStorage.getItem("token");
            const storedUser = localStorage.getItem("user");
            const storedProfile = localStorage.getItem("clientProfile");
            const branchToken = localStorage.getItem('branchAuthToken');
            const branchData = localStorage.getItem('branchData');

            if (token && storedUser) {
                try {
                    let userData = JSON.parse(storedUser);
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

            if (branchToken && branchData) {
                const valid = await branchAuthService.validateToken();
                if (valid) {
                    dispatch({
                        type: TYPES.LOGIN_SUCCESS,
                        payload: {
                            authType: AUTH_TYPES.BRANCH,
                            branch: JSON.parse(branchData),
                            token: branchToken,
                        },
                    });
                    return;
                }
            }

            clearStorage();
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        };

        checkAuthState();
    }, [clearStorage]);

    // Login (integrado del antiguo, con soporte dual)
    const login = useCallback(async (credentials, authType = AUTH_TYPES.USER) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            let result;
            if (authType === AUTH_TYPES.BRANCH) {
                result = await branchAuthService.login(credentials);
                if (!result.success) throw new Error(result.error);
                dispatch({
                    type: TYPES.LOGIN_SUCCESS,
                    payload: {
                        authType: AUTH_TYPES.BRANCH,
                        branch: result.branchData,
                        token: result.token,
                    },
                });
            } else {
                const res = await API.post('/auth/login', credentials);
                const data = res.data;
                if (!data.success) throw new Error(data.message || ERROR_MESSAGES.INVALID_CREDENTIALS);
                const { token, user: userObject } = data.data;

                // Normalizaciones del antiguo contexto
                userObject.is_active = userObject.is_active !== undefined
                    ? (typeof userObject.is_active === 'string'
                        ? userObject.is_active.toLowerCase() === 'true'
                        : Boolean(userObject.is_active))
                    : true;

                if (userObject.role) {
                    if (typeof userObject.role === 'object' && userObject.role?.id) {
                        userObject.role = parseInt(userObject.role.id);
                    } else if (typeof userObject.role === 'string' || typeof userObject.role === 'number') {
                        userObject.role = parseInt(userObject.role);
                    }
                }

                const storedProfile = localStorage.getItem("clientProfile");
                let userWithProfile = userObject;
                if (storedProfile) {
                    const profileData = JSON.parse(storedProfile);
                    if (profileData.nombre && profileData.email === (userObject.email || userObject.mail)) {
                        userWithProfile = { ...userObject, ...profileData, is_active: userObject.is_active };
                    }
                }

                localStorage.setItem("token", token);
                localStorage.setItem("user", JSON.stringify(userWithProfile));
                API.defaults.headers.common.Authorization = `Bearer ${token}`;
                dispatch({
                    type: TYPES.LOGIN_SUCCESS,
                    payload: { authType: AUTH_TYPES.USER, user: userWithProfile, token },
                });
            }
            return { success: true };
        } catch (err) {
            clearStorage();
            dispatch({ type: TYPES.SET_ERROR, payload: err.message || ERROR_MESSAGES.UNKNOWN_ERROR });
            return { success: false, error: err.message };
        } finally {
            dispatch({ type: TYPES.SET_LOADING, payload: false });
        }
    }, [clearStorage]);

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

    // Logout
    const logout = useCallback(async () => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            if (state.authType === AUTH_TYPES.BRANCH) {
                await branchAuthService.logout();
            }
        } finally {
            clearStorage();
            dispatch({ type: TYPES.LOGOUT_SUCCESS });
        }
    }, [state.authType, clearStorage]);

    // Register
    const register = useCallback(async (userData) => {
        dispatch({ type: TYPES.SET_LOADING, payload: true });
        try {
            const res = await API.post("/auth/register", userData);
            return res.data;
        } catch (err) {
            dispatch({ type: TYPES.SET_ERROR, payload: err.response?.data?.message || "Error en el registro" });
            throw err;
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
            dispatch({ type: TYPES.SET_ERROR, payload: err.response?.data?.message || "Error al solicitar recuperación" });
            throw err;
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
            dispatch({ type: TYPES.SET_ERROR, payload: err.response?.data?.message || "Error al restablecer contraseña" });
            throw err;
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

    // Clear error
    const clearError = useCallback(() => {
        dispatch({ type: TYPES.CLEAR_ERROR });
    }, []);

    // Valor del contexto
    const value = useMemo(() => ({
        ...state,
        login,  // Login unificado (soporta authType)
        logout,
        resendVerificationEmail,
        register,
        requestPasswordReset,
        resetPassword,
        isAdmin,
        updateUserInfo,
        clearError,
    }), [
        state, login, logout, resendVerificationEmail,
        register, requestPasswordReset, resetPassword,
        isAdmin, updateUserInfo, clearError,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;