// src/Components/Login/Login.jsx
import React, { useState } from "react"
import './Login.css'
import '../../App.css'
import { Link, useNavigate } from 'react-router-dom'
import API from '../../api/config'

//Import Assets
import img from '../../LoginsAssets/principal_img.jpg'
import logo from '../../LoginsAssets/logo_artesa.png'

//Import Icons
import { FaUserShield } from "react-icons/fa"
import { BsFillShieldLockFill } from "react-icons/bs"
import { TiArrowRightOutline } from "react-icons/ti"
import { MdEmail } from "react-icons/md"

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        mail: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
    
        try {
            const response = await API.post('/auth/login', {
                mail: formData.email,
                password: formData.password
            });
            
            localStorage.setItem('token', response.data.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.data.user));
    
            navigate('/Dashboard');
        } catch (error) {
            const errorMessage = 
                error.response?.data?.message || 
                error.response?.data?.error || 
                'Error en el inicio de sesión';
            
            setError(errorMessage);
            console.error('Login error:', error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="LoginPage flex">
            <div className="container flex">
                <div className="imgDiv">
                    <img src={img} alt="LoginImg" />
                    <div className="textDiv">
                        <h2 className="title">Creado para ARTESA</h2>
                        <p>Login Page - Artesa</p>
                    </div>
                    <div className="footerDiv flex">
                        <span className="text">No tiene una cuenta?</span>
                        <Link to={'/Register'}>
                            <button className="btn">Registrarse</button>
                        </Link>
                        <span className="text">© 2025 Artesa</span>
                    </div>
                </div>

                <div className="formDiv flex">
                    <div className="headerDiv">
                        <img src={logo} alt="Logo Artesa" />
                        <h3>Bienvenido de vuelta!</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="form grid">
                    {error && (
                        <div className="showMessage" style={{
                            display: 'block', 
                            color: 'white', 
                            backgroundColor: 'red', 
                            padding: '10px', 
                            borderRadius: '5px',
                            marginBottom: '10px'
                        }}>
                            {error}
                        </div>
                    )}
                        
                        <div className="inputDiv">
                            <label htmlFor="email">Correo electrónico</label>
                            <div className="input flex">
                                <MdEmail className="icon"/>
                                <input 
                                    type="email" 
                                    id="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Escriba su correo electrónico"
                                    required
                                />
                            </div>
                        </div>

                        <div className="inputDiv">
                            <label htmlFor="password">Contraseña</label>
                            <div className="input flex">
                                <BsFillShieldLockFill className="icon"/>
                                <input 
                                    type="password" 
                                    id="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Escriba su contraseña"
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn flex"
                            disabled={loading}
                        >
                            <span>{loading ? 'Iniciando sesión...' : 'Iniciar sesión'}</span>
                            <TiArrowRightOutline className="icon" />
                        </button>

                        <span className="forgotPassword">
                            Olvidaste tu contraseña? <a href="#">Haz Clic Aquí</a>
                        </span>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;