import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaUserCircle, FaBell, FaBars } from "react-icons/fa";
import logoArtesa from '../../../../LoginsAssets/logo_artesa.png';
import { useAuth } from "../../../../hooks/useAuth";
import ClientProfile from "../../ClientProfile/ClientProfile";

const Top = ({ user, onToggleSidebar }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { logout, updateUserInfo } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const profileModalRef = useRef(null);

  useEffect(() => {
    if (user) {
      const name = user.nombre || user.name || user.email || user.mail || "Usuario";
      setDisplayName(name);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (showProfileModal && profileModalRef.current && !profileModalRef.current.contains(event.target)) {
        setShowProfileModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
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

  return (
    <div className="bg-primary text-white h-14 px-7 flex items-center justify-between shadow-md z-30">
      {/* Lado izquierdo - Título y toggle */}
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="mr-4 text-white hover:text-gray-200 focus:outline-none"
        >
          <FaBars />
        </button>
        <Link to="/dashboard">
        <img
          src={logoArtesa}
          alt="Logo de LA ARTESA"
          className="h-8 object-contain ml-[2px]" // <-- Ajusta este valor si lo deseas más alineado
        />
        </Link> 
      </div>

      {/* Lado derecho - Perfil */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center space-x-2 text-white hover:text-gray-200"
        >
          <span className="mr-2">{displayName}</span>
          <FaUserCircle size={24} />
        </button>

        {/* Menú desplegable */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
            <button
              onClick={handleOpenProfile}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Mi Perfil
            </button>
            <button
              onClick={() => navigate("/dashboard/settings")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Configuración
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>

      {/* Modal de perfil */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            ref={profileModalRef}
            className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Mi Perfil</h2>
              <button
                onClick={handleCloseProfile}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                ✕
              </button>
            </div>
            <ClientProfile
              onClose={handleCloseProfile}  // <- Añadir esta prop
              onProfileUpdate={updateUserInfo}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Top;