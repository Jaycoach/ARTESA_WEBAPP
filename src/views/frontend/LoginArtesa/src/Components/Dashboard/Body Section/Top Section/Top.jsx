import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Para la redirección
import { FaUserCircle } from "react-icons/fa"; // Ícono de usuario
import "./Top.scss";

const Top = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/"); // Redirigir a la página de login
  };

  return (
    <div className="top-section">
      <h1>Dashboard</h1>

      <div className="user-container">
        <button className="user-icon" onClick={() => setMenuOpen(!menuOpen)}>
          <FaUserCircle size={30} />
        </button>

        {menuOpen && (
          <div className="user-menu">
            <button onClick={() => console.log("Cuenta")}>Cuenta</button>
            <button onClick={() => console.log("Configuración")}>Configuración</button>
            <button onClick={handleLogout}>Cerrar Sesión</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Top;