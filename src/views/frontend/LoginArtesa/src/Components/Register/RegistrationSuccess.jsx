import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaEnvelope, FaCheckCircle } from 'react-icons/fa';
import '../../App.scss';

const RegistrationSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Obtener email de los parámetros de estado de ubicación
  const email = location.state?.email || 'tu dirección de correo';

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#687e8d' }}>
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mb-6">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <FaCheckCircle className="text-5xl text-green-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Registro Exitoso!</h2>
            <p className="text-gray-600">
              Tu cuenta ha sido creada correctamente. Hemos enviado un correo de verificación a:
            </p>
            <p className="font-medium text-blue-600 my-2">{email}</p>
          </div>

          <div className="bg-blue-50 p-5 rounded-lg mb-6 text-left">
            <div className="flex mb-3">
              <FaEnvelope className="text-xl text-blue-500 mr-2" />
              <h3 className="font-bold text-blue-800">Próximos pasos:</h3>
            </div>
            <ol className="list-decimal pl-5 text-gray-700 space-y-2">
              <li>Revisa tu bandeja de entrada y busca un correo de Artesa.</li>
              <li>Si no lo encuentras, revisa tu carpeta de spam o correo no deseado.</li>
              <li>Haz clic en el enlace de verificación que encontrarás en el correo.</li>
            </ol>
            <p className="mt-3 text-sm text-gray-600">
              Tu cuenta permanecerá limitada hasta que verifiques tu correo electrónico.
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <button 
              onClick={() => navigate('/login')} 
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Ir al inicio de sesión
            </button>
            <button 
              onClick={() => navigate('/resend-verification')} 
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
            >
              Reenviar correo de verificación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationSuccess;