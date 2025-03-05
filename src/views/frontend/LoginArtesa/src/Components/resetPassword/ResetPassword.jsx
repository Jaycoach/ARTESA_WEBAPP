import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../../api/config"; // Asegúrate de que este sea el endpoint correcto
import "./ResetPassword.css"; // Agrega los estilos necesarios

// Import Icons
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";

const ResetPassword = () => {
  const { token } = useParams(); // Captura el token desde la URL
  const navigate = useNavigate();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      const response = await API.post("/password/reset", { token, password });
      setSuccessMessage(response.data.message || "Contraseña restablecida con éxito.");
      
      // Redireccionar después de unos segundos
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      setError(error.response?.data?.message || "Error al restablecer la contraseña.");
    }
  };

  return (
    <div className="ResetPasswordPage flex">
    <div className="container flex">
      <div className="formDiv flex">
        <h3 className="textDiv">Restablecer Contraseña</h3>
        
        {successMessage && <p className="success-message">{successMessage}</p>}
        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit} className="form grid">
          {/* Nueva Contraseña */}
          <div className="inputDiv">
            <label htmlFor="password">Nueva Contraseña</label>
            <div className="input flex">
              <BsFillShieldLockFill className="icon" />
              <input
                type="password"
                id="password"
                placeholder="Ingrese nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
        </div>
             

          {/* Confirmar Contraseña */}
          <div className="inputDiv">
            <label htmlFor="confirmPassword">Confirmar Contraseña</label>
            <div className="input flex">
              <BsFillShieldLockFill className="icon" />
              <input
                type="password"
                id="confirmPassword"
                placeholder="Confirme su contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Botón de Cambiar Contraseña */}
          <button type="submit" className="btn flex">
            <span>Cambiar Contraseña</span>
            <TiArrowRightOutline className="icon" />
          </button>
        </form>
      </div>
    </div>
    </div> 
  );
};

export default ResetPassword;