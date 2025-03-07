import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    const [formData, setFormData] = useState({
        name: '',
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
            const response = await API.post('/api/auth/register', formData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Guardar token y usuario en localStorage
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Redirigir al dashboard después del registro exitoso
            navigate('/');
        } catch (error) {
            setError(error.response?.data?.message || 'Error en el registro');
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
                {error && <p className="error-message">{error}</p>} {/* Mostrar errores */}

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

                    <button type="submit" className="btn flex" disabled={loading} >
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
    )
    }
    
export default Register