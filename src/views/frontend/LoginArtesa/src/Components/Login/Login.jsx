// src/Components/Login/Login.jsx
import React, { useState } from "react"
import './Login.css'
import '../../App.css'
import { Link, useNavigate } from 'react-router-dom'
import API from '../../api/config'

// Import Assets
import img from "../../LoginsAssets/principal_img.gif";
import logo from "../../LoginsAssets/logo_artesa_alt.png";

// Import Icons
import { FaUserShield } from "react-icons/fa";
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { MdEmail } from "react-icons/md";

const Login = () => {
    const location = useNavigate();
    const [forgotPassword, setForgotPassword] = useState(location.state?.forgotPassword || false);
    const navigate = useNavigate();
    const [formData, setFormData] = useState({mail: '', password: ''});
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetMessage, setResetMessage] = useState("");

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleResetChange = (e) => {
      setResetEmail(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
          const response = await API.post('/api/auth/login', {
            mail: formData.mail,
            password: formData.password
        });
            
            // Guardar el token en localStorage
            localStorage.setItem('token', response.data.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.data.user));

            // Redireccionar al dashboard
            navigate('/dashboard');
        } catch (error) {
            setError(error.response?.data?.message || 'Error en el inicio de sesión');
        } finally {
            setLoading(false);
        }
    };
    // Manejar solicitud de recuperación de contraseña
    const handleResetPassword = async (e) => {
      e.preventDefault();
      setResetMessage("");
      setError("");

      try {
        const response = await API.post("/api/password/request-reset", { mail: resetEmail });
        setResetMessage(response.data.message || "Revisa tu correo para continuar con la recuperación.");
      } catch (error) {
        setError(error.response?.data?.message || "No se pudo procesar la solicitud.");
      }
    };
  return (
    <div className="LoginPage flex">
      <div className="container flex">
        {/* Imagen Lateral */}
        <div className="imgDiv">
          <img src={img} alt="LoginImg" />
          <div className="textDiv">
            <h2 className="title"> </h2>
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
                   id="mail"
                   placeholder="Ingrese su correo registrado"
                   value={resetEmail}
                   onChange={handleResetChange}
                   required
                   />
                   </div>
                   </div>
                   {/* Botón de Enviar */}
                   <button type="submit" className="btn flex">
                    <span>Enviar enlace</span>
                    <TiArrowRightOutline className="icon" />
                    </button>
                    
                    {/* Enlace para volver al login */}
                    <span className="forgotPassword"> ¿Recordaste tu contraseña?{" "}
                      <a href="#" onClick={() => setForgotPassword(false)}>
                        Inicia sesión aquí
                        </a>
                        </span>
                        </form>
                        ) : (
                          // Formulario de Login
                          <form onSubmit={handleSubmit} className="form grid">
                            {error && <p className="error-message">{error}</p>}
                            {/* Input Usuario */}
                            <div className="inputDiv">
                              <label htmlFor="email">Correo Electrónico</label>
                              <div className="input flex">
                                <MdEmail className="icon" />
                                <input
                                type="email"
                                id="mail"
                                placeholder="Escriba su correo electrónico:"
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
                                    placeholder="Escriba su contraseña:"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    />
                                    </div>
                                    </div>
                                    
                                    {/* Botón de Login */}
                                    <button type="submit" className="btn flex" disabled={loading}>
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