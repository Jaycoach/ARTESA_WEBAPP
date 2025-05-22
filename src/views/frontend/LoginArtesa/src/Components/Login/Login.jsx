import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth"; 
import API from "../../api/config";
import { useRecaptcha } from "../../hooks/useRecaptcha";
import { useFormValidation } from "../../hooks/useFormValidation";
import { useError } from "../../context/ErrorContext";
import FormErrorMessage from "../ui/FormErrorMessage";

// Import Assets
import img from "../../LoginsAssets/principal_img.gif";
import logo from "../../LoginsAssets/logo_artesa_alt.png";

// Import Icons
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { MdEmail } from "react-icons/md";

const Login = () => {
    const navigate = useNavigate();
    const { login, requestPasswordReset } = useAuth();
    const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError } = useRecaptcha();
    const [forgotPassword, setForgotPassword] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    
    // Usar hooks de validación
    const { values, setValues, validateField } = useFormValidation({
        mail: '', 
        password: ''
    });
    const { errors, setFieldError, clearFieldError, clearAllErrors } = useError();
    
    const [generalError, setGeneralError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetMessage, setResetMessage] = useState("");

    // Actualizar para usar el nuevo sistema de validación
    const handleChange = (e) => {
        const { id, value } = e.target;
        setValues({ ...values, [id]: value });
        
        // Limpiar error al empezar a escribir
        if (errors[id]) {
            clearFieldError(id);
        }
    };

    // Validar al perder el foco
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

    // Evitar mensajes nativos del navegador
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
        
        // Validar todos los campos antes de enviar
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
            // Generar token de reCAPTCHA
            console.log("Generando token reCAPTCHA para login");
            const recaptchaToken = await generateRecaptchaToken('login');
            
            if (!recaptchaToken) {
                setGeneralError(recaptchaError || 'No se pudo completar la verificación de seguridad');
                setLoading(false);
                return;
            }

            const response = await login({
                mail: values.mail,
                password: values.password,
                recaptchaToken: recaptchaToken
            });
            
            // Verificar si el usuario necesita verificar su correo
            if (response && response.needsVerification) {
                setGeneralError('Por favor verifica tu correo electrónico para acceder.');
                return;
            }
            
            // Redireccionar al dashboard
            navigate('/dashboard');
        } catch (error) {
            console.error("Error en login:", error);
            
            // Verificar si es un error de verificación de correo
            if (error.response?.data?.needsVerification) {
                setGeneralError(
                    'Es necesario verificar tu correo electrónico antes de acceder. ' +
                    'Por favor revisa tu bandeja de entrada o solicita un nuevo correo de verificación.'
                );
                return;
            }
            
            if (error.code === 'ERR_NETWORK') {
                setGeneralError(`Error de conexión: No se puede conectar con el servidor. URL: ${API.defaults.baseURL}`);
            } else {
                setGeneralError(
                    error.response?.data?.message || 
                    error.response?.data?.error || 
                    `Error en el inicio de sesión: ${error.message}`
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // Manejar solicitud de recuperación de contraseña
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetMessage("");
        setGeneralError("");
        
        // Validar email
        if (!resetEmail.trim()) {
            setGeneralError("Por favor, ingrese su correo electrónico");
            return;
        }
        
        if (!/\S+@\S+\.\S+/.test(resetEmail)) {
            setGeneralError("Por favor, ingrese un correo electrónico válido");
            return;
        }
        
        setLoading(true);

        try {
            // Generar token de reCAPTCHA para recuperación de contraseña
            const recaptchaToken = await generateRecaptchaToken('password_reset');
            
            if (!recaptchaToken) {
                setGeneralError(recaptchaError || 'Error en la verificación de seguridad. Por favor, intenta nuevamente.');
                setLoading(false);
                return;
            }
            
            const response = await requestPasswordReset(resetEmail, recaptchaToken);
            setResetMessage(response.message || "Revisa tu correo para continuar con la recuperación.");
        } catch (error) {
            setGeneralError(error.response?.data?.message || "No se pudo procesar la solicitud.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="LoginPage flex">
            <div className="container flex">
                {/* Imagen Lateral */}
                <div className="imgDiv">
                    <img src={img} alt="LoginImg" />
                    <div className="textDiv">
                        <h2 className="title"></h2>
                        <p></p>
                    </div>
                    <div className="footerDiv flex">
                        <span className="text">¿No tiene una cuenta?</span>
                        <button className="btn" onClick={() => navigate("/register")}>
                            Registrarse
                        </button>
                        <span className="text">© 2025 Artesa</span>
                    </div>
                </div>

                {/* Formulario */}
                <div className="formDiv flex">
                    <div className="headerDiv">
                        <img src={logo} alt="Logo Artesa" />
                        <h3>{forgotPassword ? "Recuperar Contraseña" : "Bienvenido de vuelta!"}</h3>
                    </div>

                    {forgotPassword ? (
                        // Formulario de Forgot Password
                        <form onSubmit={handleResetPassword} className="form grid">
                            {resetMessage && (
                                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-4 text-sm">
                                    {resetMessage}
                                </div>
                            )}
                            
                            {generalError && (
                                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4 text-sm">
                                    {generalError}
                                </div>
                            )}

                            {/* Input de correo para recuperación */}
                            <div className="inputDiv">
                                <label htmlFor="resetEmail">Correo Electrónico</label>
                                <div className="input flex">
                                    <MdEmail className="icon" />
                                    <input
                                        type="email"
                                        id="resetEmail"
                                        placeholder="Ingrese su correo registrado"
                                        value={resetEmail}
                                        onChange={handleResetChange}
                                        required
                                        className="w-full outline-none bg-transparent"
                                    />
                                </div>
                            </div>
                            
                            {/* Botón de Enviar */}
                            <button 
                                type="submit" 
                                className={`btn flex ${loading || recaptchaLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
                                disabled={loading || recaptchaLoading}
                            >
                                <span>{loading ? "Enviando..." : "Enviar enlace"}</span>
                                <TiArrowRightOutline className="icon" />
                            </button>
                            
                            {/* Enlace para volver al login */}
                            <span className="forgotPassword">
                                ¿Recordaste tu contraseña?{" "}
                                <a href="#" onClick={() => setForgotPassword(false)}>
                                    Inicia sesión aquí
                                </a>
                            </span>
                        </form>
                    ) : (
                        // Formulario de Login
                        <form onSubmit={handleSubmit} className="form grid" noValidate>
                            {generalError && (
                                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4 text-sm">
                                    {generalError}
                                </div>
                            )}
                            
                            {generalError && generalError.includes('verificar tu correo') && (
                                <p className="forgotPassword">
                                    <Link to="/resend-verification">
                                        Reenviar correo de verificación
                                    </Link>
                                </p>
                            )}

                            {/* Input Correo */}
                            <div className="inputDiv">
                                <label htmlFor="mail">Correo Electrónico</label>
                                <div className={`input flex ${errors.mail ? 'border-red-500' : values.mail && !errors.mail ? 'border-green-500' : ''}`}>
                                    <MdEmail className={`icon ${errors.mail ? 'text-red-500' : values.mail && !errors.mail ? 'text-green-500' : ''}`} />
                                    <input
                                        type="email"
                                        id="mail"
                                        placeholder="Escriba su correo electrónico"
                                        value={values.mail}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        onInvalid={handleInvalid}
                                        required
                                        className="w-full outline-none bg-transparent"
                                    />
                                    {values.mail && !errors.mail && (
                                        <span className="text-green-500 ml-2">✓</span>
                                    )}
                                </div>
                                {errors.mail && <FormErrorMessage message={errors.mail} />}
                            </div>
                            
                            {/* Input Contraseña */}
                            <div className="inputDiv">
                                <label htmlFor="password">Contraseña</label>
                                <div className={`input flex ${errors.password ? 'border-red-500' : values.password && !errors.password ? 'border-green-500' : ''}`}>
                                    <BsFillShieldLockFill className={`icon ${errors.password ? 'text-red-500' : values.password && !errors.password ? 'text-green-500' : ''}`} />
                                    <input
                                        type="password"
                                        id="password"
                                        placeholder="Escriba su contraseña"
                                        value={values.password}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        onInvalid={handleInvalid}
                                        required
                                        className="w-full outline-none bg-transparent"
                                    />
                                    {values.password && !errors.password && (
                                        <span className="text-green-500 ml-2">✓</span>
                                    )}
                                </div>
                                {errors.password && <FormErrorMessage message={errors.password} />}
                            </div>
                            
                            {/* Botón de Login */}
                            <button 
                                type="submit" 
                                className={`btn flex ${loading || recaptchaLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`} 
                                disabled={loading || recaptchaLoading}
                            >
                                <span>{loading ? "Iniciando sesión..." : "Iniciar sesión"}</span>
                                <TiArrowRightOutline className="icon" />
                            </button>
                            
                            {/* Enlace a "Olvidaste tu contraseña?" */}
                            <span className="forgotPassword">
                                ¿Olvidaste tu contraseña?{" "}
                                <a href="#" onClick={() => setForgotPassword(true)}>Haz Clic Aquí</a>
                            </span>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;