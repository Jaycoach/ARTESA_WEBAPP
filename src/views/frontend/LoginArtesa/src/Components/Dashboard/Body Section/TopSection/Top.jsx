import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import { useAuth } from "../../../../hooks/useAuth"; // Usar el hook personalizado
import ClientProfile from "../../ClientProfile/ClientProfile";
import "./Top.scss";

const Top = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { user, logout, updateUserInfo } = useAuth(); // Obtenemos funciones y estado del contexto
  const [displayName, setDisplayName] = useState("");
  const navigate = useNavigate();

  // Efecto para actualizar el nombre de visualización cuando cambia el usuario
  useEffect(() => {
    if (user) {
      // Priorizar nombres en este orden
      const name = user.nombre || user.name || user.email || user.mail || "Usuario";
      setDisplayName(name);
    }
  }, [user]); // Se ejecuta cuando cambia el usuario en el contexto

  const handleLogout = () => {
    logout();
    navigate("/"); // Redirigir a la página de inicio
  };

  const handleOpenProfile = () => {
    setMenuOpen(false); // Cerrar el menú
    setShowProfileModal(true); // Mostrar el modal de perfil
  };

  const handleCloseProfile = () => {
    setShowProfileModal(false); // Cerrar el modal de perfil
  };

  const handleProfileUpdate = (updatedUser) => {
    // Actualizar el contexto con la nueva información
    updateUserInfo(updatedUser);
    
    // También actualizar el nombre de visualización directamente
    if (updatedUser.nombre) {
      setDisplayName(updatedUser.nombre);
    }
  };

  return (
    <>
      <div className="top-section">
        <h1>Dashboard</h1>

        <div className="user-container">
          <button className="user-icon" onClick={() => setMenuOpen(!menuOpen)}>
            <FaUserCircle size={30} />
            {displayName && <span className="username">{displayName}</span>}
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