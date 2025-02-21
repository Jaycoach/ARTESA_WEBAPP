import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: false
  },
  server: {
    open: true
  },
  build: {
    sourcemap: false
  },
  optimizeDeps: {
    exclude: ['css-loader']
  }
})