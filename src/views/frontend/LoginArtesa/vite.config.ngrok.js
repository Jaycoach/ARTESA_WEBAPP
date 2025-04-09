import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import path from 'path';

// Configuración específica para ngrok
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Asegurar que estas variables estén disponibles en el frontend
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL ),
    'import.meta.env.VITE_USE_NGROK': JSON.stringify('true'),
    'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(process.env.VITE_RECAPTCHA_SITE_KEY),
  },
  server: {
    hmr: {
        overlay: true,
        clientPort: 443,
        host: 'all',
    },
    host: true,
    cors: true,
    strictPort: true,
    allowedHosts: ['localhost', '.ngrok-free.app'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/Components'),
      '@assets': path.resolve(__dirname, 'src/LoginsAssets'),
    },
  },
});