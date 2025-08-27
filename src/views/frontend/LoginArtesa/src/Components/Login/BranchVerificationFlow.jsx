// Components/Login/BranchVerificationFlow.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBuilding, FaEnvelope, FaSpinner, FaExclamationTriangle, FaCheck } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useRecaptcha } from '../../hooks/useRecaptcha';

const BranchVerificationFlow = ({ 
    email, 
    onBack, 
    onComplete, 
    initialStep = 'check' 
}) => {
    const navigate = useNavigate();
    const { 
        checkBranchRegistration, 
        initiateBranchEmailVerification,
        resendBranchVerification 
    } = useAuth();
    const { generateRecaptchaToken, isRecaptchaReady } = useRecaptcha();

    // Estados del flujo
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [branchInfo, setBranchInfo] = useState(null);
    const [verificationSent, setVerificationSent] = useState(false);
    const [resendAttempts, setResendAttempts] = useState(0);
    const [cooldownTime, setCooldownTime] = useState(0);

    // Cooldown para reenvío
    useEffect(() => {
        let interval;
        if (cooldownTime > 0) {
            interval = setInterval(() => {
                setCooldownTime(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [cooldownTime]);

    // Función principal para verificar el estado de la sucursal
    const checkBranchStatus = async () => {
        setLoading(true);
        setError('');

        try {
            console.log('🔍 Verificando estado de sucursal para:', email);

            const result = await checkBranchRegistration(email);
            
            if (result.success) {
                const data = result.data;
                setBranchInfo(data);

                console.log('📊 Estado de sucursal:', data);

                // Determinar el siguiente paso basado en el estado
                if (!data.email_verified && data.needsEmailVerification) {
                    setCurrentStep('needs-verification');
                } else if (data.email_verified && !data.hasPassword) {
                    // Email verificado pero necesita contraseña
                    onComplete?.('needs-password', data);
                } else if (data.email_verified && data.hasPassword) {
                    // Todo listo para login
                    onComplete?.('ready-login', data);
                } else {
                    setCurrentStep('needs-verification');
                }
            } else {
                throw new Error(result.error || 'Error verificando sucursal');
            }
        } catch (error) {
            console.error('❌ Error verificando sucursal:', error);
            setError('No se pudo verificar el estado de la sucursal. Inténtalo nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    // Enviar correo de verificación
    const sendVerificationEmail = async () => {
        if (!isRecaptchaReady) {
            setError('Sistema de verificación no disponible. Recarga la página.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Generar token reCAPTCHA
            const recaptchaToken = await generateRecaptchaToken('branch_initiate_verification');
            
            if (!recaptchaToken) {
                throw new Error('No se pudo completar la verificación de seguridad');
            }

            console.log('📧 Enviando correo de verificación a:', email);

            const result = await initiateBranchEmailVerification(email, recaptchaToken);
            
            if (result.success) {
                setVerificationSent(true);
                setCurrentStep('email-sent');
                console.log('✅ Correo de verificación enviado');
            } else {
                throw new Error(result.error || 'Error enviando correo de verificación');
            }
        } catch (error) {
            console.error('❌ Error enviando verificación:', error);
            setError(error.message || 'Error enviando correo de verificación');
        } finally {
            setLoading(false);
        }
    };

    // Reenviar correo de verificación
    const resendVerification = async () => {
        if (cooldownTime > 0 || resendAttempts >= 3) return;

        setLoading(true);
        setError('');

        try {
            const recaptchaToken = await generateRecaptchaToken('branch_resend_verification');
            
            if (!recaptchaToken) {
                throw new Error('No se pudo completar la verificación de seguridad');
            }

            const result = await resendBranchVerification(email, recaptchaToken);
            
            if (result.success) {
                setResendAttempts(prev => prev + 1);
                setCooldownTime(60); // 1 minuto de cooldown
                setError('');
                console.log('✅ Correo reenviado exitosamente');
            } else {
                throw new Error(result.error || 'Error reenviando correo');
            }
        } catch (error) {
            console.error('❌ Error reenviando:', error);
            setError(error.message || 'Error reenviando correo de verificación');
        } finally {
            setLoading(false);
        }
    };

    // Efectos
    useEffect(() => {
        if (currentStep === 'check' && email) {
            checkBranchStatus();
        }
    }, [email, currentStep]);

    // Renderizado del componente
    const renderStep = () => {
        switch (currentStep) {
            case 'check':
                return (
                    <div className="text-center space-y-4">
                        <FaSpinner className="animate-spin text-4xl text-blue-500 mx-auto" />
                        <h3 className="text-lg font-semibold">Verificando Sucursal</h3>
                        <p className="text-gray-600">
                            Estamos verificando el estado de tu sucursal...
                        </p>
                    </div>
                );

            case 'needs-verification':
                return (
                    <div className="space-y-4">
                        <div className="text-center">
                            <FaBuilding className="text-4xl text-blue-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold">Verificación de Email Requerida</h3>
                            <p className="text-gray-600">
                                Tu sucursal <strong>{branchInfo?.branch_name}</strong> necesita 
                                verificar su correo electrónico antes de continuar.
                            </p>
                        </div>
                        
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Email:</strong> {email}
                            </p>
                            {branchInfo?.branch_name && (
                                <p className="text-sm text-blue-800">
                                    <strong>Sucursal:</strong> {branchInfo.branch_name}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={sendVerificationEmail}
                            disabled={loading}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <FaSpinner className="animate-spin" />
                                    <span>Enviando...</span>
                                </>
                            ) : (
                                <>
                                    <FaEnvelope />
                                    <span>Enviar Correo de Verificación</span>
                                </>
                            )}
                        </button>
                    </div>
                );

            case 'email-sent':
                return (
                    <div className="space-y-4">
                        <div className="text-center">
                            <FaEnvelope className="text-4xl text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-green-700">
                                ¡Correo Enviado!
                            </h3>
                            <p className="text-gray-600">
                                Se ha enviado un correo de verificación a:
                            </p>
                            <p className="font-semibold text-blue-600">{email}</p>
                        </div>

                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-yellow-800 mb-2">Próximos pasos:</h4>
                            <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
                                <li>Revisa tu bandeja de entrada (y spam/promociones)</li>
                                <li>Haz clic en el enlace de verificación</li>
                                <li>Regresa aquí para completar el proceso</li>
                            </ol>
                            <button
                                onClick={() => checkBranchStatus()}
                                disabled={loading}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mb-3"
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        <span>Verificando...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaCheck />
                                        <span>Ya verifiqué mi email</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={resendVerification}
                                disabled={loading || cooldownTime > 0 || resendAttempts >= 3}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cooldownTime > 0 
                                    ? `Reenviar en ${cooldownTime}s`
                                    : resendAttempts >= 3 
                                        ? 'Límite alcanzado'
                                        : 'Reenviar Correo'
                                }
                            </button>
                            
                            <button
                                onClick={() => navigate('/resend-verification?type=branch&email=' + encodeURIComponent(email))}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Más Opciones
                            </button>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="text-center space-y-4">
                        <FaExclamationTriangle className="text-4xl text-red-500 mx-auto" />
                        <h3 className="text-lg font-semibold text-red-700">Estado Desconocido</h3>
                        <p className="text-gray-600">
                            Ha ocurrido un error inesperado. Por favor, inténtalo nuevamente.
                        </p>
                        <button
                            onClick={() => setCurrentStep('check')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Reintentar
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                    Verificación de Sucursal
                </h2>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Step Content */}
            {renderStep()}

            {/* Back Button */}
            <div className="mt-6 pt-4 border-t">
                <button
                    onClick={onBack}
                    className="w-full px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                    ← Volver al inicio de sesión
                </button>
            </div>
        </div>
    );
};

export default BranchVerificationFlow;