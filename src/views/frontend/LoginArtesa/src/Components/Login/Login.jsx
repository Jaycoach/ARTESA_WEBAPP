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
import API from "../../api/config";
import BranchVerificationFlow from './BranchVerificationFlow';

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
    requestBranchPasswordReset,
    checkBranchRegistration,
    registerBranch,
    isBranchVerifying,
    validateBranchEmail,
    initiateBranchEmailVerification
} = useAuth();

    const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError } = useRecaptcha();

    // Estados locales
    const [authType, setAuthType] = useState(AUTH_TYPES.USER);
    const [forgotPassword, setForgotPassword] = useState(false);
    const [branchEmail, setBranchEmail] = useState('');
    const [branchPassword, setBranchPassword] = useState('');
    const [branchCheck, setBranchCheck] = useState({
        loading: false,
        needsEmailVerification: false,
        emailVerified: null,
        message: ''
    });

    const [showEmailVerificationBanner, setShowEmailVerificationBanner] = useState(false);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');

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
    // Nuevo estado para el flujo de verificación
    const [showVerificationFlow, setShowVerificationFlow] = useState(false);
    const [verificationFlowStep, setVerificationFlowStep] = useState('check');

    useEffect(() => {
        if (authType === AUTH_TYPES.BRANCH) {
            console.log('🔍 Estado actual Branch:', {
                showEmailVerification,
                showPasswordField,
                showBranchRegistration,
                branchFoundMessage: !!branchFoundMessage,
                email: values.mail
            });
        }
    }, [authType, showEmailVerification, showPasswordField, showBranchRegistration, branchFoundMessage, values.mail]);

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
            // Solo resetear a verificación de email si no estamos en medio de un flujo
            if (!showPasswordField && !showBranchRegistration) {
                setShowEmailVerification(true);
                setShowPasswordField(false);
            }
            setShowBranchRegistration(false);
        } else {
            setShowEmailVerification(false);
            setShowPasswordField(true);
            setShowBranchRegistration(false);
        }
    }, [authType]);

    useEffect(() => {
        // Mostrar mensaje de estado al regresar del reset de contraseña
        if (location.state?.message) {
            setGeneralError(''); // Limpiar errores
            setBranchFoundMessage(location.state.message); // Mostrar mensaje de éxito

            // Limpiar el mensaje después de 5 segundos
            setTimeout(() => {
                setBranchFoundMessage('');
            }, 5000);

            // Limpiar el state para evitar que se repita
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);
    useEffect(() => {
        if (location.state?.emailVerified && location.state?.authType === 'branch') {
            setAuthType(AUTH_TYPES.BRANCH);
            setValues(prev => ({ ...prev, mail: location.state.email || '' }));
            setShowEmailVerification(false);
            setShowBranchRegistration(true); // Mostrar directamente el registro
            setBranchRegistrationEmail(location.state.email || '');
            setBranchFoundMessage(location.state.message || 'Email verificado. Completa tu registro.');
            
            // Limpiar el state para evitar bucles
            navigate('/login', { replace: true });
        }
    }, [location.state, navigate]);

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
        setBranchFoundMessage('');
        if (clearError) clearError();
        clearAllErrors();
        setShowEmailVerificationBanner(false);
        setPendingVerificationEmail('');

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

            console.log('🔄 Registrando sucursal:', registrationData.email);
            const registrationResult = await registerBranch(registrationData, recaptchaToken);

            if (registrationResult && registrationResult.success !== false) {
                console.log('✅ Registro de sucursal completado exitosamente');
                setShowBranchRegistration(false);
                setBranchRegistrationEmail('');
                setGeneralError('');
                setBranchFoundMessage(
                    `¡Registro completado! Se ha enviado un correo de verificación a ${registrationData.email}. ` +
                    `Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta de sucursal.`
                );
                setShowEmailVerification(false);
                setShowPasswordField(false);
                setValues({ mail: '', password: '' }); // Limpiar campos
                setTimeout(() => {
                    setBranchFoundMessage('');
                    setShowEmailVerification(true);
                    console.log('🔄 Volviendo a verificación de email tras registro exitoso');
                }, 15000);

            } else {
                throw new Error(registrationResult?.error || 'Error en el registro de sucursal');
            }

        } catch (error) {
            console.error('❌ Error en registro de sucursal:', error);
            const apiErrorMessage = extractApiErrorMessage(error);
            setGeneralError(apiErrorMessage);

            // No limpiar el formulario si hay error para que el usuario pueda corregir
        }
    };

    const handleEmailVerification = async (e) => {
        e.preventDefault();
        clearAllErrors();
        setGeneralError('');
        setBranchFoundMessage('');

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
            const result = await checkBranchRegistration(values.mail);

            if (result) {
                const branchInfo = result.data || result;

                console.log('🔍 branchInfo procesado:', {
                    branch_name: branchInfo.branch_name,
                    email_verified: branchInfo.email_verified,
                    needsEmailVerification: branchInfo.needsEmailVerification
                });
                if (branchInfo.needsEmailVerification === true || branchInfo.email_verified === false) {
                    console.log(`⚠️ Sucursal "${branchInfo.branch_name}" necesita verificación de email`);

                    setShowEmailVerificationBanner(true);
                    setPendingVerificationEmail(values.mail);
                    setBranchFoundMessage(
                        `Sucursal "${branchInfo.branch_name}" encontrada, pero debes verificar tu correo electrónico antes de continuar.`
                    );
                    setGeneralError('');
                    setShowEmailVerification(true);
                    setShowPasswordField(false);
                    return;
                }
                if (branchInfo.needsRegistration === true && branchInfo.hasPassword === false) {
                    console.log(`✅ Sucursal "${branchInfo.branch_name}" encontrada - Requiere registro completo`);
                    setBranchFoundMessage(`Sucursal "${branchInfo.branch_name}" encontrada. Completa el registro para continuar.`);
                    setBranchRegistrationEmail(values.mail);
                    setShowBranchRegistration(true);
                    setShowEmailVerification(false);
                    setShowEmailVerificationBanner(false);
                    setGeneralError('');
                    return;
                }
                else if (branchInfo.needsRegistration === false && branchInfo.hasPassword === true && branchInfo.email_verified === true) {
                    console.log(`✅ Sucursal "${branchInfo.branch_name}" ya registrada - Solicitando contraseña`);
                    setBranchFoundMessage(`Sucursal "${branchInfo.branch_name}" encontrada. Ingresa tu contraseña para continuar.`);
                    setShowPasswordField(true);
                    setShowEmailVerification(false);
                    setShowEmailVerificationBanner(false);
                    setGeneralError('');
                    return;
                }
                else {
                    console.error('Estado inconsistente de sucursal:', branchInfo);
                    setGeneralError(`Estado inconsistente de la sucursal "${branchInfo.branch_name}". Contacta soporte técnico.`);
                    return;
                }
            } else {
                setGeneralError('No se encontró una sucursal registrada con este email. Verifica el correo ingresado o contacta al administrador.');
                return;
            }

        } catch (error) {
            console.error('Error en verificación de email de sucursal:', error);

            if (error.message && error.message.includes('No se encontró una sucursal')) {
                setGeneralError('Email de sucursal no registrado en el sistema. Verifica el correo o contacta al administrador.');
            } else if (error.code === 'ERR_NETWORK') {
                setGeneralError('Error de conexión. Verifica tu internet e intenta nuevamente.');
            } else {
                setGeneralError(error.message || 'Error verificando email de sucursal. Intenta nuevamente.');
            }
            setShowEmailVerificationBanner(false);
        } finally {
            setIsVerifyingBranch(false);
        }
    };

    const handleChangeEmail = () => {
        setShowEmailVerification(true);
        setShowPasswordField(false);
        setShowBranchRegistration(false);
        setBranchFoundMessage('');
        setGeneralError('');
        setValues(prev => ({ ...prev, password: '' }));
        clearAllErrors();
        console.log('🔄 Volviendo a verificación de email');
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
                    // Usar checkBranchRegistration para verificación final antes del login
                    const registrationResult = await checkBranchRegistration(values.mail);
                    const registrationStatus = registrationResult.data || registrationResult;

                    if (registrationStatus.needsRegistration && !registrationStatus.hasPassword) {
                        console.log('BRANCH: Sucursal necesita completar registro');
                        setBranchRegistrationEmail(values.mail);
                        setShowBranchRegistration(true);
                        setIsVerifyingBranch(false);
                        setLoading(false);
                        return;
                    }

                    if (!registrationStatus.needsRegistration && registrationStatus.hasPassword) {
                        console.log('BRANCH: Sucursal con credenciales completas, procediendo con login');

                        // Verificar si el login está habilitado
                        if (registrationStatus.is_login_enabled === false) {
                            setGeneralError(`La sucursal no tiene el acceso habilitado. Contacta al administrador.`);
                            setIsVerifyingBranch(false);
                            setLoading(false);
                            return;
                        }
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
            console.log('[LOGIN] Token reCAPTCHA obtenido:', recaptchaToken ? 'OK' : 'FAILED');
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
            console.error('🚨 Error en login:', {
                message: error.message,
                status: error.response?.status,
                authType
            });

            if (authType === AUTH_TYPES.BRANCH && error.response?.status === 403) {
                const errorMsg = error.response?.data?.message || error.message || '';

                if (errorMsg.toLowerCase().includes('verificar') ||
                    errorMsg.toLowerCase().includes('verify') ||
                    errorMsg.includes('email')) {

                    console.log('📧 Detectado error de verificación de email, mostrando banner');
                    setShowEmailVerificationBanner(true);
                    setPendingVerificationEmail(values.mail);
                    setGeneralError('Debes verificar tu correo electrónico antes de iniciar sesión.');

                    // handleSendEmailVerification();
                    return;
                }
            }

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

    // Nueva función para manejar el envío automático de verificación
    const handleSendEmailVerification = async () => {
        try {
            console.log('📧 Enviando correo de verificación automáticamente a:', values.mail);
            
            const recaptchaToken = await generateRecaptchaToken('branch_initiate_verification');
            if (!recaptchaToken) {
                setGeneralError('Error en verificación de seguridad');
                return;
            }
            
            const result = await initiateBranchEmailVerification(values.mail, recaptchaToken);
            
            if (result.success) {
                setBranchFoundMessage(
                    `✅ Se ha enviado un correo de verificación a ${values.mail}. ` +
                    `Revisa tu bandeja de entrada y haz clic en el enlace para verificar tu cuenta de sucursal.`
                );
                
                // Ocultar verificación de email y mostrar mensaje
                setShowEmailVerification(false);
                setShowPasswordField(false);
                
                console.log('✅ Correo de verificación enviado exitosamente');
            } else {
                throw new Error(result.error || 'Error enviando correo de verificación');
            }
            
        } catch (error) {
            console.error('❌ Error enviando correo de verificación:', error);
            setGeneralError('Error enviando correo de verificación. Inténtalo nuevamente.');
        }
    };

    // Manejar completación del flujo de verificación
    const handleVerificationFlowComplete = (nextStep, branchData) => {
        console.log('🔄 Flujo de verificación completado:', nextStep, branchData);
        
        setShowVerificationFlow(false);
        setBranchInfo(branchData);
        
        switch (nextStep) {
            case 'needs-password':
                // Sucursal verificada pero necesita contraseña
                setShowBranchRegistration(true);
                setBranchRegistrationEmail(values.mail);
                setBranchFoundMessage(
                    `Tu sucursal ${branchData.branch_name} está verificada pero necesita configurar una contraseña.`
                );
                break;
                
            case 'ready-login':
                // Todo listo para login normal
                setShowEmailVerification(false);
                setShowPasswordField(true);
                setBranchFoundMessage(
                    `¡Perfecto! Tu sucursal ${branchData.branch_name} está lista. Ingresa tu contraseña.`
                );
                break;
                
            default:
                console.warn('Paso desconocido en flujo de verificación:', nextStep);
                break;
        }
    };

    // Volver al flujo de verificación desde otros pasos
    const handleBackToVerificationFlow = () => {
        setShowEmailVerification(false);
        setShowPasswordField(false);
        setShowBranchRegistration(false);
        setShowVerificationFlow(true);
        setVerificationFlowStep('check');
        setGeneralError('');
        setBranchFoundMessage('');
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

    const determineAccountTypeAndReset = async (email, recaptchaToken) => {
        try {
            console.log('🔍 Verificando tipo de cuenta para:', email);

            const checkResponse = await API.post('/branch-auth/check-registration', { email });

            if (checkResponse.data?.success && checkResponse.data?.data) {
                const branchInfo = checkResponse.data.data;
                if (branchInfo.email_branch && branchInfo.email_branch.toLowerCase() === email.toLowerCase()) {
                    console.log('🏢 Email detectado como BRANCH:', branchInfo.branch_name);
                    const resetResponse = await API.post('/branch-password/request-reset', {
                        email,
                        recaptchaToken
                    });

                    return {
                        success: true,
                        data: resetResponse.data,
                        type: 'branch',
                        branchName: branchInfo.branch_name
                    };
                }
            }

            console.log('👤 Email detectado como USUARIO PRINCIPAL');
            const resetResponse = await API.post('/password/request-reset', {
                mail: email, // ← Nota: el endpoint de user usa 'mail'
                recaptchaToken
            });

            return {
                success: true,
                data: resetResponse.data,
                type: 'user'
            };

        } catch (error) {
            console.error('❌ Error en determineAccountTypeAndReset:', error);

            try {
                console.log('🔄 Fallback a endpoint de usuario principal');
                const fallbackResponse = await API.post('/password/request-reset', {
                    mail: email,
                    recaptchaToken
                });

                return {
                    success: true,
                    data: fallbackResponse.data,
                    type: 'user',
                    fallback: true
                };
            } catch (fallbackError) {
                return {
                    success: false,
                    error: fallbackError.response?.data?.message || fallbackError.message || 'Error enviando solicitud de reset'
                };
            }
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetMessage("");
        setGeneralError("");
        if (clearError) clearError();
        if (!resetEmail.trim() || !/\S+@\S+\.\S+/.test(resetEmail)) {
            setGeneralError("Por favor, ingrese un correo electrónico válido");
            return;
        }

        setLoading(true);

        try {
            const recaptchaToken = await generateRecaptchaToken('password_reset');
            if (!recaptchaToken) {
                setGeneralError('Error en verificación de seguridad. Por favor, intente nuevamente.');
                return;
            }
            const result = await determineAccountTypeAndReset(resetEmail, recaptchaToken);
            const GENERIC_SUCCESS_MESSAGE = "Si su correo electrónico está registrado en nuestro sistema, recibirá un enlace de recuperación en breve. Por favor, revise su bandeja de entrada y carpeta de spam.";

            setResetMessage(GENERIC_SUCCESS_MESSAGE);
            if (process.env.NODE_ENV === 'development') {
                console.log(`🔍 [DEV] Reset request processed:`, {
                    email: resetEmail,
                    success: result.success,
                    type: result.type || 'unknown',
                    timestamp: new Date().toISOString(),
                    // NO exponer información sensible incluso en desarrollo
                    hashedEmail: btoa(resetEmail).substring(0, 10) + '***'
                });
            }
            console.log(`📊 Password reset request processed for domain: ${resetEmail.split('@')[1]}`);

        } catch (error) {
            console.error('🚨 [Security] Password reset error:', {
                timestamp: new Date().toISOString(),
                domain: resetEmail.split('@')[1], // Solo el dominio, no el email completo
                error: error.message,
                // NO incluir stack trace en producción
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
            setGeneralError('Ocurrió un error procesando su solicitud. Por favor, intente nuevamente más tarde o contacte al soporte técnico.');
            // setResetMessage(GENERIC_SUCCESS_MESSAGE);

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
                                        {/* ✅ MENSAJE INFORMATIVO */}
                                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                                    <span className="text-white text-xs">i</span>
                                                </div>
                                                <span className="text-blue-700">
                                                    El sistema detectará automáticamente si tu email es de sucursal o cuenta principal.
                                                </span>
                                            </div>
                                        </div>

                                        {resetMessage && (
                                            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs">✓</span>
                                                    </div>
                                                    <span>{resetMessage}</span>
                                                </div>
                                            </div>
                                        )}

                                        {generalError && (
                                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs">!</span>
                                                    </div>
                                                    <span>{generalError}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Campo de email */}
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

                                        {/* ✅ BOTÓN CON INDICADOR MEJORADO */}
                                        <button
                                            type="submit"
                                            className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50"
                                            style={{ backgroundColor: '#478090' }}
                                            disabled={isCurrentlyLoading}
                                        >
                                            <span>
                                                {isCurrentlyLoading ? "Detectando tipo de cuenta..." : "Enviar enlace de recuperación"}
                                            </span>
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

                                    {showEmailVerificationBanner && authType === AUTH_TYPES.BRANCH && (
                                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-xs mb-4">
                                            <div className="flex items-start space-x-2">
                                                <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center mt-0.5">
                                                    <span className="text-white text-xs">!</span>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="mb-2">
                                                        Tu correo de sucursal no está verificado. Debes verificarlo para poder iniciar sesión.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={handleSendEmailVerification}
                                                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                                                        disabled={isCurrentlyLoading}
                                                    >
                                                        <MdEmail className="mr-1.5 h-3 w-3" />
                                                        Enviar correo de verificación
                                                    </button>
                                                </div>
                                            </div>
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
                                                    <span>{isVerifyingBranch ? "Verificando email..." : "Verificar Email de Sucursal"}</span>
                                                    {!isCurrentlyLoading && <TiArrowRightOutline className="h-4 w-4" />}
                                                    {isCurrentlyLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                                </button>
                                            ) : showPasswordField ? (
                                                <>
                                                    {/* ✅ MENSAJE MEJORADO para sucursales con credenciales */}
                                                    {branchFoundMessage && (
                                                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs mb-4">
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
                                                            Contraseña de la Sucursal
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

                                                        {authType === AUTH_TYPES.BRANCH && showPasswordField && (
                                                            <div className="text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleChangeEmail}
                                                                    className="text-xs font-medium hover:underline"
                                                                    style={{ color: '#478090' }}
                                                                    disabled={isCurrentlyLoading}
                                                                >
                                                                    ← Cambiar email de sucursal
                                                                </button>
                                                            </div>
                                                        )}

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