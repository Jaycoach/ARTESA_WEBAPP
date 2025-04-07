import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRecaptcha } from "../../hooks/useRecaptcha"; // Importar el hook de reCAPTCHA
import API from "../../api/config";
import "../../App.scss";
// Import Assets (los mismos que usa Login)
import img from "../../LoginsAssets/principal_img.jpg";
import logo from "../../LoginsAssets/logo_artesa_alt.png";
// Import Icons
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { Link } from "react-router-dom";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError, isRecaptchaReady } = useRecaptcha();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    // Validaciones del lado del cliente
    if (newPassword !== confirmPassword) {
      setError("❌ Las contraseñas no coinciden.");
      setIsLoading(false);
      return;
    }

    // Validar longitud mínima de la contraseña
    if (newPassword.length < 8) {
      setError("❌ La contraseña debe tener al menos 8 caracteres.");
      setIsLoading(false);
      return;
    }

    try {
      // Generar token de reCAPTCHA
      console.log("Generando token reCAPTCHA para reset_password");
      const recaptchaToken = await generateRecaptchaToken('reset_password');
      
      if (!recaptchaToken) {
        setError(recaptchaError || '❌ Error en la verificación de seguridad. Por favor, recargue la página e intente nuevamente.');
        console.error("No se pudo obtener token reCAPTCHA para reset_password");
        setIsLoading(false);
        return;
      }

      console.log("Token reCAPTCHA obtenido correctamente para reset_password");

        // Crear el objeto de datos con el token reCAPTCHA
        const resetData = {
            token,
            newPassword,
            recaptchaToken
        };
        
        console.log("Enviando solicitud de reset_password con token reCAPTCHA");
        const response = await API.post("/password/reset", resetData);

      // Verificar si la respuesta tiene la estructura esperada
      if (response.data && response.data.success) {
        setSuccessMessage("✅ " + (response.data.message || "Contraseña restablecida con éxito."));
        
        // Redireccionar después de unos segundos
        setTimeout(() => navigate("/login"), 3000);
      } else {
        // En caso de que la respuesta sea exitosa pero no tenga el formato esperado
        setSuccessMessage("✅ Contraseña restablecida con éxito.");
        setTimeout(() => navigate("/login"), 3000);
      }
    } catch (error) {
      console.error("Error al restablecer contraseña:", error);
      
      // Manejar errores específicos de reCAPTCHA
      if (error.response?.data?.code === 'RECAPTCHA_FAILED') {
        setError("❌ Verificación de seguridad fallida. Por favor, intenta nuevamente.");
      } else {
        // Manejo detallado de errores según la respuesta del backend
        if (error.response) {
          // El servidor respondió con un código de estado fuera del rango 2xx
          const { data, status } = error.response;
          
          if (status === 400) {
            // Capturar códigos de error específicos del backend
            const errorMessage = data.message || "Datos inválidos";
            const errorCode = data.errorCode || "";
            
            switch(errorCode) {
              case "MISSING_TOKEN":
                setError("❌ Token de recuperación no proporcionado.");
                break;
              case "MISSING_PASSWORD":
                setError("❌ Debe proporcionar una nueva contraseña.");
                break;
              case "INVALID_TOKEN":
                setError("❌ El token es inválido o ha expirado. Por favor solicite un nuevo enlace de recuperación.");
                break;
              case "SAME_PASSWORD":
                setError("❌ La nueva contraseña no puede ser igual a la actual.");
                break;
              case "USER_NOT_FOUND":
                setError("❌ No se encontró el usuario asociado al token.");
                break;
              default:
                setError(`❌ ${errorMessage}`);
            }
          } else if (status === 500) {
            setError("❌ Error en el servidor. Por favor intente más tarde.");
          } else {
            setError(`❌ Error (${status}): ${data.message || "Error desconocido"}`);
          }
        } else if (error.request) {
          // La solicitud fue hecha pero no se recibió respuesta
          setError("❌ No se pudo conectar con el servidor. Verifique su conexión a internet.");
        } else {
          // Error al configurar la solicitud
          setError(`❌ Error: ${error.message}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ResetPasswordPage flex">
      <div className="container flex">
        {/* Imagen Lateral (igual que en Login) */}
        <div className="imgDiv">
          <img src={img} alt="ResetPasswordImg" />
          <div className="textDiv">
            <h2 className="title">Creado para ARTESA</h2>
            <p>Recuperación de Contraseña - Artesa</p>
          </div>
          <div className="footerDiv flex">
            <span className="text">¿Recordaste tu contraseña?</span>
            <Link to={'/login'}>
              <button className="btn">Volver al Login</button>
            </Link>
            <span className="text">© 2025 Artesa</span>
          </div>
        </div>

        {/* Formulario */}
        <div className="formDiv flex">
          <div className="headerDiv">
            <img src={logo} alt="Logo Artesa" />
            <h3>Restablecer Contraseña</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="form grid">
            {successMessage && <div className="success-message">{successMessage}</div>}
            {error && <div className="error-message">{error}</div>}
            
            {/* Nueva Contraseña */}
            <div className="inputDiv">
              <label htmlFor="password">Nueva Contraseña</label>
              <div className="input flex">
                <BsFillShieldLockFill className="icon" />
                <input
                  type="password"
                  id="password"
                  placeholder="Ingrese nueva contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
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
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
            </div>
            
            {/* Botón de Cambiar Contraseña */}
            <button type="submit" className="btn flex" disabled={isLoading || recaptchaLoading}>
              <span>
                  {isLoading ? "Procesando..." : !isRecaptchaReady ? "Cargando seguridad..." : "Cambiar Contraseña"}
              </span>
              {!isLoading && <TiArrowRightOutline className="icon" />}
          </button>
          </form>
        </div>
      </div>
    </div> 
  );
};

export default ResetPassword;