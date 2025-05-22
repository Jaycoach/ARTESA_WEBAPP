import { defineConfig, loadEnv } from 'vite';
import tailwindcss from 'tailwindcss'
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Cargar variables de entorno según el modo
  console.log(`Iniciando en modo: ${mode}`);
  const env = loadEnv(mode, process.cwd(), '');
  
  // Forzar configuración para ngrok
  if (mode === 'ngrok') {
    console.log('Forzando configuración para modo ngrok');
    env.VITE_USE_NGROK = 'true';
    env.VITE_API_PATH = env.VITE_API_PATH || '/api';
  }

  return defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
      // Definir explícitamente las variables más importantes
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.VITE_USE_NGROK': JSON.stringify(env.VITE_USE_NGROK),
      'import.meta.env.VITE_NGROK_URL': JSON.stringify(env.VITE_NGROK_URL),
      'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(env.VITE_RECAPTCHA_SITE_KEY),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME),
      'import.meta.env.VITE_API_PATH': JSON.stringify(env.VITE_API_PATH || '/api'),
    },

    theme: {
      extend: {
        colors: {
          primary: 'var(--primary-color)',
          secondary: 'var(--secondary-color)',
          hover: 'var(--hover-color)',
          accent: 'var(--accent-color)',
          white: 'var(--whiteColor)',
          black: 'var(--blackColor)',
          grey: 'var(--greyText)',
          bg: 'var(--bgColor)',
          input: 'var(--inputColor)',
          button: 'var(--buttonColor)',
        },
        fontSize: {
          biggest: 'var(--biggestFontSize)',
          h1: 'var(--h1FontSize)',
          h2: 'var(--h2FontSize)',
          h3: 'var(--h3FontSize)',
          normal: 'var(--normalFontSize)',
          small: 'var(--smallFontSize)',
          smallest: 'var(--smallestFontSize)',
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Habilitar source maps para SCSS
          sourceMap: true,
          // Evitar minimización en desarrollo
          outputStyle: 'expanded',
        }
      },
      // Configuración global para CSS modules y source maps
      devSourcemap: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/Components'),
        '@assets': path.resolve(__dirname, 'src/LoginsAssets'),
      },
    },
    server: {
      hmr: {
        overlay: true,
        host: 'all',
        clientPort: 443,
        protocol: 'wss'
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false
        }
      },
      host: true,
      cors: true,
      strictPort: false,
      allowedHosts: 'all'
    },
    build: {
      // Generar source maps incluso en producción
      sourcemap: mode !== 'production',
      // Opciones específicas para producción
      ...(mode === 'production' && {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        },
      }),
      // Opciones de rollup para manejo de errores
      rollupOptions: {
        onwarn(warning, warn) {
          // Ignorar advertencias específicas si es necesario
          if (warning.code === 'SOURCEMAP_ERROR') return;
          warn(warning);
        },
      },
    },
  });
};