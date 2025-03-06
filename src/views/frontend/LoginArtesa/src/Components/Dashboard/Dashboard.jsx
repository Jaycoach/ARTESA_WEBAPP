import React, { useState, useEffect } from 'react';
import "../../App.scss";
// Importing Components ==========>
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import Listing from "./Body Section/ListingSection/Listing";
import Activity from "./Body Section/ActivitySection/Activity";
//import ClientProfile from "./ClientProfile/ClientProfile";//
import Banner_dash from  "../../DashboardAssets/Banner_dash2.png";
import { FaUserCircle } from "react-icons/fa";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Obtener información del usuario del localStorage
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        const userData = JSON.parse(userInfo);
        setUser(userData);
        
        // Extraer nombre y email del usuario
        if (userData.nombre) {
          setUserName(userData.nombre);
        } else if (userData.name) {
          setUserName(userData.name);
        }
        
        // Establecer el email del usuario
        setUserEmail(userData.email || userData.mail || '');
        
        // Verificar si hay un perfil guardado en localStorage
        const clientProfile = localStorage.getItem('clientProfile');
        if (clientProfile) {
          const profileData = JSON.parse(clientProfile);
          if (profileData.nombre) {
            setUserName(profileData.nombre);
          }
        }
      } catch (error) {
        console.error("Error al parsear datos del usuario:", error);
      }
    }
  }, []);

  const toggleProfile = () => {
    setShowProfile(!showProfile);
  };

  // Función para actualizar el nombre del usuario desde el ClientProfile
  const updateUserName = (name) => {
    setUserName(name);
  };

  return (
    <div className="dashboard">
      {/* Contenedor principal con Sidebar y contenido */}
      <div className="dashboard-layout">
        {/* Sidebar a la izquierda */}
        <Sidebar />

        {/* Contenido a la derecha */}
        <div className="dashboard-content">
          <img src={Banner_dash} alt='Bannerartesa'/>
          {/* Información del usuario en la parte superior */}

          <h1>Bienvenido al Panel de Control</h1>
          <p>Aquí puedes gestionar tus productos y ventas.</p>

          {/* Secciones del dashboard */}
          <Top />
          <Listing />
          <Activity />
        </div>
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