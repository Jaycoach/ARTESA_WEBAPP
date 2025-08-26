import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaPaperPlane, FaEnvelope, FaSpinner } from 'react-icons/fa';
import { BsBuilding } from 'react-icons/bs';
import { useRecaptcha } from "../../hooks/useRecaptcha";
import { useAuth } from "../../hooks/useAuth";
import AuthTypeSelector from "./../Login/AuthTypeSelector";
import { AUTH_TYPES } from "../../constants/AuthTypes";
import API from '../../api/config';

const ResendVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialEmail =
    location.state?.email || searchParams.get('email') || '';

  // ✅ DETECTAR TIPO DESDE URL O PERMITIR SELECCIÓN
  const initialType = searchParams.get('type') === 'branch' ? AUTH_TYPES.BRANCH : AUTH_TYPES.USER;

  const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError, isRecaptchaReady } = useRecaptcha();

  // ✅ USAR FUNCIONES DEL AUTHCONTEXT
  const { resendVerificationEmail, resendBranchVerification } = useAuth();

  const [authType, setAuthType] = useState(initialType);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const isBranchMode = authType === AUTH_TYPES.BRANCH;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isBlocked) return;
    if (!email) {
      setError('Por favor ingresa tu dirección de correo electrónico');
      return;
    }

    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      // ✅ GENERAR TOKEN DIFERENCIADO
      const actionType = isBranchMode ? 'branch_resend_verification' : 'resend_verification';
      console.log(`🔄 Generando token reCAPTCHA para ${actionType}`);

      const recaptchaToken = await generateRecaptchaToken(actionType);

      if (!recaptchaToken) {
        setError(recaptchaError || 'No se pudo completar la verificación de seguridad. Por favor, recargue la página e intente nuevamente.');
        setIsLoading(false);
        return;
      }

      console.log(`📧 Reenviando verificación ${isBranchMode ? 'BRANCH' : 'USER'} para:`, email);

      let result;

      if (isBranchMode) {
        // ✅ REENVÍO PARA BRANCH
        result = await resendBranchVerification(email, recaptchaToken);
      } else {
        // ✅ REENVÍO PARA USUARIO PRINCIPAL
        result = await resendVerificationEmail(email, recaptchaToken);
      }

      if (result.success !== false) {
        setSuccess(true);
        setMessage(result.message || `Correo de verificación ${isBranchMode ? 'de sucursal' : ''} enviado con éxito`);
        console.log(`✅ Reenvío de verificación ${isBranchMode ? 'Branch' : 'User'} exitoso`);
      } else {
        throw new Error(result.error || `Error al enviar correo de verificación ${isBranchMode ? 'de sucursal' : ''}`);
      }

    } catch (error) {
      console.error(`❌ Error reenviando verificación ${isBranchMode ? 'Branch' : 'User'}:`, error);

      // Manejar errores específicos
      if (error.response?.status === 429) {
        setIsBlocked(true);
        const retryAfter = error.response.headers['retry-after'] || 60;
        setCountdown(parseInt(retryAfter, 10));

        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              setIsBlocked(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        setError('Has excedido el límite de intentos. Por favor espera antes de intentar nuevamente.');
      } else {
        const errorMessage = error.response?.data?.message || error.message || `Error al enviar el correo de verificación${isBranchMode ? ' de sucursal' : ''}`;
        setError(errorMessage);

        // Incrementar contador de intentos
        setAttempts(prev => {
          const newAttempts = prev + 1;
          if (newAttempts >= 3) {
            setIsBlocked(true);
            setCountdown(30);

            const timer = setInterval(() => {
              setCountdown(prevCountdown => {
                if (prevCountdown <= 1) {
                  clearInterval(timer);
                  setIsBlocked(false);
                  setAttempts(0);
                  return 0;
                }
                return prevCountdown - 1;
              });
            }, 1000);
          }
          return newAttempts;
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#687e8d' }}>
        <div className="max-w-md w-full mx-auto bg-white p-8 rounded-xl shadow-lg">
          <div className="text-center">
            <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
              {isBranchMode ? (
                <BsBuilding className="text-4xl mx-auto mb-2" />
              ) : (
                <FaEnvelope className="text-4xl mx-auto mb-2" />
              )}
              <h2 className="text-xl font-bold">¡Correo Enviado!</h2>
              <p>{message}</p>
            </div>
            <p className="text-gray-600 mb-4">
              Hemos enviado un nuevo correo de verificación {isBranchMode ? 'de sucursal' : ''} a: <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Por favor revisa tu bandeja de entrada (y la carpeta de spam) para completar la verificación.
            </p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Ir al inicio de sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#687e8d' }}>
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center mb-6">
          {isBranchMode ? (
            <BsBuilding className="text-5xl text-blue-500 mx-auto mb-2" />
          ) : (
            <FaPaperPlane className="text-5xl text-blue-500 mx-auto mb-2" />
          )}
          <h2 className="text-2xl font-bold text-gray-800">
            Reenviar Correo de Verificación {isBranchMode ? 'de Sucursal' : ''}
          </h2>
          <p className="text-gray-600">
            Ingresa tu dirección de correo electrónico para recibir un nuevo enlace de verificación{isBranchMode ? ' de sucursal' : ''}.
          </p>
        </div>

        {/* ✅ SELECTOR DE TIPO DE USUARIO */}
        <div className="mb-4">
          <AuthTypeSelector
            selectedType={authType}
            onTypeChange={setAuthType}
            disabled={isLoading || isBlocked}
          />
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
            <p>{error}</p>
            {isBlocked && (
              <p className="mt-2">
                Podrás intentar nuevamente en: <span className="font-bold">{countdown}</span> segundos
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {isBranchMode ? 'Correo de la Sucursal' : 'Correo Electrónico'}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isBranchMode ? 'Correo de la sucursal' : 'Ingresa tu correo electrónico'}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading || isBlocked || recaptchaLoading}
            />
          </div>

          <button
            type="submit"
            className={`w-full flex justify-center items-center px-4 py-2 ${isLoading || isBlocked || recaptchaLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              } text-white rounded-md transition`}
            disabled={isLoading || isBlocked || recaptchaLoading}
          >
            {isLoading || recaptchaLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" /> Enviando...
              </>
            ) : isBlocked ? (
              `Espera ${countdown} segundos`
            ) : !isRecaptchaReady ? (
              "Cargando seguridad..."
            ) : (
              `Enviar Correo de Verificación${isBranchMode ? ' de Sucursal' : ''}`
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResendVerification;