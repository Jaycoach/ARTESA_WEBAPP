// Components/Login/EmailVerificationPending.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaSpinner, FaEnvelope, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

// Import Assets
import logo from "../../LoginsAssets/logo_artesa_new.png";

const EmailVerificationPending = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Aquí puedes agregar lógica adicional si necesitas verificar el estado del token
        if (token) {
            setMessage(`Token de verificación recibido. Procesando verificación...`);
        }
    }, [token]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <img
                        src={logo}
                        alt="Artesa Logo"
                        className="w-20 h-20 mx-auto mb-4"
                    />
                    <h1 className="text-2xl font-bold text-gray-800">
                        Verificación de Email
                    </h1>
                    <p className="text-gray-600 text-sm mt-2">
                        Esperando confirmación de verificación
                    </p>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    <div className="text-center">
                        <FaEnvelope className="text-4xl text-blue-500 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">
                            Verificación Pendiente
                        </h2>
                        <p className="text-gray-600 text-sm mb-4">
                            Hemos enviado un correo de verificación. Por favor revisa tu bandeja de entrada 
                            y haz clic en el enlace de verificación.
                        </p>
                        
                        {token && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    Token: {token.substring(0, 10)}...
                                </p>
                            </div>
                        )}

                        {message && (
                            <div className="bg-yellow-50 p-4 rounded-lg mt-4">
                                <p className="text-sm text-yellow-800">
                                    {message}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-800 mb-2">Próximos pasos:</h3>
                        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                            <li>Revisa tu bandeja de entrada (incluyendo spam)</li>
                            <li>Haz clic en el enlace de verificación</li>
                            <li>Serás redirigido automáticamente</li>
                        </ol>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            disabled={loading}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <FaSpinner className="animate-spin" />
                                    <span>Verificando...</span>
                                </>
                            ) : (
                                <>
                                    <FaCheckCircle />
                                    <span>Verificar Estado</span>
                                </>
                            )}
                        </button>

                        <Link
                            to="/login"
                            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-center block"
                        >
                            Volver al Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailVerificationPending;