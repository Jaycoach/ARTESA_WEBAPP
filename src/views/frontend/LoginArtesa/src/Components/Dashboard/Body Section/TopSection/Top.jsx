import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Para la redirección
import { FaUserCircle } from "react-icons/fa"; // Ícono de usuario
import { useAuth } from "../../../../hooks/useAuth"; // Importamos useAuth hook
import "./top.scss";

const Top = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth(); // Usamos el hook para obtener el usuario
  const [displayName, setDisplayName] = useState("Usuario");
  const navigate = useNavigate();

  useEffect(() => {
    // Función para determinar el nombre a mostrar
    const determineDisplayName = () => {
      // Verificar si existe un perfil en localStorage
      const clientProfile = localStorage.getItem('clientProfile');
      if (clientProfile) {
        const profileData = JSON.parse(clientProfile);
        if (profileData.nombre) {
          return profileData.nombre;
        }
      }

      // Si no hay perfil guardado, usar información del usuario
      if (user) {
        if (user.nombre) return user.nombre;
        if (user.name) return user.name;
        if (user.mail) return user.mail;
        if (user.email) return user.email;
      }

      return "Usuario";
    };

    setDisplayName(determineDisplayName());
  }, [user]); // Ejecutar cuando cambie el usuario

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/"); // Redirigir a la página de login
  };

  return (
    <div className="top-section">
      <h1>Dashboard</h1>

      <div className="user-container">
        <button className="user-icon" onClick={() => setMenuOpen(!menuOpen)}>
          <FaUserCircle size={30} />
          <span className="username">{displayName}</span>
        </button>

        {menuOpen && (
          <div className="user-menu">
            <button onClick={() => navigate("/dashboard/settings")}>Configuración</button>
            <button onClick={handleLogout}>Cerrar Sesión</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Top;