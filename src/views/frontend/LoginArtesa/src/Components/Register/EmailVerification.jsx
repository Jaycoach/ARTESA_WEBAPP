// components/auth/EmailVerification.jsx - VERSIÓN CORREGIDA
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaCheckCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { BsBuilding } from 'react-icons/bs';
import { useAuth } from '../../hooks/useAuth';
import API from '../../api/config';
import '../../App.scss';

const EmailVerification = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ DETECTAR TIPO DE USUARIO desde URL parameters
  const isBranchVerification = location.pathname.includes('branch-verify-email');
  const verificationType = isBranchVerification ? 'branch' : 'user';
  
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  // ✅ USAR FUNCIONES DEL AUTHCONTEXT
  const { verifyBranchEmail } = useAuth();
  const verificationAttempted = useRef(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (verificationAttempted.current) {
        return;
      }

      if (!token) {
        setStatus('error');
        setMessage('Token de verificación no proporcionado');
        return;
      }

      verificationAttempted.current = true;

      try {
        console.log(`🔄 Verificando email ${isBranchVerification ? 'BRANCH' : 'USER'} con token:`, token);

        if (isBranchVerification) {
          // ✅ VERIFICACIÓN DE BRANCH usando AuthContext
          const result = await verifyBranchEmail(token);

          if (result.success) {
            setStatus('success');
            setMessage(result.data?.message || 'Email de sucursal verificado exitosamente. Ya puedes iniciar sesión.');
            console.log('✅ Verificación de Branch exitosa');
          } else {
            throw new Error(result.error || 'Error verificando email de sucursal');
          }
        } else {
          // ✅ VERIFICACIÓN DE USUARIO PRINCIPAL (lógica existente)
          const response = await API.get(`/auth/verify-email/${token}`);

          if (response.status === 200) {
            setStatus('success');
            const successMessage = response.data?.message || 'Correo verificado con éxito';
            setMessage(successMessage);
            console.log('✅ Verificación de Usuario exitosa:', successMessage);

            // Guardar tokens si están disponibles
            if (response.data?.token) {
              localStorage.setItem('token', response.data.token);
              if (response.data?.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
              }
            }
          } else {
            throw new Error(response.data?.message || 'Error al verificar el correo');
          }
        }
      } catch (error) {
        console.error(`❌ Error verificando ${isBranchVerification ? 'Branch' : 'User'}:`, error);
        setStatus('error');

        let errorMessage = `Error al verificar el correo${isBranchVerification ? ' de sucursal' : ''}. El enlace puede ser inválido o haber expirado.`;

        if (error.response?.data?.message || error.message) {
          const apiMessage = error.response?.data?.message || error.message;

          // Casos especiales de éxito disfrazados de error
          if (
            error.response?.status === 200 ||
            apiMessage.includes('ya verificado') ||
            apiMessage.includes('already verified') ||
            apiMessage.includes('verificado exitosamente') ||
            apiMessage.includes('verificación exitosa') ||
            apiMessage.includes('cuenta activada') ||
            apiMessage.includes('sucursal activada')
          ) {
            setStatus('success');
            setMessage(apiMessage);
            return;
          }

          // Sin respuesta del servidor (red/timeout/certificado) o error 500 genérico:
          // el mensaje crudo no ayuda al usuario, así que se sugiere la causa más probable
          // en la práctica (enlace ya usado) en vez de un error técnico.
          const noResponse = !error.response;
          const isGenericServerError = error.response?.status === 500;

          if (noResponse || isGenericServerError) {
            errorMessage = 'El enlace ya fue utilizado o expiró. Si tu cuenta ya está activa, intenta iniciar sesión directamente.';
          } else {
            errorMessage = apiMessage;
          }
        }

        setMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [token, isBranchVerification, verifyBranchEmail]);

  // Redirección diferenciada por tipo de usuario
  useEffect(() => {
    let timer;
    if (status === 'success') {
      timer = setTimeout(() => {
        // ✅ REDIRECCIÓN ESPECÍFICA POR TIPO
        if (isBranchVerification) {
          navigate('/login', {
            state: { message: 'Email verificado. Ya puedes iniciar sesión como sucursal.' }
          });
        } else {
          const isAuthenticated = localStorage.getItem('token');
          navigate(isAuthenticated ? '/dashboard' : '/login');
        }
      }, 5000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, navigate, isBranchVerification]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#687e8d' }}>
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              {isBranchVerification ? (
                <BsBuilding className="text-5xl text-blue-500" />
              ) : (
                <FaSpinner className="text-5xl text-blue-500 animate-spin" />
              )}
              <h2 className="text-2xl font-bold text-gray-800">
                Verificando {isBranchVerification ? 'sucursal' : 'correo electrónico'}...
              </h2>
              <p className="text-gray-600">
                Por favor espera mientras confirmamos {isBranchVerification ? 'tu sucursal' : 'tu dirección'}.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <FaCheckCircle className="text-5xl text-green-500" />
              <h2 className="text-2xl font-bold text-green-700">
                ¡Verificación {isBranchVerification ? 'de Sucursal' : ''} Exitosa!
              </h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500">Serás redirigido automáticamente en unos segundos...</p>
              <div className="mt-4">
                <button
                  onClick={() => navigate(isBranchVerification ? '/login?type=branch' : '/login')}
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
                  onClick={() => navigate(`/resend-verification`)}
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