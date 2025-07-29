import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useRecaptcha } from "../../hooks/useRecaptcha";
import { useFormValidation } from "../../hooks/useFormValidation";
import { useError } from "../../context/ErrorContext";
import FormErrorMessage from "../ui/FormErrorMessage";
import AuthTypeSelector from "./AuthTypeSelector";
import { AUTH_TYPES } from "../../constants/AuthTypes";
import BranchRegistrationForm from "./BranchRegistrationForm";

// Import Assets
import img from "../../LoginsAssets/principal_img.gif";
import logo from "../../LoginsAssets/logo_artesa_new.png";

// Import Icons
import { BsFillShieldLockFill, BsBuilding } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { MdEmail, MdPhone, MdLocationOn } from "react-icons/md";

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Hook unificado de autenticación con funciones de sucursales
    const {
        isAuthenticated,
        authType: currentAuthType,
        login,
        clearError,
        isLoading: authLoading,
        error: authError,
        requestPasswordReset,
        checkBranchRegistration,
        registerBranch,
        isBranchVerifying,
        branchVerificationStatus,
        validateBranchEmail  // Reutilizada para verificación previa
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

    // Estados para manejo de sucursales
    const [showBranchRegistration, setShowBranchRegistration] = useState(false);
    const [branchRegistrationEmail, setBranchRegistrationEmail] = useState('');
    const [isVerifyingBranch, setIsVerifyingBranch] = useState(false);
    const [branchFoundMessage, setBranchFoundMessage] = useState('');

    // Estados para verificación previa de email
    const [showEmailVerification, setShowEmailVerification] = useState(false);
    const [showPasswordField, setShowPasswordField] = useState(false);

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

    // Activar verificación previa al seleccionar Branch
    useEffect(() => {
        if (authType === AUTH_TYPES.BRANCH) {
            setShowEmailVerification(true);
            setShowPasswordField(false);
            setShowBranchRegistration(false);
        } else {
            setShowEmailVerification(false);
            setShowPasswordField(true);
        }
    }, [authType]);

    // Funciones de manejo de formularios
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

    const handleAuthTypeChange = (newAuthType) => {
        setAuthType(newAuthType);
        setGeneralError('');
        if (clearError) clearError();
        clearAllErrors();

        // Limpiar estados de sucursales al cambiar tipo
        setShowBranchRegistration(false);
        setBranchRegistrationEmail('');
        setIsVerifyingBranch(false);
        setShowEmailVerification(newAuthType === AUTH_TYPES.BRANCH);
        setShowPasswordField(newAuthType !== AUTH_TYPES.BRANCH);
    };
    // Manejar el registro de sucursales
    const handleBranchRegistration = async (registrationData) => {
        try {
            setGeneralError('');

            const recaptchaToken = await generateRecaptchaToken('branch_registration');
            if (!recaptchaToken) {
                setGeneralError(recaptchaError || 'Error en verificación de seguridad');
                return;
            }

            // Completar registro de sucursal
            await registerBranch(registrationData, recaptchaToken);

            // Después del registro exitoso, intentar login automático
            const loginCredentials = {
                mail: registrationData.email,
                password: registrationData.password,
                recaptchaToken: await generateRecaptchaToken('login'),
            };

            const result = await login(loginCredentials, AUTH_TYPES.BRANCH);

            if (result.success) {
                setShowBranchRegistration(false);
                setBranchRegistrationEmail('');
                console.log('Registro y login de sucursal completados exitosamente');
            } else {
                setGeneralError('Registro completado. Por favor, inicia sesión manualmente.');
                setShowBranchRegistration(false);
                setBranchRegistrationEmail('');
                // Limpiar campos para login manual
                setValues({ mail: registrationData.email, password: '' });
                setShowPasswordField(true);
            }
        } catch (error) {
            console.error('Error en registro de sucursal:', error);
            const apiErrorMessage = extractApiErrorMessage(error);
            setGeneralError(apiErrorMessage);
        }
    };

    const handleEmailVerification = async (e) => {
        e.preventDefault();
        clearAllErrors();
        setGeneralError('');
        setBranchFoundMessage(''); // Limpiar mensaje previo

        // Validación inicial del email
        if (!values.mail || values.mail.trim() === '') {
            setFieldError('mail', 'El email es requerido');
            return;
        }

        const emailError = validateField('mail', values.mail, ['required', 'email']);
        if (emailError) {
            setFieldError('mail', emailError);
            return;
        }

        setIsVerifyingBranch(true);

        try {
            const result = await validateBranchEmail(values.mail);

            if (!result.success) {
                setGeneralError(result.error || 'Error validando email de sucursal');
                return;
            }

            const { isValid, branchInfo } = result;

            if (isValid && branchInfo) {
                // ESCENARIO 1: Sucursal encontrada y necesita completar registro
                if (branchInfo.needsRegistration === true && branchInfo.hasPassword === false) {
                    console.log(`✅ Sucursal "${branchInfo.branch_name}" encontrada - Requiere registro completo`);

                    // ✅ USAR setBranchFoundMessage
                    setBranchFoundMessage(`Sucursal "${branchInfo.branch_name}" encontrada. Completa el registro para continuar.`);

                    setBranchRegistrationEmail(values.mail);
                    setShowBranchRegistration(true);
                    setShowEmailVerification(false);
                    setGeneralError('');

                    return;
                }

                // ESCENARIO 2: Sucursal ya registrada y tiene contraseña
                else if (branchInfo.needsRegistration === false && branchInfo.hasPassword === true) {
                    console.log(`✅ Sucursal "${branchInfo.branch_name}" ya registrada - Solicitando contraseña`);

                    // ✅ USAR setBranchFoundMessage para este escenario también
                    setBranchFoundMessage(`Sucursal "${branchInfo.branch_name}" encontrada. Ingresa tu contraseña.`);

                    setShowPasswordField(true);
                    setShowEmailVerification(false);
                    setGeneralError('');

                    return;
                }

                // ESCENARIO 3: Estado inconsistente
                else {
                    console.error('Estado inconsistente de sucursal:', branchInfo);
                    setGeneralError(`Estado inconsistente de la sucursal "${branchInfo.branch_name}". Contacta soporte técnico.`);
                    return;
                }
            }

            else {
                setGeneralError('No se encontró una sucursal registrada con este email. Verifica el correo ingresado o contacta al administrador.');
                return;
            }

        } catch (error) {
            console.error('Error en verificación de email de sucursal:', error);

            const apiErrorMessage = extractApiErrorMessage(error);
            setGeneralError(apiErrorMessage);
        } finally {
            setIsVerifyingBranch(false);
        }
    };

    // Función de login principal
    const handleSubmit = async (e) => {
        e.preventDefault();
        clearAllErrors();
        setGeneralError('');
        if (clearError) clearError();

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
            if (authType === AUTH_TYPES.BRANCH) {
                setIsVerifyingBranch(true);

                try {
                    const registrationStatus = await checkBranchRegistration(values.mail);

                    if (registrationStatus.needsRegistration && !registrationStatus.hasPassword) {
                        console.log('BRANCH: Sucursal necesita completar registro');
                        setBranchRegistrationEmail(values.mail);
                        setShowBranchRegistration(true);
                        setIsVerifyingBranch(false);
                        setLoading(false);
                        return;
                    }

                    if (!registrationStatus.needsRegistration && registrationStatus.hasPassword) {
                        console.log('BRANCH: Sucursal con credenciales, procediendo con login directo');
                    }
                } catch (branchError) {
                    const apiErrorMessage = extractApiErrorMessage(branchError);
                    setGeneralError(apiErrorMessage);
                    setIsVerifyingBranch(false);
                    setLoading(false);
                    return;
                } finally {
                    setIsVerifyingBranch(false);
                }
            }

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

            console.log(`Intentando login como ${authType}:`, { email: credentials.mail });
            const result = await login(credentials, authType);

            if (result.success) {
                setGeneralError('');
                console.log(`Login exitoso como ${authType}`);
            } else {
                setGeneralError(result.error || 'Error en el login');
            }
        } catch (error) {
            console.error('Error en handleSubmit:', error);

            const apiErrorMessage = extractApiErrorMessage(error);
            setGeneralError(apiErrorMessage);
        } finally {
            setLoading(false);
            setIsVerifyingBranch(false);
        }
    };
    const extractApiErrorMessage = (error) => {
        // Prioridad 1: Mensaje específico de la API
        if (error.response?.data?.message) {
            return error.response.data.message;
        }

        // Prioridad 2: Mensaje del error de axios
        if (error.message) {
            return error.message;
        }

        // Prioridad 3: Mensaje genérico
        return 'Error desconocido en el servidor';
    };

    const handleCancelRegistration = () => {
        setShowBranchRegistration(false);
        setBranchRegistrationEmail('');
        setGeneralError('');
        setIsVerifyingBranch(false);
        if (clearError) clearError();

        // Volver al estado de verificación de email
        setShowEmailVerification(true);
        setShowPasswordField(false);

        console.log('Registro de sucursal cancelado - Volviendo a verificación de email');
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

            const response = await requestPasswordReset(resetEmail, recaptchaToken);
            setResetMessage(response.message || "Revisa tu correo para continuar.");
        } catch (error) {
            setGeneralError("No se pudo procesar la solicitud.");
        } finally {
            setLoading(false);
        }
    };

    const isCurrentlyLoading = loading || authLoading || recaptchaLoading || isVerifyingBranch || isBranchVerifying;


    return (
        <div className="min-h-screen flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: '#687e8d' }}>
            <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
                <div className="flex flex-col lg:flex-row min-h-[500px]">
                    <div className="lg:w-1/2 h-48 lg:min-h-[500px] relative">
                        <img
                            src={img}
                            alt="Artesa Panadería"
                            className="w-full h-full object-cover"
                        />

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
                                    disabled={isCurrentlyLoading}
                                >
                                    Registrarse
                                </button>
                                <span className="text-white/75">© 2025 Artesa</span>
                            </div>
                        </div>
                    </div>

                <div className="lg:w-1/2 p-4 sm:p-6 lg:p-8 bg-white flex items-start lg:items-center overflow-y-auto">
                        <div className="w-full max-w-sm mx-auto">
                            <div className="text-center mb-6">
                                <img
                                    src={logo}
                                    alt="Logo Artesa"
                                    className="h-16 mx-auto mb-4"
                                />
                                <h1 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
                                    {showBranchRegistration ? "Registro de Sucursal" :
                                        forgotPassword ? "Recuperar contraseña" : "¡Bienvenido!"}
                                </h1>
                                {!forgotPassword && !showBranchRegistration && (
                                    <p className="text-gray-600 text-xs sm:text-sm">Selecciona el tipo de acceso</p>
                                )}
                            </div>

                            {!showBranchRegistration && (
                                <div className="lg:hidden text-center mb-4">
                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                        <span className="text-xs text-gray-600">¿No tienes cuenta?</span>
                                        <button
                                            onClick={() => navigate("/register")}
                                            className="px-3 py-1.5 rounded-md text-xs font-medium text-white transition-all duration-300"
                                            style={{ backgroundColor: '#478090' }}
                                            disabled={isCurrentlyLoading}
                                        >
                                            Registrarse
                                        </button>
                                    </div>
                                </div>
                            )}

                            {showBranchRegistration ? (
                                <div className="space-y-3 max-w-sm mx-auto">
                                    {branchFoundMessage && (
                                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                    <span className="text-white text-xs">✓</span>
                                                </div>
                                                <span>{branchFoundMessage}</span>
                                            </div>
                                        </div>
                                    )}
                                    <BranchRegistrationForm
                                        branchEmail={branchRegistrationEmail}
                                        onRegister={handleBranchRegistration}
                                        onCancel={handleCancelRegistration}
                                        loading={isCurrentlyLoading}
                                        error={generalError}
                                    />
                                </div>
                            ) : forgotPassword ? (
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
                                            disabled={isCurrentlyLoading}
                                        >
                                            ¿Recordaste tu contraseña? Inicia sesión aquí
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={authType === AUTH_TYPES.BRANCH && showEmailVerification ? handleEmailVerification : handleSubmit} className="space-y-4" noValidate>
                                    <AuthTypeSelector
                                        selectedType={authType}
                                        onTypeChange={handleAuthTypeChange}
                                        disabled={isCurrentlyLoading}
                                        loading={isVerifyingBranch}
                                    />

                                    {isVerifyingBranch && authType === AUTH_TYPES.BRANCH && (
                                        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-xs flex items-center space-x-2">
                                            <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                                            <span>Verificando estado de la sucursal...</span>
                                        </div>
                                    )}

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
                                                <MdEmail className={`h-4 w-4 ${errors.mail ? 'text-red-500' :
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
                                                className={`block w-full pl-9 pr-9 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm ${errors.mail
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

                                            {authType === AUTH_TYPES.BRANCH && showEmailVerification ? (
                                                <button
                                                    type="submit"
                                                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                                    style={{ backgroundColor: '#478090' }}
                                                    disabled={isCurrentlyLoading}
                                                >
                                                    <span>{isVerifyingBranch ? "Verificando email..." : "Verificar Email"}</span>
                                                    {!isCurrentlyLoading && <TiArrowRightOutline className="h-4 w-4" />}
                                                    {isCurrentlyLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                                </button>
                                            ) : showPasswordField ? (
                                                <>
                                                    {/* ✅ AGREGAR MENSAJE DE CONFIRMACIÓN PARA PASSWORD FIELD */}
                                                    {branchFoundMessage && (
                                                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                                    <span className="text-white text-xs">✓</span>
                                                                </div>
                                                                <span>{branchFoundMessage}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                                                            Contraseña
                                                        </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <BsFillShieldLockFill className={`h-4 w-4 ${errors.password ? 'text-red-500' :
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
                                                        className={`block w-full pl-9 pr-9 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm ${errors.password
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
                                                    {isVerifyingBranch ? "Verificando sucursal..." :
                                                        isCurrentlyLoading ? "Iniciando sesión..." :
                                                            authType === AUTH_TYPES.BRANCH ? "Acceder como Sucursal" : "Iniciar sesión"}
                                                </span>
                                                {!isCurrentlyLoading && <TiArrowRightOutline className="h-4 w-4" />}
                                                {isCurrentlyLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                            </button>
                                        </>
                                    ) : null}

                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setForgotPassword(true)}
                                            className="text-xs font-medium hover:underline"
                                            style={{ color: '#478090' }}
                                            disabled={isCurrentlyLoading}
                                        >
                                            ¿Olvidaste tu contraseña? Haz Clic Aquí
                                        </button>
                                    </div>
                                </form>
                            )}

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