import React, { useState, useEffect, useRef } from 'react';
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
  // Referencia para evitar verificaciones duplicadas
  const verificationAttempted = useRef(false);

  useEffect(() => {
    // Función para verificar el token de correo electrónico
    const verifyEmail = async () => {
    // Evitar doble verificación
    if (verificationAttempted.current) {
      return;
    }
    
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no proporcionado');
      return;
    }

    // Marcar la verificación como intentada
    verificationAttempted.current = true;

    try {
      // Llamada a la API para verificar el correo electrónico
      console.log("Verificando email con token:", token);
      const response = await API.get(`/auth/verify-email/${token}`);
      
      console.log("Respuesta completa de verify-email:", response);
      console.log("Status de respuesta:", response.status);
      console.log("Data de respuesta:", response.data);
      
      // Verificar si la respuesta es exitosa basándose en el status HTTP
      if (response.status === 200) {
        setStatus('success');
        // Usar el mensaje del servidor o uno por defecto
        const successMessage = response.data?.message || 'Correo verificado con éxito';
        setMessage(successMessage);
        console.log("Verificación de email exitosa:", successMessage);
        
        // Si hay un token de autenticación en la respuesta, lo guardamos
        if (response.data?.token) {
          localStorage.setItem('token', response.data.token);
          console.log("Token de autenticación guardado");
          
          // Si hay información de usuario, la guardamos también
          if (response.data?.user) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
            console.log("Información de usuario guardada");
          }
        }
      } else {
        // Si el status no es 200, tratar como error
        throw new Error(response.data?.message || 'Error al verificar el correo');
      }
    } catch (error) {
      console.error('Error completo al verificar el correo:', error);
      console.error('Response del error:', error.response);
      console.error('Data del error:', error.response?.data);
      
      setStatus('error');
      
      // Determinar el mensaje de error apropiado
      let errorMessage = 'Error al verificar el correo. El enlace puede ser inválido o haber expirado.';
      
      // Si hay un mensaje específico del servidor
      if (error.response?.data?.message) {
        const apiMessage = error.response.data.message;
        console.log("Mensaje de la API:", apiMessage, "Status:", error.response?.status);
        
        // Verificar si realmente es un error o una respuesta informativa
        if (
          error.response.status === 200 ||
          apiMessage.includes('ya verificado') ||
          apiMessage.includes('already verified') ||
          apiMessage.includes('verificado exitosamente') ||
          apiMessage.includes('verificación exitosa') ||
          apiMessage.includes('cuenta activada')
        ) {
          setStatus('success');
          setMessage(apiMessage);
          console.log("Convertido a éxito:", apiMessage);
          return;
        }
        
        errorMessage = apiMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage(errorMessage);
      console.log("Error en verificación de email:", errorMessage);
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