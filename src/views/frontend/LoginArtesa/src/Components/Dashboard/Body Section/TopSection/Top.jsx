import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom"; // Para la redirección
import { FaUserCircle } from "react-icons/fa"; // Ícono de usuario
import AuthContext from "../../../../context/AuthContext";
import ClientProfile from "../../ClientProfile/ClientProfile"; // Importamos el componente de perfil
import "./Top.scss";

const Top = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/"); // Redirigir a la página de login
  };

  const handleOpenProfile = () => {
    setMenuOpen(false); // Cerrar el menú
    setShowProfileModal(true); // Mostrar el modal de perfil
  };

  const handleCloseProfile = () => {
    setShowProfileModal(false); // Cerrar el modal de perfil
  };

  const handleProfileUpdate = (name) => {
    // Esta función se pasará al componente ClientProfile
    // para actualizar el nombre de usuario si es necesario
    console.log("Perfil actualizado:", name);
  };

  return (
    <>
      <div className="top-section">
        <h1>Dashboard</h1>

        <div className="user-container">
          <button className="user-icon" onClick={() => setMenuOpen(!menuOpen)}>
            <FaUserCircle size={30} />
            {user && <span className="username">{user.name}</span>}
          </button>

          {menuOpen && (
            <div className="user-menu">
              <button onClick={handleOpenProfile}>Perfil</button>
              <button onClick={() => navigate("/dashboard/settings")}>Configuración</button>
              <button onClick={handleLogout}>Cerrar Sesión</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de perfil de cliente */}
      {showProfileModal && user && (
        <ClientProfile
          user={user}
          onClose={handleCloseProfile}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </>
  );
};

export default Top;