import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "../../App.css";
import "./Dashboard.css";
// Importando componentes necesarios
import Sidebar from "./Sidebar Section/Sidebar";
import Top from "./Body Section/TopSection/Top";
import Listing from "./Body Section/ListingSection/Listing";
import Activity from "./Body Section/ActivitySection/Activity";
import ClientProfile from "./ClientProfile/ClientProfile";
import { FaUserCircle } from "react-icons/fa";
import { useAuth } from '../../hooks/useAuth';

const Dashboard = () => {
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Obtener información del usuario y perfil
    if (user) {
      // Establecer nombre de usuario
      if (user.nombre) {
        setUserName(user.nombre);
      } else if (user.name) {
        setUserName(user.name);
      }
      
      // Establecer el email del usuario
      setUserEmail(user.email || user.mail || '');
      
      // Verificar si hay un perfil guardado en localStorage
      const clientProfile = localStorage.getItem('clientProfile');
      if (clientProfile) {
        try {
          const profileData = JSON.parse(clientProfile);
          if (profileData.nombre) {
            setUserName(profileData.nombre);
          }
        } catch (error) {
          console.error("Error al parsear perfil:", error);
        }
      }
    } else {
      // Si no hay usuario, redirigir al login
      navigate('/login');
    }
  }, [user, navigate]);

  const toggleProfile = () => {
    setShowProfile(!showProfile);
  };

  // Función para actualizar el nombre del usuario desde el ClientProfile
  const updateUserName = (name) => {
    setUserName(name);
  };

  return (
    <div className="dashboard">
      {/* Contenido del dashboard */}
      <div className="dashboard-content">
        {/* Información del usuario en la parte superior */}
        <div className="user-profile-section">
          <div className="user-profile-info" onClick={toggleProfile}>
            <FaUserCircle className="user-icon" />
            <div className="user-details">
              <span className="user-name">{userName || userEmail || 'Usuario'}</span>
              <span className="profile-label">Ver perfil</span>
            </div>
          </div>
        </div>

        <h1>Bienvenido al Panel de Control</h1>
        <p>Aquí puedes gestionar tus productos y ventas.</p>

        {/* Secciones del dashboard */}
        <Listing />
        <Activity />
      </div>
      
      {/* Modal del formulario de perfil */}
      {showProfile && user && (
        <ClientProfile 
          user={user} 
          onClose={toggleProfile} 
          onProfileUpdate={updateUserName}
        />
      )}
    </div>
  );
};

export default Dashboard;