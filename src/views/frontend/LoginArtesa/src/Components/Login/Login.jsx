import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth"; 
import API from "../../api/config";
import { useRecaptcha } from "../../hooks/useRecaptcha"; // Importamos el hook de reCAPTCHA

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
    const [formData, setFormData] = useState({
        mail: '', 
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetMessage, setResetMessage] = useState("");

    const handleChange = (e) => {
        setFormData({ 
            ...formData, 
            [e.target.id]: e.target.value 
        });
    };

    const handleResetChange = (e) => {
        setResetEmail(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Generar token de reCAPTCHA
            console.log("Generando token reCAPTCHA para login");
            const recaptchaToken = await generateRecaptchaToken('login');
            
            if (!recaptchaToken) {
                setError(recaptchaError || 'No se pudo completar la verificación de seguridad. Por favor, recargue la página e intente nuevamente.');
                console.error("No se pudo obtener token reCAPTCHA");
                setLoading(false);
                return;
            }

            console.log("Enviando datos de login con token reCAPTCHA");
            
            const response = await login({
                mail: formData.mail,
                password: formData.password,
                recaptchaToken: recaptchaToken
            });
            
            // Verificar si el usuario necesita verificar su correo
            if (response && response.needsVerification) {
                setError('Por favor verifica tu correo electrónico para acceder.');
                return;
            }
            
            // Redireccionar al dashboard
            navigate('/dashboard');
        } catch (error) {
            console.error("Error en login:", error);
            
            // Verificar si es un error de verificación de correo
            if (error.response?.data?.needsVerification) {
                setError(
                    'Es necesario verificar tu correo electrónico antes de acceder. ' +
                    'Por favor revisa tu bandeja de entrada o solicita un nuevo correo de verificación.'
                );
                return;
            }
            
            if (error.code === 'ERR_NETWORK') {
                setError(`Error de conexión: No se puede conectar con el servidor. URL: ${API.defaults.baseURL}`);
            } else {
                setError(
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
        setError("");
        setLoading(true);

        try {
            // Generar token de reCAPTCHA para recuperación de contraseña
            const recaptchaToken = await generateRecaptchaToken('password_reset');
            
            if (!recaptchaToken) {
                setError(recaptchaError || 'Error en la verificación de seguridad. Por favor, intenta nuevamente.');
                setLoading(false);
                return;
            }
            
            const response = await requestPasswordReset(resetEmail, recaptchaToken);
            setResetMessage(response.message || "Revisa tu correo para continuar con la recuperación.");
        } catch (error) {
            setError(error.response?.data?.message || "No se pudo procesar la solicitud.");
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
                            {resetMessage && <p className="success-message">{resetMessage}</p>}
                            {error && <p className="error-message">{error}</p>}

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
                                    />
                                </div>
                            </div>
                            {/* Botón de Enviar */}
                            <button type="submit" className="btn flex" disabled={loading || recaptchaLoading}>
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
                        <form onSubmit={handleSubmit} className="form grid">
                            {error && <p className="error-message">{error}</p>}
                            
                            {error && error.includes('verificar tu correo') && (
                                <p className="forgotPassword">
                                    <Link to="/resend-verification">
                                        Reenviar correo de verificación
                                    </Link>
                                </p>
                            )}

                            {/* Input Correo */}
                            <div className="inputDiv">
                                <label htmlFor="mail">Correo Electrónico</label>
                                <div className="input flex">
                                    <MdEmail className="icon" />
                                    <input
                                        type="email"
                                        id="mail"
                                        placeholder="Escriba su correo electrónico"
                                        value={formData.mail}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            
                            {/* Input Contraseña */}
                            <div className="inputDiv">
                                <label htmlFor="password">Contraseña</label>
                                <div className="input flex">
                                    <BsFillShieldLockFill className="icon" />
                                    <input
                                        type="password"
                                        id="password"
                                        placeholder="Escriba su contraseña"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            
                            {/* Botón de Login */}
                            <button type="submit" className="btn flex" disabled={loading || recaptchaLoading}>
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