import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./sidebar.scss"; // Importamos el archivo SCSS correspondiente
import logo from '../../LoginsAssets/logo_artesa.png'; // Ruta relativa al logo

// Iconos
import { IoMdSpeedometer } from "react-icons/io";
import { TbTruckDelivery } from "react-icons/tb";
import { MdOutlineInventory } from "react-icons/md";
import { FiSettings } from "react-icons/fi";
import { FaRegCreditCard } from "react-icons/fa";
import { BiLogOut } from "react-icons/bi";

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/"); // Redirigir a la página de login
  };

  return (
    <div
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      onMouseEnter={() => setCollapsed(false)}  
      onMouseLeave={() => setCollapsed(true)}
    >
      {/* Logo */}
      <div className="logoDiv flex">
        <img src={logo} alt="Logo Artesa" />
      </div>

      {/* Menú Principal */}
      <div className="menuDiv">
        <h3 className="menuTitle">
          Menú Principal
        </h3>
        <ul className="menuList grid">
          <li className="listItem">
            <button onClick={() => navigate("/dashboard")} className="menuLink flex">
              <IoMdSpeedometer className="icon" />
              <span className="smallText">
                Dashboard
              </span>
            </button>
          </li>
          <li className="listItem">
            <button onClick={() => navigate("/dashboard/orders")} className="menuLink flex">
              <TbTruckDelivery className="icon" />
              <span className="smallText">
                Pedidos
              </span>
            </button>
          </li>
          <li className="listItem">
            <button onClick={() => navigate("/dashboard/products")} className="menuLink flex">
              <MdOutlineInventory className="icon" />
              <span className="smallText">
                Productos
              </span>
            </button>
          </li>
          <li className="listItem">
            <button onClick={() => navigate("/dashboard/invoices")} className="menuLink flex">
              <FaRegCreditCard className="icon" />
              <span className="smallText">
                Facturas
              </span>
            </button>
          </li>
        </ul>
      </div>

      {/* Configuración */}
      <div className="settingsDiv">
        <h3 className="settingsTitle">
          Configuración
        </h3>
        <ul className="menuList grid">
          <li className="listItem">
            <button onClick={() => navigate("/dashboard/settings")} className="menuLink flex">
              <FiSettings className="icon" />
              <span className="smallText">
                Ajustes
              </span>
            </button>
          </li>
          <li className="listItem">
            <button onClick={handleLogout} className="menuLink flex">
              <BiLogOut className="icon" />
              <span className="smallText">
                Cerrar Sesión
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;