import { useState, useCallback } from 'react';

/**
 * Hook personalizado para manejar reCAPTCHA v3
 * @returns {Object} Funciones y estados para manejar reCAPTCHA
 */
export const useRecaptcha = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Genera un token de reCAPTCHA para la acción especificada
   * @param {string} action - Nombre de la acción para reCAPTCHA (login, register, etc.)
   * @returns {Promise<string|null>} Token generado o null en caso de error
   */
  const generateRecaptchaToken = useCallback(async (action) => {
    setLoading(true);
    setError(null);
    
    try {
      // Verificar si grecaptcha está disponible
      if (!window.grecaptcha || !window.grecaptcha.execute) {
        console.error('reCAPTCHA no está disponible');
        setError('reCAPTCHA no está disponible. Por favor, recarga la página.');
        return null;
      }
      
      // Obtener la clave del sitio desde las variables de entorno
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      
      if (!siteKey) {
        console.error('Clave de sitio reCAPTCHA no configurada');
        setError('Error de configuración de reCAPTCHA');
        return null;
      }
      
      // Generar el token de reCAPTCHA
      const token = await window.grecaptcha.execute(siteKey, { action });
      return token;
    } catch (error) {
      console.error('Error al generar token reCAPTCHA:', error);
      setError('Error al verificar reCAPTCHA. Por favor, intenta nuevamente.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generateRecaptchaToken,
    loading,
    error,
  };
};

export default useRecaptcha;