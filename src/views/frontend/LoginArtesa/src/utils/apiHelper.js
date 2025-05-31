// Función helper para manejar requests HTTPS con certificados autofirmados
export const makeSecureRequest = async (url, options = {}) => {
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    
    // Si es un error de certificado, proporcionar instrucciones al usuario
    if (error.message.includes('certificate') || error.message.includes('SSL')) {
      console.warn('⚠️ Certificado SSL autofirmado detectado. El usuario debe aceptar el certificado manualmente.');
    }
    
    throw error;
  }
};

// Test de conectividad
export const testApiConnection = async () => {
  try {
    const result = await makeSecureRequest('https://ec2-44-216-131-63.compute-1.amazonaws.com/api/health');
    console.log('✅ API Connection successful:', result);
    return true;
  } catch (error) {
    console.error('❌ API Connection failed:', error);
    return false;
  }
};