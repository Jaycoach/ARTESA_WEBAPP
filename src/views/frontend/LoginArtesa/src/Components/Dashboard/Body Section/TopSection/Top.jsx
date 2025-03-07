import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Para la redirección
import { FaUserCircle } from "react-icons/fa"; // Ícono de usuario
import AuthContext from "../../../../context/AuthContext";
import API from "../../../../api/config";
import "../../../../App.scss";
import ClientProfile from "../../Pages/ClientProfile/ClientProfile";


const Top = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true); // Estado de carga
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);
  console.log("User desde AuthContext:", user);
  const navigate = useNavigate();

  // Manejo de clics fuera del menú para cerrarlo
  useEffect(() => {  
    const fetchUserData = async () => {
      try {
        const response = await API.get("/api/client-profiles");
        console.log("Respuesta de la API:", response.data);
        if (response.data && response.data.success) {
          setUserData(response.data.data[0]); // Asignar los datos del usuario
        } else {
          setError("No se pudo obtener la información del usuario.");
        }
      } catch (err) {
        console.error("Error al obtener datos del usuario:", err);
        setError("Error al conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    };

    if (!user) {
      fetchUserData();
    } else {
      setUserData(user);
    }
  
    console.log("AuthContext user:", user);  
    console.log("LocalStorage user:", localStorage.getItem("user"));
  }, [user]);

  // Función de cierre de sesión optimizada
  const handleLogout = () => {
    logout();
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="top-section">
      <h1>Bienvenido a Artesa!</h1>

      <div className="user-container">
        <button
          className="user-icon"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <FaUserCircle size={30} />
          {userData ? <span>{userData.nombre || userData.name || "Usuario"}</span> : "Cargando..."}
        </button>

        {menuOpen && (
          <div className="user-menu">
            <button onClick={() => setModalOpen(true)}>Configuración</button>
            <button onClick={handleLogout}>Cerrar Sesión</button>
          </div>
        )}
      </div>

      {/* Modal de Configuración */}
      {modalOpen && (
  <>
    {console.log("Renderizando ClientProfile con userData:", userData)}
    <ClientProfile user={userData} onClose={() => setModalOpen(false)} />
  </>
)}
    </div>
  );
};

export default Top;