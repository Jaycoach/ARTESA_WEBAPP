export const isProduction = import.meta.env.MODE === 'production';
export const isStaging = import.meta.env.MODE === 'staging';
export const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.MODE === 'ngrok';
export const isNgrok = import.meta.env.VITE_USE_NGROK === 'true';

export const getApiUrl = () => import.meta.env.VITE_API_URL;
export const getAppVersion = () => import.meta.env.VITE_APP_VERSION;

// Puedes usarlo para mostrar información de depuración
export const logEnvironmentInfo = () => {
  if (isDevelopment) {
    console.log('Modo:', import.meta.env.MODE);
    console.log('API URL:', getApiUrl());
    console.log('Versión:', getAppVersion());
    console.log('Ngrok activo:', isNgrok);
  }
};