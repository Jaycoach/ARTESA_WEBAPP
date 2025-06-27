import { defineConfig, loadEnv } from 'vite';
import tailwindcss from 'tailwindcss'
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Cargar variables de entorno según el modo
  console.log(`Iniciando en modo: ${mode}`);
  const env = loadEnv(mode, process.cwd(), '');
  
  // Añadir configuración específica para AWS
  if (mode === 'staging') {
    env.VITE_API_URL = env.VITE_STAGING_API_URL || 'https://ec2-44-216-131-63.compute-1.amazonaws.com';
  }

  if (mode === 'production') {
    env.VITE_API_URL = env.VITE_PROD_API_URL || 'https://api.tudominio.com';
  }
  // Forzar configuración para ngrok
  if (mode === 'ngrok') {
    console.log('Forzando configuración para modo ngrok');
    env.VITE_USE_NGROK = 'true';
    env.VITE_API_PATH = env.VITE_API_PATH || '/api';
  }

  return defineConfig({
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      exclude: []
    },
    esbuild: {
      target: 'es2020'
    },
    define: {
      // Definir explícitamente las variables más importantes
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.VITE_USE_NGROK': JSON.stringify(env.VITE_USE_NGROK),
      'import.meta.env.VITE_NGROK_URL': JSON.stringify(env.VITE_NGROK_URL),
      'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(env.VITE_RECAPTCHA_SITE_KEY),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME),
      'import.meta.env.VITE_API_PATH': JSON.stringify(env.VITE_API_PATH || '/api'),
      'import.meta.env.VITE_FRONTEND_URL': JSON.stringify(env.VITE_FRONTEND_URL),
      '__MODE__': JSON.stringify(mode),
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
          target: 'https://ec2-44-216-131-63.compute-1.amazonaws.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('❌ Proxy error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('📡 Proxy request:', req.method, req.url);
              // Agregar headers necesarios
              proxyReq.setHeader('ngrok-skip-browser-warning', '69420');
              proxyReq.setHeader('Bypass-Tunnel-Reminder', 'true');
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('📥 Proxy response:', proxyRes.statusCode, req.url);
            });
          },
        }
      },
      host: true,
      cors: {
        origin: [
          'https://d1bqegutwmfn98.cloudfront.net',
          'https://ec2-44-216-131-63.compute-1.amazonaws.com',
          'http://localhost:5173',
          'http://localhost:3000'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Bypass-Tunnel-Reminder']
      },
      strictPort: false,
      allowedHosts: 'all'
    },
    build: {
      // Generar source maps incluso en producción
      sourcemap: mode !== 'production',
      // Configuración específica para staging
      ...(mode === 'staging' && {
        minify: 'esbuild',
        sourcemap: true,
      }),
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
      // Configuración específica para staging
      ...(mode === 'staging' && {
        minify: 'esbuild',
        sourcemap: true,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              router: ['react-router-dom'],
              ui: ['react-icons']
            }
          }
        }
      }),
      outDir: 'dist',
      assetsDir: 'assets',
      // Optimizaciones para AWS
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['framer-motion', 'react-icons']
          }
        }
      }
    },
  });
};