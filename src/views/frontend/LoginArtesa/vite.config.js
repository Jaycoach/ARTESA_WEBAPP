import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

// Usamos esta técnica para obtener el directorio actual en ESM
const __filename = fileURLToPath(import.meta.url)
// El directorio donde se encuentra el archivo vite.config.js
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  
  css: {
    // Desactivamos los sourcemaps para CSS en desarrollo para evitar errores
    devSourcemap: false,
    preprocessorOptions: {
      scss: {
        // Si necesitas compilar SCSS, puedes agregar opciones aquí
      }
    }
  },
  
  // Configuramos las rutas relativas al frontend
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'assets': path.resolve(__dirname, './src/LoginsAssets'),
      'components': path.resolve(__dirname, './src/Components')
    }
  },
  
  // Importante: indicamos el directorio base correcto
  root: __dirname,
  
  build: {
    // Desactivamos sourcemaps para evitar errores
    sourcemap: false,
    outDir: 'dist',
    assetsDir: 'assets'
  },
  
  // Configuración del servidor de desarrollo
  server: {
    port: 5173,
    open: true,
    // Esto evita conflictos de CORS con tu API de backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})