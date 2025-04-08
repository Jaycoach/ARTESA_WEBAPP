import { useState, useCallback, useEffect } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

/**
 * Hook personalizado para manejar reCAPTCHA v3
 * @returns {Object} Funciones y estados para manejar reCAPTCHA
 */
export const useRecaptcha = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  
  // Verificar si reCAPTCHA está listo
  useEffect(() => {
    if (executeRecaptcha) {
      setIsRecaptchaReady(true);
    }
  }, [executeRecaptcha]);

  /**
   * Genera un token de reCAPTCHA para la acción especificada
   * @param {string} action - Nombre de la acción para reCAPTCHA (login, register, etc.)
   * @returns {Promise<string|null>} Token generado o null en caso de error
   */
  const generateRecaptchaToken = useCallback(async (action) => {
    setLoading(true);
    setError(null);
    
    try {
      // Verificar el entorno actual
      const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
      
      if (!executeRecaptcha) {
        console.error('reCAPTCHA no está listo aún');
        
        // Proporcionar un mensaje de error detallado
        if (isDevelopment) {
          setError('reCAPTCHA no está inicializado. Verifica que las variables de entorno estén configuradas correctamente.');
        } else {
          setError('El sistema de seguridad aún se está cargando. Por favor, espere unos segundos y vuelva a intentarlo.');
        }
        
        // Nunca generar tokens falsos - devolver null para indicar error
        return null;
      }
      
      console.log(`Ejecutando reCAPTCHA para acción: ${action}`);
      const token = await executeRecaptcha(action);
      console.log(`Token reCAPTCHA generado: ${token ? 'OK (token obtenido)' : 'FALLO (sin token)'}`);
      
      if (!token) {
        setError('No se pudo completar la verificación de seguridad. Por favor, actualice la página e intente de nuevo.');
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('Error al generar token reCAPTCHA:', error);
      setError('Error al verificar reCAPTCHA. Por favor, intenta nuevamente en unos momentos.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [executeRecaptcha]);

  return {
    generateRecaptchaToken,
    loading,
    error,
    isRecaptchaReady
  };
};

export default useRecaptcha;