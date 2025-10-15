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
    const [acceptPrivacyPolicy, setAcceptPrivacyPolicy] = useState(false);
    const [acceptDataProtection, setAcceptDataProtection] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [showDataProtectionModal, setShowDataProtectionModal] = useState(false);

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

        // Validar aceptación de políticas
        if (!acceptPrivacyPolicy) {
            setGeneralError('Debes aceptar la Política de Privacidad para continuar');
            return;
        }

        if (!acceptDataProtection) {
            setGeneralError('Debes aceptar la Política de Protección de Datos para continuar');
            return;
        }


        setLoading(true);
        setGeneralError('');

        try {
            // CRÍTICO: Generar token justo antes del envío para evitar expiración
            console.log('[REGISTER] Generando token reCAPTCHA justo antes del envío...');
            const recaptchaToken = await generateRecaptchaToken('register');
            console.log('[REGISTER] Token reCAPTCHA obtenido:', recaptchaToken ? 'OK' : 'FAILED');

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
                        {/* Checkboxes de Políticas - Versión Compacta */}
                        <div className="space-y-2 my-3">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="acceptPrivacyPolicy"
                                    checked={acceptPrivacyPolicy}
                                    onChange={(e) => setAcceptPrivacyPolicy(e.target.checked)}
                                    className="h-4 w-4 border-gray-300 rounded focus:ring-2 focus:ring-offset-0"
                                    style={{ 
                                        accentColor: '#f6754e',
                                        flexShrink: 0
                                    }}
                                />
                                <label 
                                    htmlFor="acceptPrivacyPolicy" 
                                    className="ml-2 text-xs"
                                    style={{ color: '#374151', lineHeight: '1.3' }}
                                >
                                    Acepto la{' '}
                                    <button
                                        type="button"
                                        onClick={() => setShowPrivacyModal(true)}
                                        className="underline font-medium"
                                        style={{ color: '#f6754e' }}
                                    >
                                        Política de Privacidad
                                    </button>
                                </label>
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="acceptDataProtection"
                                    checked={acceptDataProtection}
                                    onChange={(e) => setAcceptDataProtection(e.target.checked)}
                                    className="h-4 w-4 border-gray-300 rounded focus:ring-2 focus:ring-offset-0"
                                    style={{ 
                                        accentColor: '#f6754e',
                                        flexShrink: 0
                                    }}
                                />
                                <label 
                                    htmlFor="acceptDataProtection" 
                                    className="ml-2 text-xs"
                                    style={{ color: '#374151', lineHeight: '1.3' }}
                                >
                                    Acepto la{' '}
                                    <button
                                        type="button"
                                        onClick={() => setShowDataProtectionModal(true)}
                                        className="underline font-medium"
                                        style={{ color: '#f6754e' }}
                                    >
                                        Política de Protección de Datos
                                    </button>
                                </label>
                            </div>
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
            {/* Modal de Política de Privacidad */}
            {showPrivacyModal && (
                <div 
                    className="fixed inset-0 flex items-center justify-center z-50 p-4"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                >
                    <div 
                        className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                        style={{ backgroundColor: '#ffffff' }}
                    >
                        <div 
                            className="p-6 border-b"
                            style={{ borderColor: '#e5e7eb' }}
                        >
                            <h2 
                                className="text-2xl font-bold"
                                style={{ color: '#1f2937' }}
                            >
                                Aviso de Privacidad
                            </h2>
                        </div>
                        <div 
                            className="p-6 overflow-y-auto flex-1"
                            style={{ 
                                color: '#374151',
                                fontSize: '0.875rem',
                                lineHeight: '1.5'
                            }}
                        >
                            <p className="mb-4">
                                La ARTESA SAS, es una sociedad legalmente constituida, identificada con NIT. 900.561.500-2, 
                                que, en virtud del desarrollo de su objeto social, que es el procesamiento de harina y la venta 
                                y comercialización de pan, le corresponde la obligación y la necesidad de dar cumplimiento a las 
                                disposiciones previstas en la Ley 1581 de 2012 el Decreto 1377 de 2013 y el Decreto 886 de 2014.
                            </p>
                            
                            <h3 
                                className="text-lg font-semibold mt-4 mb-2"
                                style={{ color: '#1f2937' }}
                            >
                                Finalidades del Tratamiento de Datos
                            </h3>
                            <ul className="list-disc pl-5 mb-4">
                                <li>Para el cumplimiento de las obligaciones legales que involucren datos personales de sus grupos de interés.</li>
                                <li>Para la gestión del talento humano y bienestar social de sus grupos de interés.</li>
                                <li>Para la gestión comercial y relacionamiento con sus grupos de interés.</li>
                                <li>Para comunicar a sus clientes, proveedores información comercial de interés sobre sus actividades comerciales, promociones y ofertas de manera directa o indirecta.</li>
                            </ul>

                            <h3 
                                className="text-lg font-semibold mt-4 mb-2"
                                style={{ color: '#1f2937' }}
                            >
                                Derechos del Titular
                            </h3>
                            <p className="mb-4">
                                Como titular de sus datos personales, usted tiene derecho a conocer, actualizar, rectificar y solicitar 
                                la supresión de su información personal. Para ejercer estos derechos, puede contactarnos a través de:
                            </p>
                            <ul className="list-disc pl-5 mb-4">
                                <li><strong>Correo:</strong> servicioalcliente@artesapanaderia.com</li>
                                <li><strong>Teléfono:</strong> +57 (1) 304 2481640</li>
                                <li><strong>Dirección:</strong> Cra 35 #17a-61, Bogotá D.C.</li>
                            </ul>

                            <p 
                                className="text-sm mt-4"
                                style={{ color: '#6b7280' }}
                            >
                                Para conocer la política completa de protección de datos, visite: www.artesapanaderia.com
                            </p>
                        </div>
                        <div 
                            className="p-6 border-t flex justify-end"
                            style={{ borderColor: '#e5e7eb' }}
                        >
                            <button
                                onClick={() => setShowPrivacyModal(false)}
                                className="px-6 py-2 rounded-md transition"
                                style={{ 
                                    backgroundColor: '#f6754e',
                                    color: '#ffffff'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#e56543'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#f6754e'}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Política de Protección de Datos */}
            {showDataProtectionModal && (
                <div 
                    className="fixed inset-0 flex items-center justify-center z-50 p-4"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                >
                    <div 
                        className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                        style={{ backgroundColor: '#ffffff' }}
                    >
                        <div 
                            className="p-6 border-b"
                            style={{ borderColor: '#e5e7eb' }}
                        >
                            <h2 
                                className="text-2xl font-bold"
                                style={{ color: '#1f2937' }}
                            >
                                Política de Protección de Datos Personales
                            </h2>
                        </div>
                        <div 
                            className="p-6 overflow-y-auto flex-1"
                            style={{ 
                                color: '#374151',
                                fontSize: '0.875rem',
                                lineHeight: '1.5'
                            }}
                        >
                            <h3 
                                className="text-lg font-semibold mb-2"
                                style={{ color: '#1f2937' }}
                            >
                                Legislación Aplicable
                            </h3>
                            <p className="mb-4">
                                Esta política se expide con fundamento en la Ley 1581 de 2012 y sus Decretos Reglamentarios 
                                1377 de 2013 y 886 de 2014, para garantizar el derecho constitucional que tienen todas las 
                                personas a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre 
                                ellas en bases de datos.
                            </p>

                            <h3 
                                className="text-lg font-semibold mt-4 mb-2"
                                style={{ color: '#1f2937' }}
                            >
                                Principios
                            </h3>
                            <ul className="list-disc pl-5 mb-4">
                                <li><strong>Legalidad:</strong> El tratamiento de datos es una actividad reglada que debe 
                                sujetarse a lo establecido en la ley.</li>
                                <li><strong>Finalidad:</strong> El tratamiento debe obedecer a una finalidad legítima 
                                informada al titular.</li>
                                <li><strong>Libertad:</strong> Solo puede llevarse a cabo con el consentimiento previo, 
                                expreso e informado del titular.</li>
                                <li><strong>Veracidad:</strong> La información debe ser veraz, completa, exacta y actualizada.</li>
                                <li><strong>Transparencia:</strong> Se garantiza el derecho del titular a obtener información 
                                sobre la existencia de datos que le conciernen.</li>
                                <li><strong>Seguridad:</strong> La información se protegerá mediante medidas técnicas, humanas 
                                y administrativas necesarias.</li>
                                <li><strong>Confidencialidad:</strong> Todas las personas que intervengan están obligadas a 
                                garantizar la reserva de la información.</li>
                            </ul>

                            <h3 
                                className="text-lg font-semibold mt-4 mb-2"
                                style={{ color: '#1f2937' }}
                            >
                                Sus Derechos
                            </h3>
                            <p className="mb-2">Como titular de datos personales, usted tiene derecho a:</p>
                            <ul className="list-disc pl-5 mb-4">
                                <li>Conocer, actualizar y rectificar sus datos personales</li>
                                <li>Solicitar prueba de la autorización otorgada</li>
                                <li>Ser informado sobre el uso que se ha dado a sus datos</li>
                                <li>Presentar quejas ante la Superintendencia de Industria y Comercio</li>
                                <li>Revocar la autorización y/o solicitar la supresión de sus datos</li>
                                <li>Acceder de forma gratuita a sus datos personales</li>
                            </ul>

                            <h3 
                                className="text-lg font-semibold mt-4 mb-2"
                                style={{ color: '#1f2937' }}
                            >
                                Contacto
                            </h3>
                            <p className="mb-2">Para ejercer sus derechos o realizar consultas:</p>
                            <ul className="list-disc pl-5 mb-4">
                                <li><strong>Correo:</strong> servicioalcliente@artesapanaderia.com</li>
                                <li><strong>Teléfono:</strong> +57 (1) 304 2481640</li>
                                <li><strong>Dirección:</strong> Cra 35 #17a-61, Bogotá D.C.</li>
                                <li><strong>Web:</strong> www.artesapanaderia.com</li>
                            </ul>

                            <p 
                                className="text-sm mt-4"
                                style={{ color: '#6b7280' }}
                            >
                                <strong>Vigencia:</strong> Esta política está vigente desde el 3 de octubre de 2024.
                            </p>
                        </div>
                        <div 
                            className="p-6 border-t flex justify-end"
                            style={{ borderColor: '#e5e7eb' }}
                        >
                            <button
                                onClick={() => setShowDataProtectionModal(false)}
                                className="px-6 py-2 rounded-md transition"
                                style={{ 
                                    backgroundColor: '#f6754e',
                                    color: '#ffffff'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#e56543'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#f6754e'}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>  
    );
};

export default Register;