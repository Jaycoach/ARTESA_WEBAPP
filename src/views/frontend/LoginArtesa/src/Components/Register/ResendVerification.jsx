import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPaperPlane, FaEnvelope, FaSpinner } from 'react-icons/fa';
import { useRecaptcha } from "../../hooks/useRecaptcha"; // Importar el hook de reCAPTCHA
import API from '../../api/config';
import '../../App.scss';

const ResendVerification = () => {
  const navigate = useNavigate();
  const { generateRecaptchaToken, loading: recaptchaLoading, error: recaptchaError, isRecaptchaReady } = useRecaptcha();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Contador para el límite de intentos
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isBlocked) {
      return;
    }
    
    if (!email) {
      setError('Por favor ingresa tu dirección de correo electrónico');
      return;
    }
    
    setError('');
    setMessage('');
    setIsLoading(true);
    
    try {
      // Generar token de reCAPTCHA
      console.log("Generando token reCAPTCHA para resend_verification");
      const recaptchaToken = await generateRecaptchaToken('resend_verification');
      
      if (!recaptchaToken) {
        setError(recaptchaError || 'No se pudo completar la verificación de seguridad. Por favor, recargue la página e intente nuevamente.');
        console.error("No se pudo obtener token reCAPTCHA para resend_verification");
        setIsLoading(false);
        return;
      }

      console.log("Token reCAPTCHA obtenido correctamente para resend_verification");

        console.log("Enviando solicitud de reenvío de verificación con token reCAPTCHA");
        const response = await API.post('/auth/resend-verification', { 
            mail: email,
            recaptchaToken
        });
      
        if (response.data.success) {
          setSuccess(true);
          setMessage(response.data.message || 'Correo de verificación enviado con éxito');
      } else {
          setError(response.data.message || 'Error al enviar el correo de verificación');
      }
    } catch (error) {
      console.error('Error al reenviar verificación:', error);
      
      // Manejo de errores específicos de reCAPTCHA
      if (error.response?.data?.code === 'RECAPTCHA_FAILED') {
        setError('Verificación de seguridad fallida. Por favor, intenta nuevamente.');
      } 
      // Manejar error de límite de intentos (429)
      else if (error.response && error.response.status === 429) {
        setIsBlocked(true);
        // Obtener el tiempo de espera de las cabeceras o usar un valor predeterminado
        const retryAfter = error.response.headers['retry-after'] || 60;
        setCountdown(parseInt(retryAfter, 10));
        
        // Iniciar cuenta regresiva
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
        setError(error.response?.data?.message || 'Error al enviar el correo de verificación');
        
        // Incrementar contador de intentos
        setAttempts(prev => prev + 1);
        
        // Bloquear después de 3 intentos
        if (attempts >= 2) { // Bloquear en el tercer intento (índice 2)
          setIsBlocked(true);
          setCountdown(30); // 30 segundos de bloqueo
          
          const timer = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(timer);
                setIsBlocked(false);
                setAttempts(0);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
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
              <FaEnvelope className="text-4xl mx-auto mb-2" />
              <h2 className="text-xl font-bold">¡Correo Enviado!</h2>
              <p>{message}</p>
            </div>
            <p className="text-gray-600 mb-4">
              Hemos enviado un nuevo correo de verificación a: <strong>{email}</strong>
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
          <FaPaperPlane className="text-5xl text-blue-500 mx-auto mb-2" />
          <h2 className="text-2xl font-bold text-gray-800">Reenviar Correo de Verificación</h2>
          <p className="text-gray-600">Ingresa tu dirección de correo electrónico para recibir un nuevo enlace de verificación.</p>
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
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ingresa tu correo electrónico"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading || isBlocked || recaptchaLoading}
            />
          </div>

          <button
            type="submit"
            className={`w-full flex justify-center items-center px-4 py-2 ${
                isLoading || isBlocked || recaptchaLoading
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
                'Enviar Correo de Verificación'
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