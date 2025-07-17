import { useState, useCallback, useRef, useContext, createContext } from 'react';
import { isDevelopment, isNgrok } from '../utils/environment';

// Contexto para manejar la referencia del reCAPTCHA globalmente
const RecaptchaContext = createContext(null);

// Provider para el contexto de reCAPTCHA
export const RecaptchaProvider = ({ children, recaptchaRef }) => {
  return (
    <RecaptchaContext.Provider value={recaptchaRef}>
      {children}
    </RecaptchaContext.Provider>
  );
};

// Hook personalizado para manejar reCAPTCHA con react-google-recaptcha
export const useRecaptcha = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener la referencia del contexto
  const recaptchaRef = useContext(RecaptchaContext);

  // Función para generar token de reCAPTCHA
  const generateRecaptchaToken = useCallback(async (action = 'submit') => {
    setLoading(true);
    setError(null);

    try {
      // Verificar si estamos en modo desarrollo y habilitar bypass
      if (isDevelopment || import.meta.env.DEV) {
        console.log(`[RECAPTCHA] Modo desarrollo detectado. Generando token de prueba para: ${action}`);
        setLoading(false);
        return 'dev-mode-bypass-token';
      }

      // Verificar si la referencia del reCAPTCHA está disponible
      if (!recaptchaRef || !recaptchaRef.current) {
        console.error('[RECAPTCHA] Referencia de reCAPTCHA no está disponible');

        // En desarrollo, permitir un token de prueba
        if (isDevelopment || import.meta.env.DEV) {
          console.warn('[RECAPTCHA] MODO DESARROLLO: Generando token falso para reCAPTCHA');
          setLoading(false);
          return 'dev-mode-bypass-token';
        }

        setError('El sistema de seguridad aún se está cargando. Por favor, espere unos segundos y vuelva a intentarlo.');
        setLoading(false);
        return null;
      }

      console.log(`[RECAPTCHA] Ejecutando reCAPTCHA para acción: ${action}`);

      // Ejecutar reCAPTCHA usando el método executeAsync de la nueva librería
      const token = await recaptchaRef.current.executeAsync();

      console.log(`[RECAPTCHA] Token generado: ${token ? 'OK (longitud: ' + token.length + ')' : 'FALLO (sin token)'}`);

      if (!token) {
        // En desarrollo, permitir continuar sin token
        if (isDevelopment || import.meta.env.DEV) {
          console.warn('[RECAPTCHA] MODO DESARROLLO: Continuando sin token reCAPTCHA');
          setLoading(false);
          return 'dev-mode-bypass-token';
        }

        setError('No se pudo completar la verificación de seguridad. Por favor, actualice la página e intente de nuevo.');
        setLoading(false);
        return null;
      }

      // Reset reCAPTCHA para uso futuro
      recaptchaRef.current.reset();

      setLoading(false);
      return token;

    } catch (error) {
      console.error('[RECAPTCHA] Error al generar token:', error);

      // En desarrollo, permitir continuar a pesar del error
      if (isDevelopment || import.meta.env.DEV) {
        console.warn('[RECAPTCHA] MODO DESARROLLO: Continuando con token de emergencia tras error');
        setLoading(false);
        return 'dev-mode-error-bypass-token';
      }

      setError('Error al verificar reCAPTCHA. Por favor, intenta nuevamente en unos momentos.');
      setLoading(false);
      return null;
    }
  }, [recaptchaRef]);

  // Función para verificar si reCAPTCHA está disponible
  const isRecaptchaAvailable = useCallback(() => {
    return !!(recaptchaRef && recaptchaRef.current);
  }, [recaptchaRef]);

  // Función para verificar si reCAPTCHA está listo
  const isRecaptchaReady = useCallback(() => {
    return !!(recaptchaRef && recaptchaRef.current);
  }, [recaptchaRef]);

  // Función para resetear reCAPTCHA manualmente
  const resetRecaptcha = useCallback(() => {
    if (recaptchaRef && recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
  }, [recaptchaRef]);

  // Retornamos las funciones y estados que proporciona este hook
  return {
    generateRecaptchaToken,
    isRecaptchaAvailable,
    isRecaptchaReady,
    resetRecaptcha,
    loading,
    error
  };
};

// Exportar por defecto también para compatibilidad
export default useRecaptcha;