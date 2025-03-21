import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import { useAuth } from "../../../../hooks/useAuth";
import ClientProfile from "../../ClientProfile/ClientProfile";
import "./Top.scss";

const Top = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { user, logout, updateUserInfo } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const profileModalRef = useRef(null);

  // Efecto para actualizar el nombre de visualización cuando cambia el usuario
  useEffect(() => {
    if (user) {
      // Priorizar nombres en este orden
      const name = user.nombre || user.name || user.email || user.mail || "Usuario";
      setDisplayName(name);
    }
  }, [user]);

  // Efecto para detectar clics fuera del menú
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Cerrar menú si está abierto y se hace clic fuera
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      
      // Cerrar modal si está abierto y se hace clic fuera
      if (showProfileModal && profileModalRef.current && !profileModalRef.current.contains(event.target)) {
        setShowProfileModal(false);
      }
    };

    // Agregar event listener
    document.addEventListener("mousedown", handleClickOutside);
    
    // Limpieza del event listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen, showProfileModal]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleOpenProfile = () => {
    setMenuOpen(false);
    setShowProfileModal(true);
  };

  const handleCloseProfile = () => {
    setShowProfileModal(false);
  };

  const handleProfileUpdate = (updatedUser) => {
    updateUserInfo(updatedUser);
    if (updatedUser.nombre) {
      setDisplayName(updatedUser.nombre);
    }
  };

  return (
    <>
      <div className="top-section">
        <h1>LA ARTESA</h1>

        <div className="user-container">
          <button className="user-icon" onClick={() => setMenuOpen(!menuOpen)}>
            <FaUserCircle size={30} />
            {displayName && <span className="username">{displayName}</span>}
          </button>

          {menuOpen && (
            <div className="user-menu" ref={menuRef}>
              <button onClick={handleOpenProfile}>Perfil</button>
              <button onClick={() => navigate("/dashboard/settings")}>Configuración</button>
              <button onClick={handleLogout}>Cerrar Sesión</button>
            </div>
          )}
        </div>
      </div>

      {showProfileModal && (
        <div className="profile-modal-backdrop">
          <div className="profile-modal-content" ref={profileModalRef}>
            <ClientProfile 
              user={user} 
              onClose={handleCloseProfile} 
              onUpdate={handleProfileUpdate} 
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Top;