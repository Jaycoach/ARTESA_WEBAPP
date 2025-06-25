¡Por supuesto! Aquí tienes una versión reescrita y corregida del README.md para el frontend de LA ARTESA Web App, considerando los problemas de formato, enlaces e imágenes, y mejorando la claridad y estructura:

---

# LA ARTESA Web App - Frontend

<div align="center">
  <h3>Sistema Web Empresarial para Gestión de Productos, Pedidos y Clientes Comerciales</h3>
  <br />
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4.2-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vite-5.2.0-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
</div>

---

## 🎯 Descripción

**LA ARTESA Web App** es una aplicación web empresarial moderna diseñada para la gestión integral de productos, pedidos y clientes comerciales. Construida con tecnologías web actuales, ofrece una experiencia intuitiva, segura y adaptable para empresas en crecimiento.

---

## 🎪 Demo en Vivo

- **Staging:** [https://staging.artesa.com](https://d1bqegutwmfn98.cloudfront.net)

---

## 🔗 Enlaces Importantes

- [Documentación Backend](#) <!-- Actualiza con el enlace real -->
- [API Documentation (Swagger)](#) <!-- Actualiza con el enlace real -->
- [Guía de Usuario](#) <!-- Actualiza con el enlace real -->

---

## ✨ Características Principales

- **🔐 Autenticación Robusta:** Login/Registro con validación avanzada, recuperación de contraseñas por email, JWT con renovación automática, control de roles (ADMIN/USER), protección reCAPTCHA v3.
- **📊 Dashboard Interactivo:** Métricas en tiempo real, gráficos interactivos, panel personalizado por roles.
- **🛍️ Gestión de Productos:** Catálogo completo, búsqueda y filtros, sincronización con SAP Business One, gestión de precios y categorías.
- **📋 Sistema de Pedidos:** Creación y seguimiento de pedidos, carrito de compras, historial, estados en tiempo real.
- **👥 Gestión de Clientes Comerciales:** Perfiles empresariales, carga segura de documentos, integración backend.

---

## 🛠️ Stack Tecnológico

- **Frontend Core:**  
  ![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react)  
  ![React Router](https://img.shields.io/badge/React_Router-6.22.2-CA4245?style=flat-square&logo=react-router)  
  ![Vite](https://img.shields.io/badge/Vite-5.2.0-646CFF?style=flat-square&logo=vite)  
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.2-38B2AC?style=flat-square&logo=tailwind-css)  
  ![Recharts](https://img.shields.io/badge/Recharts-2.7.2-FF7300?style=flat-square&logo=recharts)  
  ![Axios](https://img.shields.io/badge/Axios-1.6.7-5A29E4?style=flat-square&logo=axios)  

- **Desarrollo:**  
  ![ESLint](https://img.shields.io/badge/ESLint-9.0.0-4B32C3?style=flat-square&logo=eslint)  
  ![Prettier](https://img.shields.io/badge/Prettier-3.2.5-F7B93E?style=flat-square&logo=prettier)  
  ![Jest](https://img.shields.io/badge/Jest-29.7.0-C21325?style=flat-square&logo=jest)

---

## 📋 Prerrequisitos

```bash
node --version   # >= 18.0.0
npm --version    # >= 9.0.0
git --version    # >= 2.0.0
```

---

## 🔧 Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Jaycoach/ARTESA_WEBAPP.git
cd ARTESA_WEBAPP

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Editar .env.local según tu entorno
# Ejemplo:
# VITE_API_BASE_URL=http://localhost:3000/api
# VITE_RECAPTCHA_SITE_KEY=tu-clave-recaptcha
# VITE_ENVIRONMENT=development

# 5. Ejecutar servidor de desarrollo
npm run dev
```

- **Acceso local:**  
  - [http://localhost:5173](http://localhost:5173)  
  - [http://[tu-ip]:5173](http://[tu-ip]:5173) (red local)

---

## 📁 Estructura del Proyecto

```
ARTESA_WEBAPP/
├── public/                     # Assets estáticos
├── src/
│   ├── Components/             # Componentes React
│   │   ├── App.jsx
│   │   ├── Auth/
│   │   │   ├── Login.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TopProductsChart.jsx
│   │   │   └── StatsChart.jsx
│   │   └── Layout/
│   │       ├── DashboardLayout.jsx
│   │       └── Sidebar.jsx
│   ├── Context/
│   ├── Hooks/
│   ├── Services/
│   ├── Styles/
│   ├── config.js
│   └── main.jsx
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

---

## 🌍 Variables de Entorno

Archivo: `.env.local`

```env
VITE_ENVIRONMENT=development
VITE_API_BASE_URL=http://localhost:3000/api
VITE_RECAPTCHA_SITE_KEY=tu_recaptcha_site_key
VITE_AWS_STAGING_URL=https://staging.artesa.com
VITE_AWS_PRODUCTION_URL=https://app.artesa.com
```

---

## ⚙️ Scripts Disponibles

```bash
# Desarrollo
npm run dev            # Servidor local
npm run dev:staging    # Modo staging
npm run dev:ngrok      # Testing con túnel ngrok
npm run dev:host       # Red local

# Build y Deploy
npm run build:production     # Build producción
npm run build:staging       # Build staging
npm run deploy:staging      # Deploy a S3 staging
npm run deploy:production   # Deploy a S3 producción

# Utilidades
npm run preview        # Preview build local
npm run lint           # Análisis de código con ESLint
```

---

## 🎨 Componentes Principales

### 🔐 Autenticación

- **Login:** Validación en tiempo real, reCAPTCHA v3, recuperación de contraseña, redirección por roles.
- **Rutas protegidas:**  
  ```jsx
  <ProtectedRoute>
    <DashboardLayout />
  </ProtectedRoute>
  ```

### 📊 Dashboard Interactivo

- **Métricas:** Pedidos, productos, facturas, usuarios.
- **Gráficos:** Top productos, estadísticas mensuales, tendencias.

### 🏗️ Layout Responsivo

- Sidebar colapsable, modo claro/oscuro, responsive automático.

---

## 📱 Screenshots

> **Incluye aquí capturas reales del dashboard, login, gráficos y vista móvil para mayor atractivo visual.**

---

## 🔐 Seguridad

- JWT con expiración automática
- Interceptores HTTP para manejo de tokens
- Verificación de roles en rutas
- reCAPTCHA en formularios críticos
- Validaciones robustas en cliente y logout automático

---

## 📡 Integración Backend

- **API Client:** Configuración automática por ambiente, interceptores JWT.
- **Endpoints principales:**
  - **Autenticación:**  
    - `POST /api/auth/login`  
    - `POST /api/auth/register`  
    - `POST /api/auth/forgot-password`  
    - `POST /api/auth/reset-password`  
    - `GET /api/auth/verify-token`
  - **Dashboard:**  
    - `GET /api/dashboard/stats`  
    - `GET /api/dashboard/top-products`  
    - `GET /api/dashboard/monthly-stats`
  - **Productos:**  
    - `GET /api/products`  
    - `GET /api/products/:id`  
    - `GET /api/products/search`  
    - `GET /api/products/categories`

---

## 🎨 Sistema de Estilos

- **Paleta corporativa:**
  ```css
  :root {
    --primary: #687e8d;
    --secondary: #f6db8e;
    --accent: #f6754e;
    --base: #ffffff;
    --home-primary: #7b8ac0;
    --home-secondary: #bbc4a6;
  }
  ```
- **Animaciones y componentes base con Tailwind CSS.**

---

## 🚀 Deployment

- **S3 AWS automático**  
  - **Staging:** rama `develop` → [staging.artesa.com](https://staging.artesa.com) (deploy automático)
  - **Producción:** rama `main` → [app.artesa.com](https://app.artesa.com) (deploy manual)

- **Scripts Deploy:**
  ```bash
  npm run deploy:staging
  npm run deploy:production
  ```

---

## 🤝 Contribución

1. Haz fork del proyecto.
2. Crea una rama: `git checkout -b feature/NuevaFeature`
3. Commit: `git commit -m 'Agrega NuevaFeature'`
4. Push: `git push origin feature/NuevaFeature`
5. Abre un Pull Request.

**Guías:**
- Usa componentes funcionales y hooks.
- Sigue patrones de nombres establecidos.
- Implementa lazy loading para componentes pesados.
- Usa Tailwind para estilos.
- Documenta componentes complejos.
- Escribe pruebas para funciones críticas.

**¿Encontraste un bug?**  
Abre un issue con descripción, pasos para reproducir, screenshots y datos de entorno.

---

## 📞 Soporte

| Tipo                | Canal           | Tiempo de Respuesta |
|---------------------|-----------------|--------------------|
| 🐛 Bugs Críticos    | GitHub Issues   | < 24 horas         |
| ❓ Preguntas        | Email           | < 48 horas         |
| 💡 Feature Request  | GitHub Discussion | < 1 semana         |

<div align="center">
  🎉 ¡Gracias por usar LA ARTESA Web App!  
  Construido con ❤️ por el equipo de desarrollo de LA ARTESA  
  [Repositorio Principal](https://github.com/Jaycoach/ARTESA_WEBAPP)
</div>

---

**Versión:** 1.0.0 | Última actualización: Junio 2025

---
