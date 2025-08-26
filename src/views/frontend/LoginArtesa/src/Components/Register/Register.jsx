import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from 'react-router-dom';
import { useRecaptcha } from "../../hooks/useRecaptcha";
import { useFormValidation } from "../../hooks/useFormValidation";
import { useError } from "../../context/ErrorContext";
import FormErrorMessage from "../ui/FormErrorMessage";

// Import Assets
import img from "../../LoginsAssets/principal_img.gif";
import logo from '../../LoginsAssets/logo_artesa_new.png';

// Import Icons
import { FaUserShield } from "react-icons/fa";
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { MdMarkEmailRead } from "react-icons/md";

// API config
import API from "../../api/config";

const Register = () => {
    const navigate = useNavigate();
    const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError } = useRecaptcha();
    const { values, setValues, validateField } = useFormValidation({
        name: '',
        mail: '',
        password: ''
    });
    const { errors, setFieldError, clearFieldError, clearAllErrors } = useError();
    const [loading, setLoading] = useState(false);
    const [generalError, setGeneralError] = useState('');
    const [formSubmitted, setFormSubmitted] = useState(false);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setValues({ ...values, [id]: value });
        
        // Limpiar error al empezar a escribir
        if (errors[id]) {
            clearFieldError(id);
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
        e.preventDefault(); // Evitar mensaje nativo del navegador
        const { id, value } = e.target;
        const rules = id === 'mail' ? ['required', 'email'] : ['required'];
        const error = validateField(id, value, rules);
        
        if (error) {
            setFieldError(id, error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearAllErrors();
        setFormSubmitted(true);
        
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
        setGeneralError('');

        try {
            const recaptchaToken = await generateRecaptchaToken('register');

            if (!recaptchaToken) {
                setGeneralError(recaptchaError || 'Verificación de seguridad fallida.');
                setLoading(false);
                return;
            }

            const registerData = {
                ...values,
                recaptchaToken
            };

            const response = await API.post('/auth/register', registerData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/registration-success', { state: { email: values.mail } });

        } catch (error) {
            console.error("Error en registro:", error);
            setGeneralError(error.response?.data?.message || 'Error en el registro');
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
                    <form onSubmit={handleSubmit} className="form grid" noValidate>
                        {generalError && (
                            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4 text-sm">
                                {generalError}
                            </div>
                        )}

                        <div className="inputDiv">
                            <label htmlFor="name">Nombre o Razón Social</label>
                            <div className={`input flex ${errors.name ? 'border-red-500' : values.name && !errors.name ? 'border-green-500' : ''}`}>
                                <FaUserShield className={`icon ${errors.name ? 'text-red-500' : values.name && !errors.name ? 'text-green-500' : ''}`} />
                                <input
                                    type="text"
                                    id="name"
                                    placeholder="Escriba su Nombre:"
                                    value={values.name}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    onInvalid={handleInvalid}
                                    required
                                    className="w-full outline-none bg-transparent"
                                />
                                {values.name && !errors.name && (
                                    <span className="text-green-500 ml-2">✓</span>
                                )}
                            </div>
                            {errors.name && <FormErrorMessage message={errors.name} />}
                        </div>

                        <div className="inputDiv">
                            <label htmlFor="mail">Email</label>
                            <div className={`input flex ${errors.mail ? 'border-red-500' : values.mail && !errors.mail ? 'border-green-500' : ''}`}>
                                <MdMarkEmailRead className={`icon ${errors.mail ? 'text-red-500' : values.mail && !errors.mail ? 'text-green-500' : ''}`} />
                                <input
                                    type="email"
                                    id="mail"
                                    placeholder="Escriba su Email:"
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

                        <div className="inputDiv">
                            <label htmlFor="password">Contraseña</label>
                            <div className={`input flex ${errors.password ? 'border-red-500' : values.password && !errors.password ? 'border-green-500' : ''}`}>
                                <BsFillShieldLockFill className={`icon ${errors.password ? 'text-red-500' : values.password && !errors.password ? 'text-green-500' : ''}`} />
                                <input
                                    type="password"
                                    id="password"
                                    placeholder="Escriba su contraseña:"
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

                        <button
                            type="submit"
                            className={`btn flex ${loading || recaptchaLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
                            disabled={loading || recaptchaLoading}
                        >
                            <span>{loading ? 'Registrando...' : 'Registrarse'}</span>
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
    );
};

export default Register;