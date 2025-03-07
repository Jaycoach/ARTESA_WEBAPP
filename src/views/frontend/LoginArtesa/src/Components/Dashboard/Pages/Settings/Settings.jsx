import React, { useState, useEffect } from "react";

const Settings = () => {

  const [theme, setTheme] = useState("light");

  const toggleTheme = () => {
  const newTheme = theme === "light" ? "dark" : "light";
  setTheme(newTheme);
  document.documentElement.setAttribute("data-theme", newTheme);
  };
  const [userData, setUserData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    identificacion: "",
    razonSocial: "",
    cupoActual: "",
    cupoSolicitado: ""
  });

  useEffect(() => {
    fetch("/api/sap/user")
      .then(response => response.json())
      .then(data => setUserData(data))
      .catch(error => console.error("Error obteniendo datos del usuario:", error));
  }, []);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };
  
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      alert("Las contraseñas no coinciden.");
      return;
    }
  
    fetch("/api/sap/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwords),
    })
    .then(response => response.json())
    .then(data => alert("Contraseña actualizada correctamente"))
    .catch(error => console.error("Error cambiando contraseña:", error));
  };
  

  return (
    <div className="user-profile-container">
      <h2 className="form-title">Información del Usuario</h2>
      <div className="user-profile-display">
        <div className="form-grid">
          <div className="form-field"><strong>Nombre:</strong> {userData.nombre}</div>
          <div className="form-field"><strong>Email:</strong> {userData.email}</div>
          <div className="form-field"><strong>Teléfono:</strong> {userData.telefono}</div>
          <div className="form-field"><strong>Dirección:</strong> {userData.direccion}</div>
          <div className="form-field"><strong>Ciudad:</strong> {userData.ciudad}</div>
          <div className="form-field"><strong>Identificación:</strong> {userData.identificacion}</div>
          <div className="form-field"><strong>Razón Social:</strong> {userData.razonSocial}</div>
          <div className="form-field"><strong>Cupo Actual:</strong> {userData.cupoActual}</div>
          <div className="form-field"><strong>Cupo Solicitado:</strong> {userData.cupoSolicitado}</div>
        </div>
        <div className="password-change-container">
        <h3>Cambiar Contraseña</h3>
          <form onSubmit={handlePasswordSubmit}>
            <label>Contraseña Actual:
              <input type="password" name="currentPassword" onChange={handlePasswordChange} required />
            </label>
            <label>Nueva Contraseña:
              <input type="password" name="newPassword" onChange={handlePasswordChange} required />
            </label>
          <label>Confirmar Nueva Contraseña:
            <input type="password" name="confirmPassword" onChange={handlePasswordChange} required />
          </label>
            <button type="submit" className="submit-btn">Actualizar Contraseña</button>
           </form>
           <div className="theme-toggle">
          <h3>Personalización</h3>
            <button onClick={toggleTheme} className="theme-btn">
      Cambiar a {theme === "light" ? "Modo Oscuro" : "Modo Claro"}
            </button>
          </div>
        </div>
      </div>
    </div>
    
  );
};

export default Settings;