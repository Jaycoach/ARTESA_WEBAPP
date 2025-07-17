import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";  // Hook unificado de autenticación
import { useRecaptcha } from "../../hooks/useRecaptcha";
import { useFormValidation } from "../../hooks/useFormValidation";
import { useError } from "../../context/ErrorContext";
import FormErrorMessage from "../ui/FormErrorMessage";
import AuthTypeSelector from "./AuthTypeSelector";
import { AUTH_TYPES } from "../../constants/AuthTypes";

// Import Assets
import img from "../../LoginsAssets/principal_img.gif";
import logo from "../../LoginsAssets/logo_artesa_new.png";

// Import Icons
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { MdEmail } from "react-icons/md";

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Hook unificado de autenticación (reemplaza useDualAuth)
    const {
        isAuthenticated,
        authType: currentAuthType,
        login,  // Función unificada para login (user/branch)
        clearError,
        isLoading: authLoading,
        error: authError,
        requestPasswordReset  // Para reset password
    } = useAuth();

    const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError } = useRecaptcha();

    // Estados locales
    const [authType, setAuthType] = useState(AUTH_TYPES.USER);
    const [forgotPassword, setForgotPassword] = useState(false);

    // Validación de formulario
    const { values, setValues, validateField } = useFormValidation({
        mail: '',
        password: ''
    });
    const { errors, setFieldError, clearFieldError, clearAllErrors } = useError();

    const [generalError, setGeneralError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetMessage, setResetMessage] = useState("");

    // Redirección automática para usuarios ya autenticados
    useEffect(() => {
        if (isAuthenticated && currentAuthType) {
            const from = location.state?.from?.pathname;
            const redirectPath = from && from !== '/login'
                ? from
                : currentAuthType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';

            navigate(redirectPath, { replace: true });
        }
    }, [isAuthenticated, currentAuthType, navigate, location.state]);

    // Sincronizar errores del contexto
    useEffect(() => {
        if (authError) {
            setGeneralError(authError);
        }
    }, [authError]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setValues({ ...values, [id]: value });

        if (errors[id]) {
            clearFieldError(id);
        }

        if (generalError) {
            setGeneralError('');
            if (clearError) clearError();
        }
    };

    const handleBlur = (e) => {
        const { id, value } = e.target;
        const rules = id === 'mail' ? ['required', 'email'] : ['required'];
        const error = validateField(id, value, rules);

        if (error) {
            setFieldError(id, error);
        } else {
            clearFieldError(id);
        }
    };

    const handleInvalid = (e) => {
        e.preventDefault();
        const { id, value } = e.target;
        const rules = id === 'mail' ? ['required', 'email'] : ['required'];
        const error = validateField(id, value, rules);

        if (error) {
            setFieldError(id, error);
        }
    };

    const handleResetChange = (e) => {
        setResetEmail(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearAllErrors();
        setGeneralError('');
        if (clearError) clearError();

        // Validar campos
        let formValid = true;
        for (const [key, value] of Object.entries(values)) {
            const rules = key === 'mail' ? ['required', 'email'] : ['required'];
            const error = validateField(key, value, rules);
            if (error) {
                setFieldError(key, error);
                formValid = false;
            }
        }

        if (!formValid) return;

        setLoading(true);

        try {
            const recaptchaToken = await generateRecaptchaToken('login');
            if (!recaptchaToken) {
                setGeneralError(recaptchaError || 'Error en verificación de seguridad');
                return;
            }

            const credentials = {
                mail: values.mail,
                password: values.password,
                recaptchaToken,
            };

            // Llamar a la función unificada login con authType
            const result = await login(credentials, authType);

            if (result.success) {
                setGeneralError('');
            } else {
                setGeneralError(result.error || 'Error en el login');
            }
        } catch (error) {
            if (error.response?.data?.needsVerification) {
                setGeneralError('Verifica tu correo electrónico. Revisa tu bandeja o solicita reenvío.');
            } else if (error.code === 'ERR_NETWORK') {
                setGeneralError('Error de conexión con el servidor.');
            } else {
                setGeneralError(error.message || 'Error en el inicio de sesión');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetMessage("");
        setGeneralError("");
        if (clearError) clearError();

        if (!resetEmail.trim() || !/\S+@\S+\.\S+/.test(resetEmail)) {
            setGeneralError("Ingrese un correo electrónico válido");
            return;
        }

        setLoading(true);

        try {
            const recaptchaToken = await generateRecaptchaToken('password_reset');
            if (!recaptchaToken) {
                setGeneralError(recaptchaError || 'Error en verificación de seguridad');
                return;
            }

            // Usar requestPasswordReset directamente del contexto
            const response = await requestPasswordReset(resetEmail, recaptchaToken);
            setResetMessage(response.message || "Revisa tu correo para continuar.");
        } catch (error) {
            setGeneralError("No se pudo procesar la solicitud.");
        } finally {
            setLoading(false);
        }
    };

    const handleAuthTypeChange = (newAuthType) => {
        setAuthType(newAuthType);
        setGeneralError('');
        if (clearError) clearError();
        clearAllErrors();
    };

    const isCurrentlyLoading = loading || authLoading || recaptchaLoading;


    return (
        <div className="min-h-screen flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: '#687e8d' }}>
            {/* Contenedor principal más compacto */}
            <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
                {/* Layout responsive compacto */}
                <div className="flex flex-col lg:flex-row h-auto lg:h-[500px]">
                    
                    {/* Sección de imagen - Más compacta */}
                    <div className="lg:w-1/2 h-48 lg:h-full relative">
                        <img
                            src={img}
                            alt="Artesa Panadería"
                            className="w-full h-full object-cover"
                        />
                        
                        {/* Footer compacto */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                            <div 
                                className="bg-black/60 backdrop-blur-sm rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm"
                                style={{ backdropFilter: 'blur(10px)' }}
                            >
                                <span className="text-white/90">¿No tienes cuenta?</span>
                                <button
                                    onClick={() => navigate("/register")}
                                    className="px-3 py-1.5 rounded-md text-xs font-medium text-white border border-white/30 hover:bg-white/20 transition-all duration-300"
                                    style={{ backgroundColor: 'rgba(71, 128, 144, 0.8)' }}
                                >
                                    Registrarse
                                </button>
                                <span className="text-white/75">© 2025 Artesa</span>
                            </div>
                        </div>
                    </div>

                    {/* Sección del formulario - Más compacta */}
                    <div className="lg:w-1/2 p-4 sm:p-6 lg:p-8 bg-white flex items-center">
                        <div className="w-full max-w-sm mx-auto">
                            {/* Header compacto */}
                            <div className="text-center mb-6">
                                <img
                                    src={logo}
                                    alt="Logo Artesa"
                                    className="h-12 mx-auto mb-4"
                                />
                                <h1 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
                                    {forgotPassword ? "Recuperar contraseña" : "¡Bienvenido!"}
                                </h1>
                            </div>

                            {/* Botón de registro para móvil */}
                            <div className="lg:hidden text-center mb-4">
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                    <span className="text-xs text-gray-600">¿No tienes cuenta?</span>
                                    <button
                                        onClick={() => navigate("/register")}
                                        className="px-3 py-1.5 rounded-md text-xs font-medium text-white transition-all duration-300"
                                        style={{ backgroundColor: '#478090' }}
                                    >
                                        Registrarse
                                    </button>
                                </div>
                            </div>

                            {forgotPassword ? (
                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    {resetMessage && (
                                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs">
                                            {resetMessage}
                                        </div>
                                    )}

                                    {generalError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
                                            {generalError}
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="resetEmail" className="block text-xs font-medium text-gray-700 mb-1">
                                            Correo Electrónico
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <MdEmail className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                type="email"
                                                id="resetEmail"
                                                placeholder="Ingrese su correo registrado"
                                                value={resetEmail}
                                                onChange={handleResetChange}
                                                required
                                                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                style={{ backgroundColor: '#f6db8e' }}
                                                disabled={isCurrentlyLoading}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50"
                                        style={{ backgroundColor: '#478090' }}
                                        disabled={isCurrentlyLoading}
                                    >
                                        <span>{isCurrentlyLoading ? "Enviando..." : "Enviar enlace"}</span>
                                        <TiArrowRightOutline className="h-4 w-4" />
                                    </button>

                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setForgotPassword(false)}
                                            className="text-xs font-medium hover:underline"
                                            style={{ color: '#478090' }}
                                        >
                                            ¿Recordaste tu contraseña? Inicia sesión aquí
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                                    <AuthTypeSelector
                                        selectedType={authType}
                                        onTypeChange={handleAuthTypeChange}
                                        disabled={isCurrentlyLoading}
                                    />

                                    {generalError && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
                                            {generalError}
                                        </div>
                                    )}

                                    {generalError && generalError.includes('verificar tu correo') && (
                                        <div className="text-center">
                                            <Link
                                                to="/resend-verification"
                                                className="text-xs font-medium hover:underline"
                                                style={{ color: '#478090' }}
                                            >
                                                Reenviar correo de verificación
                                            </Link>
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor="mail" className="block text-xs font-medium text-gray-700 mb-1">
                                            Correo Electrónico
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <MdEmail className={`h-4 w-4 ${
                                                    errors.mail ? 'text-red-500' :
                                                    values.mail && !errors.mail ? 'text-green-500' :
                                                    'text-gray-500'
                                                }`} />
                                            </div>
                                            <input
                                                type="email"
                                                id="mail"
                                                name="mail"
                                                placeholder={authType === AUTH_TYPES.BRANCH ? "Correo de la sucursal" : "Escriba su correo electrónico"}
                                                value={values.mail}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                onInvalid={handleInvalid}
                                                required
                                                className={`block w-full pl-9 pr-9 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm ${
                                                    errors.mail
                                                        ? 'border-red-500 focus:ring-red-500'
                                                        : values.mail && !errors.mail
                                                            ? 'border-green-500 focus:ring-green-500'
                                                            : 'border-gray-300 focus:ring-blue-500'
                                                }`}
                                                style={{ backgroundColor: '#f6db8e' }}
                                                disabled={isCurrentlyLoading}
                                            />
                                            {values.mail && !errors.mail && (
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                                    <span className="text-green-500 text-sm font-bold">✓</span>
                                                </div>
                                            )}
                                        </div>
                                        {errors.mail && <FormErrorMessage message={errors.mail} />}
                                    </div>

                                    <div>
                                        <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                                            Contraseña
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <BsFillShieldLockFill className={`h-4 w-4 ${
                                                    errors.password ? 'text-red-500' :
                                                    values.password && !errors.password ? 'text-green-500' :
                                                    'text-gray-500'
                                                }`} />
                                            </div>
                                            <input
                                                type="password"
                                                id="password"
                                                name="password"
                                                placeholder={authType === AUTH_TYPES.BRANCH ? "Contraseña de la sucursal" : "Escriba su contraseña"}
                                                value={values.password}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                onInvalid={handleInvalid}
                                                required
                                                className={`block w-full pl-9 pr-9 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm ${
                                                    errors.password
                                                        ? 'border-red-500 focus:ring-red-500'
                                                        : values.password && !errors.password
                                                            ? 'border-green-500 focus:ring-green-500'
                                                            : 'border-gray-300 focus:ring-blue-500'
                                                }`}
                                                style={{ backgroundColor: '#f6db8e' }}
                                                disabled={isCurrentlyLoading}
                                            />
                                            {values.password && !errors.password && (
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                                    <span className="text-green-500 text-sm font-bold">✓</span>
                                                </div>
                                            )}
                                        </div>
                                        {errors.password && <FormErrorMessage message={errors.password} />}
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        style={{ backgroundColor: '#478090' }}
                                        disabled={isCurrentlyLoading}
                                    >
                                        <span>
                                            {isCurrentlyLoading ? "Iniciando sesión..." :
                                                authType === AUTH_TYPES.BRANCH ? "Acceder como Sucursal" : "Iniciar sesión"}
                                        </span>
                                        <TiArrowRightOutline className="h-4 w-4" />
                                    </button>

                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setForgotPassword(true)}
                                            className="text-xs font-medium hover:underline"
                                            style={{ color: '#478090' }}
                                        >
                                            ¿Olvidaste tu contraseña? Haz Clic Aquí
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Footer móvil compacto */}
                            <div className="lg:hidden text-center mt-4">
                                <span className="text-xs text-gray-500">© 2025 Artesa</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;