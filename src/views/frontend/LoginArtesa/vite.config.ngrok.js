import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import path from 'path';

// Configuración específica para ngrok
export default ({ mode }) => {
  // Cargar variables de entorno según el modo
  console.log(`Iniciando en modo: ${mode}`);
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log("API URL:", env.VITE_API_URL);
  console.log("Modo ngrok:", env.VITE_USE_NGROK);

  return defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
      // Asegurar que estas variables estén disponibles en el frontend
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'https://6a22-91-126-42-32.ngrok-free.app'),
      'import.meta.env.VITE_USE_NGROK': JSON.stringify('true'),
      'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(env.VITE_RECAPTCHA_SITE_KEY),
      'import.meta.env.VITE_API_PATH': JSON.stringify(env.VITE_API_PATH || '/api'),
      'import.meta.env.VITE_DEBUG_API': JSON.stringify('true'),
    },
    server: {
      hmr: {
        overlay: true,
      },
      host: true,
      cors: true,
      strictPort: true,
      allowedHosts: 'all', // Más permisivo para evitar problemas
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/Components'),
        '@assets': path.resolve(__dirname, 'src/LoginsAssets'),
      },
    },
  });
};