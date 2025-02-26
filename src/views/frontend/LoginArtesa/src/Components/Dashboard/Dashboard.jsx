import React from 'react';
import "../../App.css";
import "./Dashboard.css";
// Importing Components ==========>
import Sidebar from "./Sidebar Section/Sidebar";
import Top from "./Body Section/Top Section/Top";
import Listing from "./Body Section/Listing Section/Listing";
import Activity from "./Body Section/Activity Section/Activity";
import ClientProfile from "./ClientProfile/ClientProfile"; // Agregar Nuevo componente
import { createContext, useState, useContext } from "react";
import { FaUserCircle } from "react-icons/fa";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    // Obtener información del usuario del localStorage
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      setUser(JSON.parse(userInfo));
    }
  }, []);

  const toggleProfile = () => {
    setShowProfile(!showProfile);
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
                  <span className="user-email">{user.email}</span>
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
        <ClientProfile user={user} onClose={toggleProfile} />
      )}
    </div>
  );
};
export default Dashboard;