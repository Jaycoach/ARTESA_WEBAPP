LA ARTESA Web App - Frontend
<div align="center">
Sistema Web Empresarial para Gestión de Productos, Pedidos y Clientes Comerciales

[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react://](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC?style=for-the-badge&logo=(https://img.shields.io/badge/Axios-1.7.9-5A29E4?style=for-the-badge&logo=axios&logoColor=/badge/AWS_S3-Deployed-FF9900?style=for-the-badge&logo=amazon-aws&logog.shields.io

🎯 Descripción

✨ Características Principales

🛠️ Stack Tecnológico

🚀 Inicio Rápido

📁 Estructura del Proyecto

🔧 Configuración

🎨 Componentes Principales

📱 Screenshots

🔐 Autenticación y Seguridad

📊 Dashboard y Métricas

🌐 Integración con Backend

🎨 Sistema de Estilos

🚀 Deployment

🤝 Contribución

📞 Soporte

🎯 Descripción
LA ARTESA Web App es una aplicación web empresarial moderna diseñada para la gestión integral de productos, pedidos y clientes comerciales. Construida con las últimas tecnologías web, ofrece una experiencia de usuario fluida y profesional.

🎪 Demo en Vivo
Staging: https://staging.artesa.com

Producción: https://app.artesa.com

🔗 Enlaces Importantes
📖 Documentación del Backend

🔧 API Documentation (Swagger)

📱 Guía de Usuario

✨ Características Principales
🔐 Autenticación Robusta
✅ Login/Registro con validación avanzada

✅ Recuperación de contraseñas por email

✅ Autenticación JWT con renovación automática

✅ Control de roles (ADMIN/USER)

✅ Protección reCAPTCHA v3

📊 Dashboard Interactivo
✅ Métricas en tiempo real

✅ Gráficos interactivos con Recharts

✅ Estadísticas de productos y pedidos

✅ Panel de control personalizado por roles

🛍️ Gestión de Productos
✅ Catálogo completo con imágenes

✅ Búsqueda y filtros avanzados

✅ Sincronización con SAP Business One

✅ Gestión de precios y categorías

📋 Sistema de Pedidos
✅ Creación y seguimiento de pedidos

✅ Carrito de compras intuitivo

✅ Historial completo de transacciones

✅ Estados de pedido en tiempo real

👥 Perfiles de Clientes Comerciales
✅ Gestión de datos empresariales

✅ Carga segura de documentos

✅ Verificación de clientes institucionales

✅ Integración con backend empresarial

🛠️ Stack Tecnológico
<div align="center">
Frontend Core
![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat-square&logo(https://img.shields.io/badge/React_Router-7.1.5-CA4245?style=flat-square&logoo/badge/badge/Sass-1.83.0-CC6699?style=flat-square&logo=sass&logoColor=rerías Especializadas**
![Axios](https://img.shields.io/badge/img Desarrollo**
![ESLint](https://img.shields.io/badge/ESLint-9.18.0-4B32C3?style=flat-square&logo=eslint&logo/PostCSS-8.4.49-DD3A0A?style=flat-square&logo=postcido

📋 Prerrequisitos
bash
# Verificar versiones necesarias
node --version  # >= 18.0.0
npm --version   # >= 9.0.0
git --version   # >= 2.0.0
🔧 Instalación
bash
# 1. Clonar el repositorio
git clone https://github.com/Jaycoach/ARTESA_WEBAPP.git
cd ARTESA_WEBAPP

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Configurar .env.local
# VITE_API_BASE_URL=http://localhost:3000/api
# VITE_RECAPTCHA_SITE_KEY=your-recaptcha-key
# VITE_ENVIRONMENT=development

# 5. Ejecutar en desarrollo
npm run dev
🌐 Acceso Local
Una vez ejecutado, la aplicación estará disponible en:

Local: http://localhost:5173

Red Local: http://[tu-ip]:5173

📁 Estructura del Proyecto
text
ARTESA_WEBAPP/
├── 📁 public/                      # Assets estáticos
├── 📁 src/
│   ├── 📁 Components/              # Componentes React
│   │   ├── 📄 App.jsx             # App principal con rutas
│   │   ├── 📁 Auth/               # Autenticación
│   │   │   ├── 📄 Login.jsx      # Componente de login
│   │   │   └── 📄 ProtectedRoute.jsx
│   │   ├── 📁 Dashboard/          # Dashboard y métricas
│   │   │   ├── 📄 Dashboard.jsx  # Dashboard principal
│   │   │   ├── 📄 TopProductsChart.jsx
│   │   │   └── 📄 StatsChart.jsx
│   │   └── 📁 Layout/             # Layouts de la app
│   │       ├── 📄 DashboardLayout.jsx
│   │       └── 📄 Sidebar.jsx
│   ├── 📁 Context/                # Contextos React
│   ├── 📁 Hooks/                  # Hooks personalizados
│   ├── 📁 Services/               # Servicios API
│   ├── 📁 Styles/                 # Estilos globales
│   ├── 📄 config.js              # Configuración API
│   └── 📄 main.jsx               # Punto de entrada
├── 📄 package.json               # Dependencias del proyecto
├── 📄 vite.config.js            # Configuración Vite
├── 📄 tailwind.config.js        # Configuración Tailwind
└── 📄 README.md                 # Esta documentación
🔧 Configuración
🌍 Variables de Entorno
bash
# .env.local - Configuración de desarrollo
VITE_ENVIRONMENT=development
VITE_API_BASE_URL=http://localhost:3000/api
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
VITE_AWS_STAGING_URL=https://staging.artesa.com
VITE_AWS_PRODUCTION_URL=https://app.artesa.com
⚙️ Scripts Disponibles
bash
# 🔥 Desarrollo
npm run dev              # Servidor de desarrollo local
npm run dev:staging      # Modo staging
npm run dev:ngrok        # Con túnel ngrok para testing
npm run dev:host         # Expuesto en red local

# 🏗️ Build y Deploy
npm run build:production  # Build optimizado para producción
npm run build:staging    # Build para ambiente de staging
npm run deploy:staging   # Deploy automático a S3 staging
npm run deploy:production # Deploy automático a S3 producción

# 🧹 Utilidades
npm run preview          # Preview del build local
npm run lint            # Análisis de código con ESLint
🎨 Componentes Principales
🔐 Sistema de Autenticación
Login Component
jsx
// Características implementadas
✅ Validación en tiempo real
✅ Integración reCAPTCHA v3
✅ Manejo de estados de carga
✅ Recuperación de contraseñas
✅ Redirección automática por roles
Protected Routes
jsx
// Control de acceso automático
<ProtectedRoute>
  <DashboardLayout />
</ProtectedRoute>
📊 Dashboard Interactivo
Métricas Principales
jsx
// Widgets implementados
📈 Estadísticas de pedidos
📦 Contadores de productos  
📋 Facturas generadas
👥 Usuarios registrados
Gráficos con Recharts
jsx
// Visualizaciones disponibles
📊 Top 5 productos más pedidos
📈 Estadísticas mensuales
📉 Tendencias de pedidos
🎯 Métricas de rendimiento
🏗️ Layout Responsivo
DashboardLayout
jsx
// Características del layout
📱 Sidebar colapsible
🖥️ Responsive design automático
🎨 Tema claro/oscuro
🔄 Estados de carga
📱 Screenshots
<div align="center">
🖥️ Dashboard Principal
Vista del dashboard con métricas y gráficos interactivos

🔐 Pantalla de Login
Interfaz de autenticación con validación avanzada

📊 Gráficos Interactivos
Visualización de datos con Recharts

📱 Vista Móvil
Diseño responsive en dispositivos móviles

</div>
🔐 Autenticación y Seguridad
🛡️ Medidas de Seguridad Implementadas
javascript
// 🔒 Características de seguridad
✅ Tokens JWT con expiración automática
✅ Interceptores HTTP para manejo automático
✅ Verificación de roles en rutas
✅ reCAPTCHA v3 en formularios críticos
✅ Validación client-side robusta
✅ Logout automático en token expirado
🔑 Flujo de Autenticación
text
graph LR
    A[Usuario] --> B[Login Form]
    B --> C[Validación + reCAPTCHA]
    C --> D[API Backend]
    D --> E[JWT Token]
    E --> F[Dashboard]
    F --> G[Auto-refresh Token]
👥 Control de Roles
Rol	Permisos	Acceso
USER	👤 Perfil personal
📦 Ver productos
🛒 Crear pedidos	Dashboard básico
ADMIN	👥 Gestión usuarios
⚙️ Configuración
📊 Reportes avanzados	Panel administrativo completo
📊 Dashboard y Métricas
📈 Gráficos Implementados
Top Products Chart
jsx
// Muestra los 5 productos más pedidos
- 📊 Gráfico de barras interactivo
- 🔄 Actualización automática cada 30 días
- 📱 Responsive design
- ⚡ Estados de carga y error
Stats Chart
jsx
// Estadísticas mensuales de pedidos
- 📈 Gráfico de líneas temporal
- 📅 Últimos 6 meses de datos
- 🎯 Métricas de tendencias
- 📊 Tooltips informativos
🎯 Widgets de Métricas
<div align="center">
Widget	Descripción	API Endpoint
📋 Pedidos	Total de pedidos activos	/api/dashboard/stats
📦 Productos	Catálogo completo	/api/dashboard/stats
📄 Facturas	Facturas generadas	/api/dashboard/stats
👥 Usuarios	Usuarios registrados	/api/dashboard/stats
</div>
🌐 Integración con Backend
🔗 API Client Configuration
javascript
// Configuración automática por ambiente
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptores JWT automáticos
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('artesa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
📡 Endpoints Integrados
<details> <summary><strong>🔐 Autenticación</strong></summary>
javascript
POST /api/auth/login          // Login de usuarios
POST /api/auth/register       // Registro de nuevos usuarios
POST /api/auth/forgot-password // Recuperación de contraseñas
POST /api/auth/reset-password  // Reset de contraseñas
GET  /api/auth/verify-token   // Verificación de tokens
</details> <details> <summary><strong>📊 Dashboard</strong></summary>
javascript
GET /api/dashboard/stats         // Estadísticas generales
GET /api/dashboard/top-products  // Top productos más pedidos
GET /api/dashboard/monthly-stats // Estadísticas mensuales
</details> <details> <summary><strong>📦 Productos</strong></summary>
javascript
GET    /api/products           // Listado paginado de productos
GET    /api/products/:id       // Detalle de producto específico
GET    /api/products/search    // Búsqueda con filtros
GET    /api/products/categories // Categorías disponibles
</details>
🎨 Sistema de Estilos
🎨 Paleta de Colores Corporativa
css
/* Colores principales de LA ARTESA */
:root {
  --primary: #687e8d;      /* Gris corporativo */
  --secondary: #f6db8e;    /* Amarillo distintivo */
  --accent: #f6754e;       /* Naranja vibrante */
  --base: #ffffff;         /* Blanco limpio */
  --home-primary: #7b8ac0; /* Azul suave */
  --home-secondary: #bbc4a6; /* Verde natural */
}
⚡ Animaciones Personalizadas
css
/* Animaciones con Tailwind CSS */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
🎯 Componentes Base Reutilizables
text
// Botones estandarizados
.btn {
  @apply px-4 py-2 rounded-lg font-medium transition-colors;
  
  &.btn-primary {
    @apply bg-primary text-white hover:bg-primary/90;
  }
  
  &.btn-secondary {
    @apply bg-secondary text-gray-800 hover:bg-secondary/90;
  }
}

// Cards responsivos
.card {
  @apply bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow;
}
🚀 Deployment
☁️ AWS S3 Deployment
El proyecto está configurado para deployment automático en AWS S3:

Ambientes Disponibles
Ambiente	URL	Branch	Deploy
🧪 Staging	https://staging.artesa.com	develop	Automático
🚀 Production	https://app.artesa.com	main	Manual
Scripts de Deploy
bash
# Deploy a Staging
npm run deploy:staging

# Deploy a Production  
npm run deploy:production
🔧 Configuración de Build
javascript
// vite.config.js - Optimizaciones de producción
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          recharts: ['recharts'],
          icons: ['react-icons']
        }
      }
    }
  }
});
🤝 Contribución
🌟 ¿Cómo Contribuir?
¡Las contribuciones son bienvenidas! Sigue estos pasos:

🍴 Fork el proyecto

🔄 Crea una rama para tu feature (git checkout -b feature/AmazingFeature)

💾 Commit tus cambios (git commit -m 'Add some AmazingFeature')

📤 Push a la rama (git push origin feature/AmazingFeature)

🔄 Abre un Pull Request

📋 Guidelines de Desarrollo
javascript
// Convenciones de código
✅ Usar componentes funcionales con hooks
✅ Seguir patrones de naming establecidos
✅ Implementar lazy loading para componentes pesados
✅ Usar Tailwind CSS para estilos
✅ Documentar componentes complejos
✅ Escribir tests para funciones críticas
🐛 Reportar Bugs
¿Encontraste un bug? Abre un issue con:

📝 Descripción detallada del problema

🔄 Pasos para reproducir el bug

🖥️ Screenshots si es posible

🌐 Información del navegador/OS

📞 Soporte
📬 Contacto del Equipo
<div align="center">
🏢 LA ARTESA Development Team

[![Email](https://imgimg.shields.io/badge/GitHubgithub.com/Jaycoach/ARTESA_s**

📖 Documentación Completa

🔧 API Documentation

🎥 Video Tutoriales

❓ FAQ

🆘 Soporte Técnico
Tipo	Canal	Tiempo de Respuesta
🐛 Bugs Críticos	GitHub Issues	< 24 horas
❓ Preguntas Generales	Email	< 48 horas
💡 Feature Requests	GitHub Discussions	< 1 semana
<div align="center">
🎉 ¡Gracias por usar LA ARTESA Web App!
Construido con ❤️ por el equipo de desarrollo de LA ARTESA

[![⭐ Star](https://img.shields.s/*: 1.0.0 | Última actualización: Junio 2025

</div>
