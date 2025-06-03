import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useRecaptcha } from "../../hooks/useRecaptcha";
import { useFormValidation } from "../../hooks/useFormValidation";
import { useError } from "../../context/ErrorContext";
import FormErrorMessage from "../ui/FormErrorMessage";
import API from "../../api/config";
import "../../App.scss";

// Import Assets (los mismos que usa Login y Register)
import img from "../../LoginsAssets/principal_img.gif";
import logo from "../../LoginsAssets/logo_artesa_alt.png";

// Import Icons
import { BsFillShieldLockFill } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { FaLock, FaEye, FaEyeSlash } from "react-icons/fa";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError, isRecaptchaReady } = useRecaptcha();
  
  // Usar hooks de validación consistentes con Login/Register
  const { values, setValues, validateField } = useFormValidation({
    newPassword: '',
    confirmPassword: ''
  });
  
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useError();
  
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setValues({ ...values, [id]: value });
    
    // Limpiar error al empezar a escribir
    if (errors[id]) {
      clearFieldError(id);
    }
    
    // Limpiar mensaje de éxito
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleBlur = (e) => {
    const { id, value } = e.target;
    
    let error = null;
    
    if (id === 'newPassword') {
      if (!value.trim()) {
        error = 'La contraseña es requerida';
      } else if (value.length < 8) {
        error = 'La contraseña debe tener al menos 8 caracteres';
      }
    } else if (id === 'confirmPassword') {
      if (!value.trim()) {
        error = 'Debe confirmar la contraseña';
      } else if (value !== values.newPassword) {
        error = 'Las contraseñas no coinciden';
      }
    }
    
    if (error) {
      setFieldError(id, error);
    } else {
      clearFieldError(id);
    }
  };

  const handleInvalid = (e) => {
    e.preventDefault();
    const { id, value } = e.target;
    
    let error = null;
    
    if (id === 'newPassword') {
      if (!value.trim()) {
        error = 'La contraseña es requerida';
      } else if (value.length < 8) {
        error = 'La contraseña debe tener al menos 8 caracteres';
      }
    } else if (id === 'confirmPassword') {
      if (!value.trim()) {
        error = 'Debe confirmar la contraseña';
      } else if (value !== values.newPassword) {
        error = 'Las contraseñas no coinciden';
      }
    }
    
    if (error) {
      setFieldError(id, error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearAllErrors();
    setGeneralError('');
    setSuccessMessage('');
    setFormSubmitted(true);

    // Validar todos los campos antes de enviar
    let formValid = true;
    
    // Validar nueva contraseña
    if (!values.newPassword.trim()) {
      setFieldError('newPassword', 'La contraseña es requerida');
      formValid = false;
    } else if (values.newPassword.length < 8) {
      setFieldError('newPassword', 'La contraseña debe tener al menos 8 caracteres');
      formValid = false;
    }
    
    // Validar confirmación de contraseña
    if (!values.confirmPassword.trim()) {
      setFieldError('confirmPassword', 'Debe confirmar la contraseña');
      formValid = false;
    } else if (values.confirmPassword !== values.newPassword) {
      setFieldError('confirmPassword', 'Las contraseñas no coinciden');
      formValid = false;
    }

    if (!formValid) return;

    setLoading(true);

    try {
      // Generar token de reCAPTCHA
      console.log("Generando token reCAPTCHA para reset_password");
      const recaptchaToken = await generateRecaptchaToken('reset_password');

      if (!recaptchaToken) {
        setGeneralError(recaptchaError || 'Error en la verificación de seguridad. Por favor, recargue la página e intente nuevamente.');
        setLoading(false);
        return;
      }

      const resetData = {
        token,
        newPassword: values.newPassword,
        recaptchaToken
      };

      const response = await API.post("/password/reset", resetData);

      if (response.data && response.data.success) {
        setSuccessMessage(response.data.message || "Contraseña restablecida con éxito.");
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setSuccessMessage("Contraseña restablecida con éxito.");
        setTimeout(() => navigate("/login"), 3000);
      }
    } catch (error) {
      console.error("Error al restablecer contraseña:", error);
      
      if (error.response?.data?.code === 'RECAPTCHA_FAILED') {
        setGeneralError("Verificación de seguridad fallida. Por favor, intenta nuevamente.");
      } else if (error.response) {
        const { data, status } = error.response;
        if (status === 400) {
          const errorCode = data.errorCode || "";
          switch(errorCode) {
            case "MISSING_TOKEN":
              setGeneralError("Token de recuperación no proporcionado.");
              break;
            case "MISSING_PASSWORD":
              setGeneralError("Debe proporcionar una nueva contraseña.");
              break;
            case "INVALID_TOKEN":
              setGeneralError("El token es inválido o ha expirado. Por favor solicite un nuevo enlace de recuperación.");
              break;
            case "SAME_PASSWORD":
              setGeneralError("La nueva contraseña no puede ser igual a la actual.");
              break;
            case "USER_NOT_FOUND":
              setGeneralError("No se encontró el usuario asociado al token.");
              break;
            default:
              setGeneralError(data.message || "Error al procesar la solicitud.");
          }
        } else if (status === 500) {
          setGeneralError("Error en el servidor. Por favor intente más tarde.");
        } else {
          setGeneralError(`Error (${status}): ${data.message || "Error desconocido"}`);
        }
      } else if (error.request) {
        setGeneralError("No se pudo conectar con el servidor. Verifique su conexión a internet.");
      } else {
        setGeneralError(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sección Izquierda - Imagen */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="flex items-center justify-center w-full p-8">
          <img 
            src={img} 
            alt="Reset Password" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      </div>

      {/* Sección Derecha - Formulario */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src={logo} 
              alt="Artesa Logo" 
              className="mx-auto h-16 w-auto mb-4"
            />
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Restablecer Contraseña
            </h2>
            <p className="text-gray-600">
              Ingresa tu nueva contraseña para continuar
            </p>
          </div>

          {/* Mensajes de estado */}
          {generalError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <BsFillShieldLockFill className="text-red-400 mr-2" />
                <span className="text-red-700 text-sm">{generalError}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <BsFillShieldLockFill className="text-green-400 mr-2" />
                <span className="text-green-700 text-sm">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nueva Contraseña */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Nueva Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={values.newPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onInvalid={handleInvalid}
                  required
                  className={`
                    block w-full pl-10 pr-10 py-3 border rounded-lg
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    transition duration-200 ease-in-out
                    ${errors.newPassword ? 'border-red-300' : 'border-gray-300'}
                  `}
                  placeholder="Ingresa tu nueva contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              <FormErrorMessage error={errors.newPassword} />
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BsFillShieldLockFill className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={values.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onInvalid={handleInvalid}
                  required
                  className={`
                    block w-full pl-10 pr-10 py-3 border rounded-lg
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    transition duration-200 ease-in-out
                    ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'}
                  `}
                  placeholder="Confirma tu nueva contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              <FormErrorMessage error={errors.confirmPassword} />
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={loading || !isRecaptchaReady}
              className={`
                w-full flex items-center justify-center py-3 px-4 border border-transparent
                rounded-lg shadow-sm text-sm font-medium text-white
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                transition duration-200 ease-in-out
                ${loading || !isRecaptchaReady
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Restableciendo...
                </>
              ) : (
                <>
                  Restablecer Contraseña
                  <TiArrowRightOutline className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Enlaces adicionales */}
          <div className="mt-6 text-center">
            <Link 
              to="/login" 
              className="text-sm text-blue-600 hover:text-blue-800 transition duration-200"
            >
              ← Volver al inicio de sesión
            </Link>
          </div>

          {/* Información de seguridad */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <BsFillShieldLockFill className="text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">Información de seguridad:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Tu contraseña debe tener al menos 8 caracteres</li>
                  <li>Recomendamos usar una combinación de letras, números y símbolos</li>
                  <li>Este enlace expirará después de su uso</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;