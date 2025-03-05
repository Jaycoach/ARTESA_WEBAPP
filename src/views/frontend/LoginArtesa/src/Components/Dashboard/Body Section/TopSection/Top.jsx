import React, { useState, useContext, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // Para la redirección
import { FaUserCircle } from "react-icons/fa"; // Ícono de usuario
import AuthContext from "../../../../context/AuthContext";
import "../../../../App.scss";
import ClientProfile from "../../Pages/ClientProfile/ClientProfile";

const Top = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Manejo de clics fuera del menú para cerrarlo
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest(".user-container")) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Función de cierre de sesión optimizada
  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  return (
    <div className="top-section">
      <h1>Bienvenido a Artesa!</h1>

      <div className="user-container">
        <button
          className="user-icon"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menú de usuario"
        >
          <FaUserCircle size={30} />
          {user && <span className="username">{user.name}</span>}
        </button>

        {menuOpen && (
          <div className="user-menu">
            <button onClick={() => setModalOpen(true)}>Configuración</button>
            <button onClick={handleLogout}>Cerrar Sesión</button>
          </div>
        )}
      </div>

      {/* Modal de Configuración */}
      {modalOpen && <ClientProfile onClose={() => setModalOpen(false)} />}
    </div>
  );
};

export default Top;