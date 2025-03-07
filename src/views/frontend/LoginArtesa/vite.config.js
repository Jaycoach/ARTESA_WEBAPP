import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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