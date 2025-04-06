import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Cargar variables de entorno según el modo
  const env = loadEnv(mode, process.cwd(), '');
  
  return defineConfig({
    plugins: [react(),
      tailwindcss(),
    ],
    define: {
      // Hacer que la variable de entorno de reCAPTCHA esté disponible globalmente
      'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(env.VITE_RECAPTCHA_SITE_KEY),
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
      // Configuración para mostrar warnings pero no hacer fallar la compilación
      hmr: {
        overlay: true,
      },
    },
    build: {
      // Generar source maps incluso en producción
      sourcemap: true,
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