import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle, FaSignOutAlt, FaCog, FaUser } from "react-icons/fa";
import "./Top.css";

// Usar una ruta absoluta en lugar de relativa
import logo from "/src/LoginsAssets/logo_artesa.png";

const Top = ({ user: propUser }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(propUser || null);
  const navigate = useNavigate();

  useEffect(() => {
    // Si no se pasa el usuario por props, intentamos obtenerlo de localStorage
    if (!propUser) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error("Error al parsear usuario:", error);
        }
      }
    }
  }, [propUser]);

  const handleLogout = () => {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('clientProfile');
    
    // Cerrar menú
    setMenuOpen(false);
    
    // Redirigir a la página de login
    navigate("/");
  };

  // Obtener nombre del usuario para mostrar
  const getUserName = () => {
    if (!user) return "Usuario";
    
    return user.nombre || user.name || user.email || user.mail || "Usuario";
  };

  return (
    <div className="top-section">
      <div className="logo-container">
        {/* Alternativa: usar ruta dentro del src directamente */}
        <img src={logo} alt="Logo Artesa" className="top-logo" />
        <h1>Panel de Control</h1>
      </div>

      <div className="user-container">
        <button className="user-icon" onClick={() => setMenuOpen(!menuOpen)}>
          <FaUserCircle size={24} />
          <span className="username">{getUserName()}</span>
        </button>

        {menuOpen && (
          <div className="user-menu">
            <button onClick={() => { 
              setMenuOpen(false);
              navigate('/dashboard'); 
            }}>
              <FaUser />
              <span>Perfil</span>
            </button>
            
            <button onClick={() => { 
              setMenuOpen(false);
              navigate('/dashboard/settings'); 
            }}>
              <FaCog />
              <span>Configuración</span>
            </button>
            
            <button onClick={handleLogout}>
              <FaSignOutAlt />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Top;