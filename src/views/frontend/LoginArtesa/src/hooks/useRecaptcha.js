const generateRecaptchaToken = useCallback(async (action) => {
  setLoading(true);
  setError(null);
  
  try {
    // Verificar el entorno actual
    const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

    // Si estamos en desarrollo y se ha configurado el modo de desarrollo para reCAPTCHA
    if (isDevelopment && import.meta.env.VITE_RECAPTCHA_DEV_MODE === 'true') {
      console.log(`Modo desarrollo de reCAPTCHA activo. Generando token de prueba para: ${action}`);
      return 'development-test-token';
    }

    // Si estamos en desarrollo y hay problemas con reCAPTCHA, usar un token de prueba
    if (isDevelopment && (!executeRecaptcha || import.meta.env.VITE_RECAPTCHA_DEV_MODE === 'true')) {
      console.log('Usando token de prueba para desarrollo');
      return 'development-test-token';
    }
    
    if (!executeRecaptcha) {
      console.error('reCAPTCHA no está listo aún, verificar implementación');
      
      // En desarrollo, permitir un token de prueba
      if (isDevelopment) {
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
    
    return token;
  } catch (error) {
    console.error('Error al generar token reCAPTCHA:', error);
    
    // En desarrollo, permitir continuar a pesar del error
    const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
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