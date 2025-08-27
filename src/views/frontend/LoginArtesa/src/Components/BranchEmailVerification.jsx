// Components/BranchEmailVerification.jsx - Página para verificar token de email
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FaSpinner, FaCheckCircle, FaExclamationTriangle, FaEnvelope } from 'react-icons/fa';

// Import Assets
import logo from "../LoginsAssets/logo_artesa_new.png";

const BranchEmailVerification = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { verifyBranchEmail } = useAuth();

    const [verificationState, setVerificationState] = useState('verifying');
    const [verificationData, setVerificationData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setError('Token de verificación no válido');
                setVerificationState('error');
                return;
            }

            try {
                console.log('🔄 Verificando token de email:', token);
                
                const result = await verifyBranchEmail(token);
                
                if (result.success) {
                    console.log('✅ Email verificado exitosamente:', result.data);
                    setVerificationData(result.data);
                    setVerificationState('success');
                } else {
                    throw new Error(result.error || 'Error verificando email');
                }
            } catch (err) {
                console.error('❌ Error en verificación:', err);
                setError(err.message || 'Error verificando token de email');
                setVerificationState('error');
            }
        };

        verifyToken();
    }, [token, verifyBranchEmail]);

    const renderContent = () => {
        switch (verificationState) {
            case 'verifying':
                return (
                    <div className="text-center space-y-6">
                        <FaSpinner className="animate-spin text-5xl text-blue-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-gray-800">
                            Verificando Email
                        </h2>
                        <p className="text-gray-600">
                            Por favor espera mientras verificamos tu correo electrónico...
                        </p>
                    </div>
                );

            case 'success':
                return (
                    <div className="text-center space-y-6">
                        <FaCheckCircle className="text-5xl text-green-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-green-700">
                            ¡Email Verificado!
                        </h2>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-green-800 mb-2">
                                Tu correo electrónico ha sido verificado exitosamente.
                            </p>
                            {verificationData?.branch_name && (
                                <p className="text-sm text-green-700">
                                    Sucursal: <strong>{verificationData.branch_name}</strong>
                                </p>
                            )}
                            {verificationData?.email && (
                                <p className="text-sm text-green-700">
                                    Email: <strong>{verificationData.email}</strong>
                                </p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800">
                                Próximos Pasos
                            </h3>
                            
                            {/* ✅ SIEMPRE MOSTRAR OPCIÓN DE COMPLETAR REGISTRO */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-blue-800 mb-3">
                                    Tu email está verificado. Ahora puedes completar la configuración de tu sucursal.
                                </p>
                                <button
                                    onClick={() => navigate('/login', { 
                                        state: { 
                                            email: verificationData?.email,
                                            authType: 'branch',
                                            emailVerified: true,
                                            message: 'Email verificado exitosamente. Completa la configuración de tu sucursal.'
                                        }
                                    })}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Continuar con Configuración
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'error':
                return (
                    <div className="text-center space-y-6">
                        <FaExclamationTriangle className="text-5xl text-red-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-red-700">
                            Error de Verificación
                        </h2>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-800">{error}</p>
                        </div>
                        
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Volver al Login
                            </button>
                            
                            <button
                                onClick={() => navigate('/resend-verification?type=branch')}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Solicitar Nuevo Enlace
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#687e8d' }}>
            <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
                <div className="p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <img
                            src={logo}
                            alt="Logo Artesa"
                            className="h-16 mx-auto mb-4"
                        />
                        <h1 className="text-xl font-bold text-gray-800">
                            Verificación de Email
                        </h1>
                        <p className="text-gray-600 text-sm mt-2">
                            Sucursal - Artesa Panadería
                        </p>
                    </div>

                    {/* Content */}
                    {renderContent()}

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                        <p className="text-xs text-gray-500">
                            © 2025 Artesa Panadería. Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BranchEmailVerification;