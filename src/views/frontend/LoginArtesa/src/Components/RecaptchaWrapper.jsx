import React, { useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { RecaptchaProvider } from '../hooks/useRecaptcha';

const RecaptchaWrapper = ({ children }) => {
    const recaptchaRef = useRef();

    // Obtener la site key desde variables de entorno
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
        console.warn('[RECAPTCHA] Site key no encontrada en variables de entorno');
        // En desarrollo, permitir continuar sin reCAPTCHA
        if (import.meta.env.DEV) {
            return (
                <RecaptchaProvider recaptchaRef={null}>
                    {children}
                </RecaptchaProvider>
            );
        }
    }

    return (
        <RecaptchaProvider recaptchaRef={recaptchaRef}>
            {children}
            {/* reCAPTCHA invisible - se ejecuta programáticamente */}
            {siteKey && (
                <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={siteKey}
                    size="invisible"
                    onLoad={() => console.log('[RECAPTCHA] reCAPTCHA cargado exitosamente')}
                    onError={(error) => console.error('[RECAPTCHA] Error al cargar:', error)}
                />
            )}
        </RecaptchaProvider>
    );
};

export default RecaptchaWrapper;
