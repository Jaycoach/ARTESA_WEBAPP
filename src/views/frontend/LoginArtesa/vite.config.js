import { defineConfig, loadEnv } from 'vite';
import tailwindcss from 'tailwindcss'
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
      // Hacer que todas las variables de entorno estén disponibles
      ...Object.keys(env).reduce((acc, key) => {
        if (key.startsWith('VITE_')) {
          acc[`import.meta.env.${key}`] = JSON.stringify(env[key]);
        }
        return acc;
      }, {})
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
      allowedHosts: ['.ngrok-free.app'],
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