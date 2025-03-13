# **LA ARTESA - WEB APP Documentation**

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/Jaycoach/ARTESA_WEBAPP)
[![Node](https://img.shields.io/badge/node-v18.x-green.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgresql-v13.x-blue.svg)](https://www.postgresql.org)

Este proyecto es una API RESTful para la aplicación web **LA ARTESA**, que permite gestionar usuarios, autenticación, productos, pedidos, perfiles de clientes y su integración con SAP Business One.

---

## **Tabla de Contenidos**
1. [Novedades](#novedades)
2. [Requisitos](#requisitos)
3. [Configuración del Proyecto](#configuración-del-proyecto)
   - [Instalación](#instalación)
   - [Variables de Entorno](#variables-de-entorno)
4. [Arquitectura del Sistema](#arquitectura-del-sistema)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Base de Datos](#base-de-datos)
7. [Autenticación y Seguridad](#autenticación-y-seguridad)
8. [Almacenamiento de Archivos](#almacenamiento-de-archivos)
   - [Configuración de AWS S3](#configuración-de-aws-s3)
   - [Migración de Archivos](#migración-de-archivos)
9. [Integración con SAP B1](#integración-con-sap-b1)
   - [Configuración SAP](#configuración-sap)
   - [Sincronización de Productos](#sincronización-de-productos)
10. [Endpoints](#endpoints)
11. [Perfiles de Clientes](#perfiles-de-clientes)
12. [Sistema de Auditoría](#sistema-de-auditoría)
13. [Ejecución del Proyecto](#ejecución-del-proyecto)
14. [Documentación de la API](#documentación-de-la-api)
15. [Logs y Monitoreo](#logs-y-monitoreo)
16. [Seguridad](#seguridad)

---

## **Novedades**

### Versión 1.3.0 (Marzo 2025)

- **Almacenamiento de archivos en AWS S3**:
  - Integración con AWS S3 para almacenamiento escalable de imágenes y documentos
  - Generación de URLs prefirmadas para acceso seguro a documentos sensibles
  - Soporte para modo local (desarrollo) y S3 (producción)
  - Herramienta de migración para transferir archivos existentes a S3

- **Mejoras en perfiles de clientes**:
  - Gestión de documentos mejorada (cédulas, RUT, anexos adicionales)
  - Acceso seguro a documentos sensibles mediante URLs temporales
  - Validación y verificación mejorada de perfiles

- **Integración con SAP Business One**:
  - Sincronización bidireccional de productos con SAP B1 Service Layer
  - Soporte para sincronización programada por grupos de productos
  - Panel de administración para gestionar sincronización
  - Detección y gestión automática de cambios pendientes

- **Mejoras de seguridad y rendimiento**:
  - Optimización de consultas a la base de datos
  - Mejora en el manejo de sesiones y tokens de autenticación
  - Sistema de auditoría ampliado

---

## **Requisitos**
- Node.js (v16 o superior)
- PostgreSQL (v12 o superior)
- npm (v8 o superior)
- Cuenta de AWS (para S3 en producción)
- SAP Business One con Service Layer configurado (opcional)

---

## **Configuración del Proyecto**

### **Instalación**

1. **Clonar el Repositorio**
```bash
git clone https://github.com/Jaycoach/ARTESA_WEBAPP.git
cd ARTESA_WEBAPP
```

2. **Instalar Dependencias**
```bash
npm install
```

### **Variables de Entorno**

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración de la base de datos
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_DATABASE=ARTESA_WEBAPP
DB_PORT=5432

# Configuración de JWT
JWT_SECRET=tu_secreto_jwt_seguro

# Configuración de Email (para recuperación de contraseña)
SMTP_HOST=tu_servidor_smtp
SMTP_PORT=587
SMTP_USER=tu_usuario_smtp
SMTP_PASS=tu_contraseña_smtp
SMTP_FROM=noreply@tudominio.com
FRONTEND_URL=http://localhost:5173

# Configuración de Almacenamiento
STORAGE_MODE=local   # 'local' para desarrollo, 's3' para producción
UPLOADS_DIR=uploads  # Solo para modo local

# Configuración de AWS S3 (necesario cuando STORAGE_MODE=s3)
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_REGION=tu_region                # ej: us-east-1
AWS_S3_BUCKET_NAME=nombre_de_tu_bucket
AWS_S3_BASE_URL=                    # Opcional, URL base para archivos
S3_URL_EXPIRATION=3600              # Tiempo de expiración en segundos

# Configuración de SAP Business One
SAP_SERVICE_LAYER_URL=https://servidor-sap:50000/b1s/v1
SAP_USERNAME=usuario_sap
SAP_PASSWORD=contraseña_sap
SAP_COMPANY_DB=SBO_ARTESA
SAP_SYNC_SCHEDULE=0 0 * * *         # Formato cron: cada día a medianoche
SAP_GROUP_CODE=127                  # Código del grupo prioritario
SAP_GROUP_SYNC_SCHEDULE=0 */6 * * * # Formato cron: cada 6 horas

# URL de desarrollo Ngrok (opcional)
DEV_NGROK_URL=https://tu-subdominio.ngrok-free.app

# URL de producción (opcional)
PROD_URL=https://tu-dominio-de-produccion.com
```
---

## **Arquitectura del Sistema**

LA ARTESA Web App utiliza una arquitectura en capas con separación clara de responsabilidades, siguiendo el patrón MVC adaptado para una API RESTful.

![Arquitectura de LA ARTESA Web App](scripts/docs/images/backend-architecture-diagram.svg)

### Componentes Principales

- **Express App**: Punto de entrada principal que configura el servidor y registra las rutas
- **Middleware**: Autenticación, seguridad, manejo de errores y validación
- **Rutas**: Definen los endpoints de la API y dirigen las solicitudes
- **Controladores**: Implementan la lógica de negocio para cada tipo de solicitud
- **Servicios**: Proporcionan funcionalidades transversales como correo electrónico, auditoría, S3 y SAP
- **Modelos**: Encapsulan la lógica de acceso a datos y reglas de negocio
- **Base de Datos**: PostgreSQL para almacenamiento persistente
- **Almacenamiento**: AWS S3 para archivos, con fallback a almacenamiento local
- **SAP Integration**: Conexión con SAP B1 para sincronización de datos

Para una descripción detallada de la arquitectura, consulte la [documentación técnica](scripts/docs/ARCHITECTURE.md).
---

## **Estructura del Proyecto**

```
/
├── app.js                       # Punto de entrada principal del servidor
├── package.json                 # Configuración de dependencias y scripts
├── scripts/                     # Scripts utilitarios
│   ├── generateDbDocs.js        # Genera documentación de la base de datos
│   ├── generate-swagger.js      # Genera documentación Swagger
│   ├── hashPasswords.js         # Utilidad para hashear contraseñas
│   └── migrateToS3.js           # Migra archivos locales a AWS S3
├── src/
│   ├── config/                  # Configuraciones
│   │   ├── db.js                # Configuración de la base de datos
│   │   ├── express-swagger.js   # Configuración de Swagger para Express
│   │   ├── logger.js            # Configuración del sistema de logs
│   │   └── swagger.js           # Definiciones de Swagger
│   ├── controllers/             # Controladores de la API
│   │   ├── authController.js    # Controlador de autenticación
│   │   ├── clientProfileController.js # Controlador de perfiles de clientes
│   │   ├── orderController.js   # Controlador de pedidos
│   │   ├── passwordResetController.js # Controlador de reseteo de contraseñas
│   │   ├── productController.js # Controlador de productos
│   │   ├── sapSyncController.js # Controlador de sincronización con SAP
│   │   ├── uploadController.js  # Controlador de subida de archivos
│   │   └── userController.js    # Controlador de usuarios
│   ├── middleware/              # Middlewares
│   │   ├── auth.js              # Middleware de autenticación
│   │   ├── auditMiddleware.js   # Middleware de auditoría
│   │   ├── enhancedSecurity.js  # Configuraciones avanzadas de seguridad
│   │   ├── errorMiddleware.js   # Manejo centralizado de errores
│   │   ├── paymentSanitization.js # Sanitización para pagos
│   │   └── security.js          # Middleware de seguridad general
│   ├── models/                  # Modelos de datos
│   │   ├── clientProfile.js     # Modelo de perfiles de cliente
│   │   ├── Order.js             # Modelo de pedidos
│   │   ├── PasswordReset.js     # Modelo de reseteo de contraseñas
│   │   ├── Product.js           # Modelo de productos
│   │   ├── ProductImage.js      # Modelo de imágenes de productos
│   │   ├── Roles.js             # Modelo de roles
│   │   └── userModel.js         # Modelo de usuarios
│   ├── routes/                  # Rutas de la API
│   │   ├── authRoutes.js        # Rutas de autenticación
│   │   ├── clientProfileRoutes.js # Rutas de perfiles de clientes
│   │   ├── orderRoutes.js       # Rutas de pedidos
│   │   ├── passwordResetRoutes.js # Rutas de reseteo de contraseñas
│   │   ├── paymentRoutes.js     # Rutas de pagos
│   │   ├── productRoutes.js     # Rutas de productos
│   │   ├── sapSyncRoutes.js     # Rutas de sincronización con SAP
│   │   ├── secureProductRoutes.js # Rutas protegidas de productos
│   │   ├── uploadRoutes.js      # Rutas para subida de archivos
│   │   └── userRoutes.js        # Rutas de usuarios
│   ├── services/                # Servicios
│   │   ├── AuditService.js      # Servicio de auditoría
│   │   ├── EmailService.js      # Servicio de correo electrónico
│   │   ├── S3Service.js         # Servicio de almacenamiento en S3
│   │   └── SapIntegrationService.js # Servicio de integración con SAP B1
│   ├── utils/                   # Utilidades
│   │   ├── dbUtils.js           # Utilidades para la base de datos
│   │   └── S3UrlManager.js      # Gestor de URLs de S3
│   └── validators/              # Validadores
│       ├── authValidators.js    # Validadores de autenticación
│       └── paymentValidators.js # Validadores de pagos
├── uploads/                     # Directorio para archivos subidos (modo local)
└── public/                      # Activos públicos
    └── swagger.json             # Documentación generada de la API
```

---

## **Base de Datos**

### Estructura de Tablas

La base de datos PostgreSQL contiene las siguientes tablas principales:

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema con sus credenciales y roles |
| `roles` | Roles de usuario (Admin, User) |
| `products` | Catálogo de productos con precios y detalles |
| `product_images` | Imágenes de productos (especialmente para productos SAP) |
| `orders` | Pedidos realizados por los usuarios |
| `order_details` | Detalles de productos en cada pedido |
| `client_profiles` | Perfiles de clientes comerciales con documentación |
| `password_resets` | Tokens para recuperación de contraseñas |
| `login_history` | Historial de intentos de login |
| `transactions` | Transacciones de pago relacionadas con órdenes |
| `transaction_audit_log` | Registro de auditoría de transacciones |
| `audit_anomalies` | Anomalías detectadas en transacciones |
| `revoked_tokens` | Tokens JWT revocados o expirados |
| `active_tokens` | Tokens JWT activos para control de sesiones |

Para una referencia completa de todas las tablas, consulta el archivo [database-structure.md](./docs/database-structure.md).

---

## **Autenticación y Seguridad**

### **JWT**

El sistema utiliza JSON Web Tokens (JWT) para la autenticación. Cada token incluye:

- ID de usuario
- Correo electrónico
- Nombre
- ID de rol
- Nombre de rol

Los tokens expiran después de 24 horas, y se verifican en cada solicitud protegida.

### **Sistema de Roles**

Existen dos roles principales en el sistema:

- **ADMIN (ID: 1)**: Acceso completo a todas las funcionalidades
- **USER (ID: 2)**: Acceso limitado a funcionalidades específicas

El middleware `checkRole` verifica si el usuario tiene permiso para acceder a cada endpoint.

### **Recuperación de Contraseña**

El sistema incluye un flujo completo de recuperación de contraseña:

1. El usuario solicita un reset de contraseña a través del endpoint `/api/password/request-reset`
2. Se genera un token criptográficamente seguro y se envía por correo
3. El usuario utiliza este token para establecer una nueva contraseña a través de `/api/password/reset`
4. Los tokens expiran después de una hora y son de un solo uso

### **Rate Limiting y Protección**

Para prevenir ataques de fuerza bruta y asegurar la disponibilidad del servicio:

- Rate limiting en endpoints de autenticación: 5 intentos cada 15 minutos
- Rate limiting en endpoints sensibles: 50 solicitudes cada 15 minutos
- Rate limiting en endpoints estándar: 100 solicitudes cada 15 minutos
- Bloqueo de cuentas después de múltiples intentos fallidos de login
- Headers de seguridad para prevenir XSS, clickjacking y otros ataques

---

## **Almacenamiento de Archivos**

### **Configuración de AWS S3**

El sistema utiliza AWS S3 para el almacenamiento escalable de archivos, con soporte para fallback a almacenamiento local durante desarrollo:

#### Modos de Almacenamiento

- **Modo Local (STORAGE_MODE=local)**: Los archivos se guardan en el directorio `uploads/` local.
- **Modo S3 (STORAGE_MODE=s3)**: Los archivos se almacenan en un bucket de AWS S3.

#### Configuración de S3

1. **Crear un bucket en S3**:
   - Nombre único global
   - Configuración de privacidad adecuada
   - Configuración CORS para permitir acceso desde tu dominio

2. **Política de Bucket**:
   - Configurar acceso público/privado según necesidades
   - Implementar restricción de referrer para evitar hotlinking

3. **Usuario IAM**:
   - Crear un usuario IAM con permisos específicos para S3
   - Generar y almacenar las claves de acceso de manera segura

#### Tipos de Archivos y Acceso

El sistema gestiona diferentes tipos de archivos con políticas de seguridad específicas:

| Tipo de Archivo | Almacenamiento | Acceso | Expiración URL |
|-----------------|----------------|--------|---------------|
| Imágenes de productos | `products/{productId}/` | Público | N/A |
| Cédulas (perfiles) | `client-profiles/{userId}/cedula/` | Privado | 1 hora |
| RUT (perfiles) | `client-profiles/{userId}/rut/` | Privado | 1 hora |
| Anexos (perfiles) | `client-profiles/{userId}/anexos/` | Privado | 1 hora |
| Archivos generales | `general/` | Público | N/A |

### **Migración de Archivos**

Para migrar archivos existentes desde almacenamiento local a S3, el sistema incluye un script de migración:

```bash
# Ejecutar en modo simulación (sin cambios reales)
node scripts/migrateToS3.js --simulation

# Ejecutar migración real
node scripts/migrateToS3.js
```

---

## **Integración con SAP B1**

### **Configuración SAP**

El sistema se integra con SAP Business One a través de Service Layer para sincronización de datos:

#### Requisitos SAP

- SAP Business One 9.3 o superior
- Service Layer habilitado y accesible
- Usuario con permisos adecuados

#### Configuración

1. **Variables de Entorno**:
   - `SAP_SERVICE_LAYER_URL`: URL del Service Layer (ej: https://servidor:50000/b1s/v1)
   - `SAP_USERNAME`: Usuario SAP con permisos adecuados
   - `SAP_PASSWORD`: Contraseña del usuario
   - `SAP_COMPANY_DB`: Nombre de la base de datos de la empresa
   - `SAP_SYNC_SCHEDULE`: Programación cron para sincronización general

2. **Vista Personalizada en SAP**:
   - El sistema utiliza una vista personalizada `B1_ProductsB1SLQuery` que debe crearse en SAP.
   - Esta vista debe incluir campos como ItemCode (como Sap_Code), ItemName, ForeignName y campos de precios.

### **Sincronización de Productos**

#### Tipos de Sincronización

- **Sincronización Completa**: Todos los productos desde SAP a la WebApp.
- **Sincronización por Grupo**: Solo productos de un grupo específico (ej: 127).
- **Sincronización de Cambios**: Productos modificados en la WebApp hacia SAP.

#### Métodos de Sincronización

- **Programada**: Según configuración cron en variables de entorno.
- **Manual**: A través de endpoints administrativos.
- **Por Demanda**: Al actualizar ciertos campos de productos.

#### Endpoints de Sincronización

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/api/sap/sync` | Inicia sincronización manual completa | ADMIN |
| GET | `/api/sap/status` | Obtiene estado de sincronización | ADMIN |
| GET | `/api/sap/test` | Prueba conexión con SAP B1 | ADMIN |
| POST | `/api/sap/update-description` | Actualiza descripción y sincroniza | ADMIN |

La sincronización incluye manejo automático de errores, reintentos y registro detallado de operaciones.

---

## **Endpoints**

### **Autenticación**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/api/auth/login` | Iniciar sesión | Público |
| POST | `/api/auth/register` | Registrar nuevo usuario | Público |
| POST | `/api/password/request-reset` | Solicitar recuperación de contraseña | Público |
| POST | `/api/password/reset` | Establecer nueva contraseña | Público |

### **Usuarios**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/users` | Obtener todos los usuarios | ADMIN |
| GET | `/api/users/:id` | Obtener usuario por ID | ADMIN, propietario |
| PUT | `/api/users/:id` | Actualizar usuario | ADMIN, propietario |

### **Productos**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/products` | Obtener todos los productos | ADMIN, USER |
| GET | `/api/products/:productId` | Obtener producto por ID | ADMIN, USER |
| POST | `/api/products` | Crear nuevo producto | ADMIN |
| PUT | `/api/products/:productId` | Actualizar producto | ADMIN |
| PUT | `/api/products/:productId/image` | Actualizar imagen de producto | ADMIN |
| DELETE | `/api/products/:productId` | Eliminar producto | ADMIN |

### **Pedidos**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/api/orders` | Crear un nuevo pedido | ADMIN, USER |
| GET | `/api/orders/:orderId` | Obtener detalles de un pedido | ADMIN, propietario |
| GET | `/api/orders/user/:userId` | Obtener pedidos de un usuario | ADMIN, propietario |

### **Perfiles de Clientes**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/client-profiles` | Obtener todos los perfiles | ADMIN |
| GET | `/api/client-profiles/user/:userId` | Obtener perfil por ID de usuario | ADMIN, propietario |
| POST | `/api/client-profiles` | Crear perfil de cliente | ADMIN, USER |
| PUT | `/api/client-profiles/user/:userId` | Actualizar perfil | ADMIN, propietario |
| DELETE | `/api/client-profiles/user/:userId` | Eliminar perfil | ADMIN |
| POST | `/api/client-profiles/:userId/documents/:documentType` | Subir documento | ADMIN, propietario |
| GET | `/api/client-profiles/:userId/documents/:documentType` | Obtener documento | ADMIN, propietario |

### **Sincronización SAP**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/sap/test` | Probar conexión con SAP | ADMIN |
| GET | `/api/sap/status` | Ver estado de sincronización | ADMIN |
| POST | `/api/sap/sync` | Iniciar sincronización completa | ADMIN |
| POST | `/api/sap/update-description` | Actualizar descripción y sincronizar | ADMIN |

### **Archivos**

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/api/upload/images` | Subir una imagen general | ADMIN, USER |
| DELETE | `/api/upload/images/:fileName` | Eliminar una imagen | ADMIN |

---

## **Perfiles de Clientes**

El sistema ofrece una gestión completa de perfiles de clientes comerciales:

### **Datos del Perfil**

- **Información Básica**: Razón social, NIT, dirección, ciudad, país, etc.
- **Contacto**: Nombre, email, teléfono
- **Información Financiera**: Entidad bancaria, tipo de cuenta, etc.
- **Clasificación**: Actividad comercial, sector, tamaño de empresa

### **Documentos Asociados**

El sistema gestiona diferentes tipos de documentos:

| Tipo | Descripción | Almacenamiento | Acceso |
|------|-------------|----------------|--------|
| Cédula | Fotocopia de cédula del representante legal | S3 privado | URL firmada |
| RUT | Registro Único Tributario | S3 privado | URL firmada |
| Anexos | Documentos adicionales | S3 privado | URL firmada |

### **Seguridad de Documentos**

- Los documentos se almacenan con acceso privado en S3
- Se generan URLs firmadas para acceso temporal (1 hora por defecto)
- Verificación de permisos antes de generar URLs de acceso
- Auditoría de accesos a documentos sensibles

### **Integración con Pedidos**

- Los perfiles de clientes se asocian a los usuarios
- Pedidos vinculados automáticamente a la información del perfil
- Facilita la gestión comercial y facturación

---

## **Sistema de Auditoría**

El sistema cuenta con un robusto sistema de auditoría que registra:

- Intentos de login (exitosos y fallidos)
- Transacciones de pago
- Acciones de usuarios en datos sensibles
- Eventos de seguridad
- Operaciones de sincronización con SAP

Características:
- Detección automática de anomalías
- Diferentes niveles de severidad (INFO, WARNING, ERROR, CRITICAL)
- Almacenamiento en base de datos para análisis posterior
- Redacción automática de datos sensibles

La tabla `transaction_audit_log` almacena todos los eventos con detalles como:
- Usuario que realizó la acción
- Dirección IP
- Timestamp
- Detalles de la acción
- Nivel de severidad

---

## **Ejecución del Proyecto**

### **Desarrollo**

```bash
# Con nodemon para recarga automática
npm run dev

# Con conexión ngrok (para pruebas externas)
npm run start:ngrok
```

### **Producción**

```bash
npm run start:prod
```

### **Herramientas adicionales**

```bash
# Generar documentación Swagger
npm run generate-swagger

# Hashear contraseñas existentes en la base de datos
node scripts/hashPasswords.js

# Generar documentación de la base de datos
node scripts/generateDbDocs.js

# Migrar archivos a S3
node scripts/migrateToS3.js
```

---

## **Documentación de la API**

La documentación interactiva de la API está disponible en Swagger UI:

- Desarrollo: `http://localhost:3000/api-docs`
- Producción: `https://tu-dominio.com/api-docs`

También se puede acceder al archivo JSON de la especificación en:
- `http://localhost:3000/swagger.json`

La documentación incluye:
- Todos los endpoints disponibles
- Esquemas de solicitud y respuesta
- Parámetros requeridos
- Ejemplos de uso
- Funcionalidad "Try It Out" para probar endpoints directamente

---

## **Logs y Monitoreo**

El sistema utiliza Winston para el logging con las siguientes características:

- Rotación diaria de archivos de log
- Niveles configurables según entorno (debug en desarrollo, info en producción)
- Formato JSON para facilitar análisis
- Logs específicos para:
  - Errores (`logs/%DATE%-error.log`)
  - Aplicación general (`logs/%DATE%-app.log`)
  - Auditoría

Los logs incluyen:
- Timestamp
- Contexto (componente que genera el log)
- Nivel de severidad
- Mensaje
- Datos adicionales relevantes
- Stack trace para errores

---

## **Seguridad**

El proyecto implementa múltiples capas de seguridad:

### **Protección de datos**
- Contraseñas hasheadas con bcrypt
- Validación y sanitización de entradas
- Parámetros preparados en consultas SQL para prevenir inyección
- Redacción de datos sensibles en logs
- Acceso privado a documentos sensibles mediante URLs firmadas

### **Protección de API**
- Autenticación JWT
- Middleware CORS configurado
- Rate limiting adaptativo
- Headers de seguridad HTTP:
  - Content-Security-Policy
  - X-Content-Type-Options
  - X-Frame-Options
  - X-XSS-Protection
  - Strict-Transport-Security (en producción)

### **Monitoreo de seguridad**
- Detección de actividad sospechosa
- Registro de intentos de login fallidos
- Alertas sobre anomalías en transacciones
- Auditoría completa de acciones sensibles

---

> **Nota**: Esta documentación está actualizada a Marzo de 2025 (v1.3.0). Consulta el [CHANGELOG.md](./CHANGELOG.md) para ver el historial completo de cambios.