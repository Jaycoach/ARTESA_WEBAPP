import React, { createContext, useState, useEffect } from 'react';
import "../../App.css";
import "./Dashboard.css";
// Importing Components ==========>
import Sidebar from "./Sidebar Section/Sidebar";
import Top from "./Body Section/Top Section/Top";
import Listing from "./Body Section/Listing Section/Listing";
import Activity from "./Body Section/Activity Section/Activity";
import ClientProfile from "./ClientProfile/ClientProfile"; // Agregar Nuevo componente
import { FaUserCircle } from "react-icons/fa";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Obtener información del usuario del localStorage
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      const userData = JSON.parse(userInfo);
      setUser(userData);
      
      // Obtener el nombre desde ClientProfile si está disponible
      const clientProfile = localStorage.getItem('clientProfile');
      if (clientProfile) {
        const profileData = JSON.parse(clientProfile);
        if (profileData.nombre) {
          setUserName(profileData.nombre);
        }
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
          {/* Información del usuario en la parte superior */}
          {user && (
            <div className="user-profile-section">
              <div className="user-profile-info" onClick={toggleProfile}>
                <FaUserCircle className="user-icon" />
                <div className="user-details">
                  <span className="user-name">{userName || user.nombre || user.email}</span>
                  <span className="profile-label">Información del Perfil</span>
                </div>
              </div>
            </div>
          )}

          <h1>Welcome to the Dashboard</h1>
          <p>Here you can manage your products and sales.</p>

          {/* Aquí puedes agregar más secciones del dashboard */}
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