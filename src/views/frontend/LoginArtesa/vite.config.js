import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: false, // ← Añade esta línea
  },
  build: {
    sourcemap: false, // ← Añade esta línea también para producción
  },
});
