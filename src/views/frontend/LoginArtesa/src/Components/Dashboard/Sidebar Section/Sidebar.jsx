import React from "react";
import './sidebar.css';
import logo from '/src/LoginsAssets/logo_artesa.png';
import { useNavigate } from 'react-router-dom';

//Import Icons ========>
import { IoMdSpeedometer } from "react-icons/io";
import { TbTruckDelivery } from "react-icons/tb";
import { MdOutlineExplore, MdOutlineInventory } from "react-icons/md";
import { PiChartPieSliceDuotone } from "react-icons/pi";
import { FiTrendingUp, FiSettings } from "react-icons/fi";
import { FaRegCreditCard } from "react-icons/fa";
import { BiLogOut } from "react-icons/bi";  // Agregamos solo este ícono

const Sidebar = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <div className="sidebar flex">
            {/* Mantener todo el contenido existente */}
            <div className="logoDiv flex">
                <img src={logo} alt="Logo"/>
            </div>

            <div className="menuDiv">
                <h3 className="menuTitle">
                    Menu Rapido
                </h3>
                {/* ... resto del menú ... */}
            </div>

            <div className="settingsDiv">
                <h3 className="settingsTitle">
                    Configuración
                </h3>
                <ul className="menuList grid">
                    {/* ... items existentes ... */}
                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <FiSettings className="icon" />
                            <span className="smallText">
                                Seccion
                            </span>
                        </a>
                    </li>

                    {/* Agregamos solo este nuevo item */}
                    <li className="listItem">
                        <a href="#" className="menuLink flex" onClick={handleLogout}>
                            <BiLogOut className="icon" />
                            <span className="smallText">
                                Cerrar Sesión
                            </span>
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default Sidebar;