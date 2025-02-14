import React from "react"
import './Register.css'
import '../../App.css'
import { Link, NavLink } from 'react-router-dom'

//Import Assets
import img from '../../LoginsAssets/principal_img.jpg'
import logo from '../../LoginsAssets/logo_artesa.png'

//Import Icons
import { FaUserShield } from "react-icons/fa";
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { MdMarkEmailRead } from "react-icons/md";

const Register = () => {
    return (
        <div className="RegisterPage flex">
        <div className="container flex">
            <div className="imgDiv">

                <img src={img} alt="registerImg" />
                <div className="textDiv">
                    <h2 className="title">Creado para ARTESA</h2>
                    <p>Register Page - Artesa</p>
                </div>
                <div className="footerDiv flex">
                    <span className="text">Ya tiene una cuenta?</span>
                    <Link to={'/'}>
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
                <form action="" className="form grid">
                <div className="inputDiv">
                        <label htmlFor="name">Nombre:</label>
                        <div className="input flex">
                            <MdMarkEmailRead className="icon"/>
                            <input type="text" id="name" placeholder="Escriba su Nombre:" />
                        </div>
                    </div>

                    <div className="inputDiv">
                        <label htmlFor="mail">Email</label>
                        <div className="input flex">
                            <MdMarkEmailRead className="icon"/>
                            <input type="email" id="email" placeholder="Escriba su Email (usuario):" />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="password">Contraseña</label>
                        <div className="input flex">
                            <BsFillShieldLockFill className="icon"/>
                            <input type="password" id="password" placeholder="Escriba su contraseña:" />
                        </div>
                    </div>

                    <button type="submit" className="btn flex">
                        <span>Registrarse</span>
                        <TiArrowRightOutline className="icon" />
                    </button>

                    <span className="forgotPassword">
                        Olvidaste tu contraseña? <a href="">Haz Clic Aquí</a>
                    </span>

                </form>
            </div>


        </div>
        </div>
    )
    }
    
export default Register