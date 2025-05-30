import { useState, useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { isDevelopment, isNgrok } from '../utils/environment';

// Hook personalizado para manejar reCAPTCHA
export const useRecaptcha = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  // Función para generar token de reCAPTCHA
  // Modificar en src/hooks/useRecaptcha.js
const generateRecaptchaToken = useCallback(async (action = 'submit') => {
  setLoading(true);
  setError(null);
  
  try {
    // Verificar si estamos en modo desarrollo y habilitar bypass
    if (isDevelopment || import.meta.env.DEV) {
      console.log(`Modo desarrollo detectado. Generando token de prueba para: ${action}`);
      setLoading(false);
      return 'dev-mode-bypass-token';
    }

    // Si no hay executeRecaptcha disponible
    if (!executeRecaptcha) {
      console.error('reCAPTCHA no está listo aún, verificar implementación');
      
      // En desarrollo, permitir un token de prueba
      if (isDevelopment || import.meta.env.DEV) {
        console.warn('MODO DESARROLLO: Generando token falso para reCAPTCHA');
        setLoading(false);
        return 'dev-mode-bypass-token';
      }
      
      setError('El sistema de seguridad aún se está cargando. Por favor, espere unos segundos y vuelva a intentarlo.');
      setLoading(false);
      return null;
    }
      
      console.log(`Ejecutando reCAPTCHA para acción: ${action}`);
      const token = await executeRecaptcha(action);
      console.log(`Token reCAPTCHA generado: ${token ? 'OK (longitud: ' + token.length + ')' : 'FALLO (sin token)'}`);
      
      if (!token) {
        // En desarrollo, permitir continuar sin token
        if (isDevelopment) {
          console.warn('MODO DESARROLLO: Continuando sin token reCAPTCHA');
          setLoading(false);
          return 'dev-mode-bypass-token';
        }
        
        setError('No se pudo completar la verificación de seguridad. Por favor, actualice la página e intente de nuevo.');
        setLoading(false);
        return null;
      }
      
      setLoading(false);
      return token;
    } catch (error) {
      console.error('Error al generar token reCAPTCHA:', error);
      
      // En desarrollo, permitir continuar a pesar del error
      if (isDevelopment) {
        console.warn('MODO DESARROLLO: Continuando con token de emergencia tras error');
        setLoading(false);
        return 'dev-mode-error-bypass-token';
      }
      
      setError('Error al verificar reCAPTCHA. Por favor, intenta nuevamente en unos momentos.');
      setLoading(false);
      return null;
    }
  }, [executeRecaptcha]);

  // Función simple para verificar si reCAPTCHA está disponible
  const isRecaptchaAvailable = useCallback(() => {
    return !!executeRecaptcha;
  }, [executeRecaptcha]);

  const isRecaptchaReady = useCallback(() => {
    return !!executeRecaptcha;
  }, [executeRecaptcha]);

  // Retornamos las funciones y estados que proporciona este hook
  return {
    generateRecaptchaToken,
    isRecaptchaAvailable,
    isRecaptchaReady,
    loading,
    error
  };
};

// Exportar por defecto también para compatibilidad
export default useRecaptcha;