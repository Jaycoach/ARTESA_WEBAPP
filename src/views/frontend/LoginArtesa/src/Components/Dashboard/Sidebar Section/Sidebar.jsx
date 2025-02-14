import React from "react";
import './sidebar.css';
import logo from '/src/LoginsAssets/logo_artesa.png';

//Import Icons ========>
import { IoMdSpeedometer } from "react-icons/io";
import { TbTruckDelivery } from "react-icons/tb";
import { MdOutlineExplore } from "react-icons/md";
import { AiOutlineProduct } from "react-icons/ai";
import { PiChartPieSliceDuotone } from "react-icons/pi";
import { FiTrendingUp } from "react-icons/fi";
import { FaRegCreditCard } from "react-icons/fa";


const Sidebar = () => {
    return (
        <div className="sidebar flex">

            <div className="logoDiv flex">
                <img src={logo} alt="Logo"/>
            </div>

            <div className="menuDiv">
                <h3 className="menuTitle">
                    Menu Rapido
                </h3>
                <ul className="menuList grid">
                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <IoMdSpeedometer className="icon" />
                            <span className="smallText">
                                Dashboard
                            </span>
                        </a>

                    </li>

                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <TbTruckDelivery className="icon" />
                            <span className="smallText">
                                Mis Ordenes
                            </span>
                        </a>

                    </li>

                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <MdOutlineExplore className="icon" />
                            <span className="smallText">
                                Explorar
                            </span>
                        </a>

                    </li>

                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <AiOutlineProduct className="icon" />
                            <span className="smallText">
                                Productos
                            </span>
                        </a>

                    </li>
                </ul>
            </div>
            <div className="settingsDiv">
                <h3 className="settingsTitle">
                    Configuración
                </h3>
                <ul className="menuList grid">
                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <FiTrendingUp className="icon" />
                            <span className="smallText">
                                Reportes
                            </span>
                        </a>

                    </li>

                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <PiChartPieSliceDuotone className="icon" />
                            <span className="smallText">
                                Seccion
                            </span>
                        </a>

                    </li>

                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <FaRegCreditCard className="icon" />
                            <span className="smallText">
                                Facturas
                            </span>
                        </a>

                    </li>

                    <li className="listItem">
                        <a href="#" className="menuLink flex">
                            <AiOutlineProduct className="icon" />
                            <span className="smallText">
                                Seccion
                            </span>
                        </a>

                    </li>
                </ul>
            </div>
        </div>
    );
}

export default Sidebar;
