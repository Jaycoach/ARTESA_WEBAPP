import React from "react"
import './Login.css'
import '../../App.css'
import { Link, NavLink } from 'react-router-dom'

//Import Assets
import img from '../../LoginsAssets/principal_img.jpg'
import logo from '../../LoginsAssets/logo_artesa.png'

//Import Icons
import { FaUserShield } from "react-icons/fa";
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";

const Login = () => {
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
                <form action="" className="form grid">
                    <span className="showMessage">Login Status will go here</span>
                    
                    <div className="inputDiv">
                        <label htmlFor="username">Nombre de usuario</label>
                        <div className="input flex">
                            <FaUserShield className="icon"/>
                            <input type="text" id="username" placeholder="Escriba su usuario:" />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="password">Contraseña</label>
                        <div className="input flex">
                            <BsFillShieldLockFill className="icon"/>
                            <input type="password" id="password" placeholder="Escriba su contraseña:" />
                        </div>
                    </div>

                    <Link to={'/Dashboard'}>
                    <button type="submit" className="btn flex">
                        <span>Iniciar sesión</span>
                        <TiArrowRightOutline className="icon" /></button>
                    </Link>
                    <span className="forgotPassword">
                        Olvidaste tu contraseña? <a href="">Haz Clic Aquí</a>
                    </span>

                </form>
            </div>


        </div>
        </div>
    )
    }
    
export default Login