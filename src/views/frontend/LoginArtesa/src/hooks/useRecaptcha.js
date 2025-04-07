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
      if (!executeRecaptcha) {
        console.error('reCAPTCHA no está listo aún');
        setError('El sistema de seguridad aún se está cargando. Por favor, espere unos segundos y vuelva a intentarlo.');
        return null;
      }
      
      console.log(`Ejecutando reCAPTCHA para acción: ${action}`);
      const token = await executeRecaptcha(action);
      console.log(`Token reCAPTCHA generado: ${token ? 'OK (token obtenido)' : 'FALLO (sin token)'}`);
      
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