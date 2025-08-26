import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { useRecaptcha } from "../../hooks/useRecaptcha";
import { useFormValidation } from "../../hooks/useFormValidation";
import { useError } from "../../context/ErrorContext";
import { useAuth } from "../../hooks/useAuth"; // ✅ AGREGAR
import { AUTH_TYPES } from "../../constants/AuthTypes"; // ✅ AGREGAR
import FormErrorMessage from "../ui/FormErrorMessage";
import img from "../../LoginsAssets/principal_img.gif";
import logo from "../../LoginsAssets/logo_artesa_new.png";
import { BsFillShieldLockFill, BsBuilding } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import { FaLock, FaEye, FaEyeSlash } from "react-icons/fa";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ✅ DETECTAR TIPO DESDE URL
  const userType = searchParams.get('type') === 'branch' ? AUTH_TYPES.BRANCH : AUTH_TYPES.USER;
  const isBranchReset = userType === AUTH_TYPES.BRANCH;

  const { generateRecaptchaToken, error: recaptchaError, isRecaptchaReady } = useRecaptcha();
  const { values, setValues } = useFormValidation({ newPassword: '', confirmPassword: '' });
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useError();

  // ✅ USAR FUNCIONES DEL AUTHCONTEXT
  const { resetPassword, resetBranchPassword } = useAuth();

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ VERIFICAR TOKEN AL CARGAR
  useEffect(() => {
    if (!token) {
      setGeneralError('Token de restablecimiento no válido');
      setTimeout(() => navigate('/login'), 3000);
    }
  }, [token, navigate]);

  const handleChange = e => {
    const { id, value } = e.target;
    setValues({ ...values, [id]: value });
    if (errors[id]) clearFieldError(id);
    if (successMessage) setSuccessMessage('');
    if (generalError) setGeneralError('');
  };

  const handleBlur = e => {
    const { id, value } = e.target;
    let error = null;
    if (id === 'newPassword') {
      if (!value.trim()) error = 'La contraseña es requerida';
      else if (value.length < 8) error = 'La contraseña debe tener al menos 8 caracteres';
    } else if (id === 'confirmPassword') {
      if (!value.trim()) error = 'Debe confirmar la contraseña';
      else if (value !== values.newPassword) error = 'Las contraseñas no coinciden';
    }
    if (error) setFieldError(id, error);
    else clearFieldError(id);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    clearAllErrors();
    setGeneralError('');
    setSuccessMessage('');

    let valid = true;
    if (!values.newPassword.trim()) {
      setFieldError('newPassword', 'La contraseña es requerida');
      valid = false;
    } else if (values.newPassword.length < 8) {
      setFieldError('newPassword', 'La contraseña debe tener al menos 8 caracteres');
      valid = false;
    }
    if (!values.confirmPassword.trim()) {
      setFieldError('confirmPassword', 'Debe confirmar la contraseña');
      valid = false;
    } else if (values.confirmPassword !== values.newPassword) {
      setFieldError('confirmPassword', 'Las contraseñas no coinciden');
      valid = false;
    }

    if (!valid) return;

    setLoading(true);

    try {
      // ✅ TOKEN DIFERENCIADO POR TIPO
      const actionType = isBranchReset ? 'branch_reset_password' : 'reset_password';
      const recaptchaToken = await generateRecaptchaToken(actionType);

      if (!recaptchaToken) {
        setGeneralError(recaptchaError || 'Error en la verificación de seguridad.');
        setLoading(false);
        return;
      }

      console.log(`🔄 Restableciendo contraseña ${isBranchReset ? 'BRANCH' : 'USER'}`);

      let result;

      // ✅ USAR FUNCIÓN CORRECTA SEGÚN TIPO
      if (isBranchReset) {
        result = await resetBranchPassword(token, values.newPassword);
      } else {
        result = await resetPassword(token, values.newPassword, recaptchaToken);
      }

      if (result.success !== false) {
        const successMsg = result.message || `Contraseña ${isBranchReset ? 'de sucursal' : ''} restablecida con éxito.`;
        setSuccessMessage(successMsg);
        console.log(`✅ Reset ${isBranchReset ? 'Branch' : 'User'} exitoso`);

        // ✅ REDIRECCIÓN DIFERENCIADA
        setTimeout(() => {
          navigate('/login', {
            state: {
              message: `Contraseña ${isBranchReset ? 'de sucursal' : ''} actualizada. Ya puedes iniciar sesión.`,
              type: isBranchReset ? 'branch' : 'user'
            }
          });
        }, 2000);
      } else {
        throw new Error(result.error || `Error al restablecer contraseña${isBranchReset ? ' de sucursal' : ''}`);
      }

    } catch (error) {
      console.error(`❌ Error reset ${isBranchReset ? 'Branch' : 'User'}:`, error);
      const errorMessage = error.response?.data?.message || error.message ||
        `No se pudo restablecer la contraseña${isBranchReset ? ' de sucursal' : ''}. Intenta de nuevo.`;
      setGeneralError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#7a8fa2]">
      <div
        className={`
          flex flex-col md:flex-row w-full
          max-w-full md:max-w-4xl xl:max-w-5xl
          min-h-[520px] md:min-h-[560px] bg-white
          rounded-none md:rounded-2xl
          md:shadow-2xl md:border transition-all duration-200
          overflow-hidden
        `}
      >
        {/* Lado Imagen */}
        <div className={`
          hidden md:flex md:w-1/2 relative
          min-h-[560px]
          bg-[#d4dae4]
          rounded-none md:rounded-l-2xl
          overflow-hidden
        `}>
          <img
            src={img}
            alt="Reset Visual"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Formulario */}
        <div className={`
          flex flex-1 items-center justify-center py-8 px-4 sm:px-8 md:px-10 lg:px-16 bg-white
          rounded-none md:rounded-r-2xl
        `}>
          <div className="w-full max-w-[410px] mx-auto">
            {/* ✅ LOGO Y TÍTULOS DIFERENCIADOS */}
            <div className="text-center mb-6">
              <img src={logo} alt="Artesa Logo" className="h-14 mb-4 mx-auto" />
              <div className="flex items-center justify-center mb-2">
                {isBranchReset ? (
                  <BsBuilding className="text-2xl text-blue-500 mr-2" />
                ) : (
                  <FaLock className="text-2xl text-blue-500 mr-2" />
                )}
                <h2 className="font-semibold text-xl text-gray-800">
                  Restablecer Contraseña {isBranchReset ? 'de Sucursal' : ''}
                </h2>
              </div>
              <p className="text-sm text-gray-500">
                Ingresa tu nueva contraseña{isBranchReset ? ' de sucursal' : ''} para continuar
              </p>

              {/* ✅ INDICADOR DE TIPO */}
              {isBranchReset && (
                <div className="mt-2 inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  <BsBuilding className="w-3 h-3 mr-1" />
                  Cuenta de Sucursal
                </div>
              )}
            </div>

            {/* ✅ MENSAJES CON CONTEXTO */}
            {generalError && (
              <div className="mb-3 w-full bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 flex items-center text-xs">
                <BsFillShieldLockFill className="mr-2 text-red-400" />
                {generalError}
              </div>
            )}

            {successMessage && (
              <div className="mb-3 w-full bg-green-50 border border-green-200 text-green-700 rounded px-3 py-2 flex items-center text-xs">
                {isBranchReset ? (
                  <BsBuilding className="mr-2 text-green-400" />
                ) : (
                  <BsFillShieldLockFill className="mr-2 text-green-400" />
                )}
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              {/* Nueva contraseña */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="newPassword">
                  Nueva Contraseña{isBranchReset ? ' de Sucursal' : ''} *
                </label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={values.newPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className={`pl-10 pr-9 py-2 w-full rounded-lg border text-sm outline-none bg-[#f6db8e] focus:ring-2 focus:ring-[#478090] 
                      ${errors.newPassword ? "border-red-300" : "border-gray-300"}
                    `}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute top-1/2 right-3 -translate-y-1/2"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {showPassword
                      ? <FaEyeSlash className="h-4 w-4 text-gray-400" />
                      : <FaEye className="h-4 w-4 text-gray-400" />}
                  </button>
                </div>
                <FormErrorMessage message={errors.newPassword} />
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="confirmPassword">
                  Confirmar Contraseña *
                </label>
                <div className="relative">
                  <BsFillShieldLockFill className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={values.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    autoComplete="new-password"
                    placeholder="Repetir contraseña"
                    className={`pl-10 pr-9 py-2 w-full rounded-lg border text-sm outline-none bg-[#f6db8e] focus:ring-2 focus:ring-[#478090]
                      ${errors.confirmPassword ? "border-red-300" : "border-gray-300"}
                    `}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute top-1/2 right-3 -translate-y-1/2"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {showConfirmPassword
                      ? <FaEyeSlash className="h-4 w-4 text-gray-400" />
                      : <FaEye className="h-4 w-4 text-gray-400" />}
                  </button>
                </div>
                <FormErrorMessage message={errors.confirmPassword} />
              </div>

              {/* ✅ SUBMIT BUTTON DIFERENCIADO */}
              <button
                type="submit"
                disabled={loading || !isRecaptchaReady}
                className={`
                  w-full mt-2 flex items-center justify-center py-2 rounded-lg font-semibold text-white border-0 transition-all
                  ${loading || !isRecaptchaReady
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-[#478090] hover:bg-[#38667c]'}
                `}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Restableciendo...
                  </>
                ) : (
                  <>
                    Completar Restablecimiento{isBranchReset ? ' de Sucursal' : ''}
                    <TiArrowRightOutline className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Link volver */}
            <div className="w-full mt-4 text-center">
              <Link to="/login" className="text-sm text-[#215174] hover:underline font-medium">
                ← Volver al inicio de sesión
              </Link>
            </div>

            {/* ✅ INFORMACIÓN DE SEGURIDAD DIFERENCIADA */}
            <div className="w-full mt-4 px-3 py-2 text-[11px] bg-[#f3f4f6] border border-blue-100 text-blue-900 rounded-lg leading-tight">
              {isBranchReset ? (
                <BsBuilding className="inline mr-1 text-blue-400" />
              ) : (
                <BsFillShieldLockFill className="inline mr-1 text-blue-400" />
              )}
              <span className="font-semibold">Debe tener al menos 8 caracteres.</span>
              Usa letras, números y símbolos. Este enlace{isBranchReset ? ' de sucursal' : ''} expirará tras su primer uso.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;