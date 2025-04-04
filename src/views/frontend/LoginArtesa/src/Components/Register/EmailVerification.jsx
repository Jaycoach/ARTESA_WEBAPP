import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import API from '../../api/config';
import '../../App.scss';

// Componente para verificar el correo electrónico usando el token de la URL
const EmailVerification = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Función para verificar el token de correo electrónico
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token de verificación no proporcionado');
        return;
      }

      try {
        // Llamada a la API para verificar el correo electrónico
        const response = await API.get(`/auth/verify-email/${token}`);
        
        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message || 'Correo verificado con éxito');
          
          // Si hay un token de autenticación en la respuesta, lo guardamos
          if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            
            // Si hay información de usuario, la guardamos también
            if (response.data.user) {
              localStorage.setItem('user', JSON.stringify(response.data.user));
            }
          }
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Error al verificar el correo');
        }
      } catch (error) {
        console.error('Error al verificar el correo:', error);
        setStatus('error');
        setMessage(
          error.response?.data?.message || 
          'Error al verificar el correo. El enlace puede ser inválido o haber expirado.'
        );
      }
    };

    verifyEmail();
  }, [token]);

  // Redireccionar al login o dashboard después de un tiempo
  useEffect(() => {
    let timer;
    if (status === 'success') {
      timer = setTimeout(() => {
        const isAuthenticated = localStorage.getItem('token');
        navigate(isAuthenticated ? '/dashboard' : '/login');
      }, 5000); // Redireccionar después de 5 segundos
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#687e8d' }}>
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <FaSpinner className="text-5xl text-blue-500 animate-spin" />
              <h2 className="text-2xl font-bold text-gray-800">Verificando tu correo electrónico...</h2>
              <p className="text-gray-600">Por favor espera mientras confirmamos tu dirección.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <FaCheckCircle className="text-5xl text-green-500" />
              <h2 className="text-2xl font-bold text-green-700">¡Verificación Exitosa!</h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500">Serás redirigido automáticamente en unos segundos...</p>
              <div className="mt-4">
                <button 
                  onClick={() => navigate('/login')} 
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
                >
                  Ir al inicio de sesión
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <FaExclamationTriangle className="text-5xl text-red-500" />
              <h2 className="text-2xl font-bold text-red-700">Error de Verificación</h2>
              <p className="text-gray-600">{message}</p>
              <div className="mt-4 flex flex-col space-y-2">
                <button 
                  onClick={() => navigate('/resend-verification')} 
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                >
                  Reenviar correo de verificación
                </button>
                <button 
                  onClick={() => navigate('/login')} 
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;