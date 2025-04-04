// Necesitamos integrar el reCAPTCHA en el componente Register.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3"; // Añadir esta importación
import './Register.css'
import '../../App.scss'
import { Link, NavLink } from 'react-router-dom'

// Importar configuración de la API
import API from "../../api/config";

//Import Assets
import img from "../../LoginsAssets/principal_img.gif";
import logo from '../../LoginsAssets/logo_artesa_alt.png'

//Import Icons
import { FaUserShield } from "react-icons/fa";
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { MdMarkEmailRead } from "react-icons/md";
import { RiMicAiLine } from "react-icons/ri";

const Register = () => {
    const navigate = useNavigate();
    const { executeRecaptcha } = useGoogleReCaptcha(); // Hook para ejecutar reCAPTCHA
    const [formData, setFormData] = useState({
        name: '',
        mail: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rateLimit, setRateLimit] = useState({
        isLimited: false,
        countdown: 0
    });

    // Manejar countdown para rate limiting
    useEffect(() => {
        let timer;
        if (rateLimit.isLimited && rateLimit.countdown > 0) {
            timer = setTimeout(() => {
                setRateLimit(prev => ({
                    ...prev,
                    countdown: prev.countdown - 1
                }));
            }, 1000);
        } else if (rateLimit.isLimited && rateLimit.countdown <= 0) {
            setRateLimit({
                isLimited: false,
                countdown: 0
            });
        }
        return () => clearTimeout(timer);
    }, [rateLimit]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (rateLimit.isLimited) {
            return;
        }
        
        setLoading(true);
        setError('');
        
        try {
            // Obtener el token de reCAPTCHA
            let recaptchaToken = "";
            if (executeRecaptcha) {
                recaptchaToken = await executeRecaptcha('register');
            } else {
                throw new Error("reCAPTCHA no está listo");
            }
            
            // Incluir el token en la solicitud
            const response = await API.post('/auth/register', {
                ...formData,
                recaptchaToken
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            // Redirigir a la página de éxito con el correo electrónico
            navigate('/registration-success', { state: { email: formData.mail } });
            
        } catch (error) {
            console.error("Error en registro:", error);
            
            // Manejar error de rate limiting (429)
            if (error.response && error.response.status === 429) {
                const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
                setRateLimit({
                    isLimited: true,
                    countdown: retryAfter
                });
                setError(`Demasiados intentos. Por favor espera ${retryAfter} segundos antes de intentar nuevamente.`);
            } else if (error.response && error.response.data.recaptchaFailed) {
                setError("Verificación de seguridad fallida. Por favor, recarga la página e intenta nuevamente.");
            } else {
                setError(error.response?.data?.message || 'Error en el registro');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="RegisterPage flex">
        <div className="container flex">
            <div className="imgDiv">

                <img src={img} alt="registerImg" />
                <div className="textDiv">
                    <h2 className="title"></h2>
                    <p></p>
                </div>
                <div className="footerDiv flex">
                    <span className="text">Ya tiene una cuenta?</span>
                    <Link to={'/login'}>
                    <button className="btn">Iniciar sesión</button>
                    </Link>
                    <span className="text">© 2025 Artesa</span>
                </div>
            </div>
            <div className="formDiv flex">
                <div className="headerDiv">
                <img src={logo} alt="Logo Artesa" />
                <h3>Registrate</h3>

                </div>
                <form action="" onSubmit={handleSubmit} className="form grid">
                {error && <p className="error-message">{error}</p>}
                {rateLimit.isLimited && (
                    <p className="error-message">
                        Por favor espera {rateLimit.countdown} segundos para intentar nuevamente.
                    </p>
                )}

                <div className="inputDiv">
                        <label htmlFor="name">Nombre</label>
                        <div className="input flex">
                            <FaUserShield className="icon"/>
                            <input type="text" id="name" placeholder="Escriba su Nombre:" value={formData.name} onChange={handleChange} required/>
                        </div>
                    </div>

                    <div className="inputDiv">
                        <label htmlFor="mail">Email</label>
                        <div className="input flex">
                            <MdMarkEmailRead className="icon"/>
                            <input type="email" id="mail" placeholder="Escriba su Email:"value={formData.mail} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="password">Contraseña</label>
                        <div className="input flex">
                            <BsFillShieldLockFill className="icon"/>
                            <input 
                            type="password" 
                            id="password" 
                            placeholder="Escriba su contraseña:" 
                            value={formData.password} 
                            onChange={handleChange} 
                            required/>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn flex" 
                        disabled={loading || rateLimit.isLimited}
                    >
                        <span>
                            {loading ? 'Registrando...' : 
                             rateLimit.isLimited ? `Espera ${rateLimit.countdown}s` : 
                             'Registrarse'}
                        </span>
                        <TiArrowRightOutline className="icon" />
                    </button>

                    <span className="forgotPassword">
                    <a href="#" onClick={() => navigate("/Login#", { state: { forgotPassword: true } })}>
                    Recuperar aquí
                </a>
                    </span>

                </form>
            </div>


        </div>
        </div>
    )
}
    
export default Register