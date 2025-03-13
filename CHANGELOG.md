# CHANGELOG

Este documento registra todos los cambios significativos en el proyecto LA ARTESA Web App.

## [v1.3.0] - 2025-03-20

### Añadido
- **Integración con AWS S3 para almacenamiento de archivos**
  - Servicio centralizado S3Service para gestión de archivos
  - Soporte para URLs prefirmadas para documentos privados
  - Configuración dual (local/S3) para facilitar desarrollo
  - Script de migración para transferir archivos existentes a S3
  - Manejo automático de renovación de URLs expiradas
  - Almacenamiento seguro para documentos sensibles (cédulas, RUT, anexos)

- **Integración completa con SAP Business One Service Layer**
  - Sistema de sincronización bidireccional de productos
  - Soporte para sincronización programada general y por grupos
  - Panel de administración para gestionar sincronización
  -

## [v1.2.1] - 2025-02-28

### Añadido
- **Sistema completo de perfiles de clientes**
  - Nuevos endpoints CRUD en `/api/client-profiles`
  - Soporte para gestión de documentos corporativos (cédula, RUT, anexos)
  - Implementación de controladores, modelos y rutas asociadas
  - Validación de unicidad de perfiles por usuario

### Cambiado
- **Migración de Swagger a JSDocs**
  - Reemplazado el archivo JSON estático por documentación integrada en código
  - Implementación de anotaciones JSDoc en controladores y rutas
  - Mejora en la interactividad de la documentación de API
  - Mayor facilidad de mantenimiento al vincular documentación y código

### Mejorado
- Optimización de las rutas de archivos para perfiles de clientes
- Mayor validación en formularios de perfiles
- Estructura de directorios para archivos subidos

## [v1.2.0] - 2025-02-21

### Añadido
- **Sistema de recuperación de contraseña**
  - Nuevos endpoints para solicitar y restablecer contraseñas
  - Integración con servicio de correo electrónico para envío de tokens
  - Nueva tabla `password_resets` en la base de datos
- **Sistema de perfiles de clientes**
  - Implementación completa de CRUD para perfiles de clientes
  - Soporte para subida de documentos (cédula, RUT, anexos)
  - Interfaz para gestión y visualización de perfiles
- **Sistema de auditoría y seguridad**
  - Monitoreo de intentos de login
  - Detección de anomalías en transacciones
  - Registros detallados de acciones sensibles
- **Integración del sistema de autenticación Frontend-Backend**
- **Script de hasheo de contraseñas** (scripts/hashPasswords.js)

### Cambiado
- Actualización del controlador de autenticación (`src/controllers/authController.js`)
- Mejora del middleware de autenticación (`src/middleware/auth.js`)
- Actualización del modelo de usuario (`src/models/userModel.js`)
- Restructuración de rutas de autenticación y productos
- Corrección de la ruta de autenticación en app.js
- Actualización de configuración Vite

### Seguridad
- Implementación de sistema robusto de autenticación JWT
- Mejora en manejo de contraseñas con bcrypt
- Implementación de rutas protegidas
- Tokens de recuperación de contraseña de un solo uso con expiración
- Protección contra enumeración de usuarios

## [v1.1.0] - 2025-02-20

### Añadido
- **Entidad de productos con campos extendidos**:
  - Código único de producto
  - Múltiples listas de precios
  - Código de barras
  - Soporte para imágenes
- **Integración de Multer** para la subida de imágenes a Amazon S3
- **Documentación de la API en Swagger** para endpoints de productos
- **Validadores de autenticación** en el archivo `authValidators.js`
- **Sanitización de datos** en el middleware de seguridad
- **Rate limiting** en las solicitudes de autenticación
- **Validación de intentos de login** para prevenir ataques de fuerza bruta

### Cambiado
- Estructura del proyecto para incluir la capa de servicios
- Configuración de variables de entorno para AWS S3
- Refactorización del archivo `authRoutes.js` para utilizar validadores

### Corregido
- Errores menores en la autenticación de usuarios

### Base de Datos
- Nuevos campos en la tabla `products`:
  - `code`: Código único del producto
  - `price_list1`, `price_list2`, `price_list3`: Listas de precios
  - `barcode`: Código de barras único
  - `image_url`: URL de la imagen del producto

## [v1.0.0] - 2025-02-15

### Base de Datos
- **Creación de la estructura inicial**:
  - Tabla `Products` para el catálogo de productos
  - Tabla `Orders` para pedidos de clientes
  - Tabla `Order_Details` para detalles de cada pedido
  - Columnas `created_at` y `updated_at` en todas las tablas principales
- **Optimización de rendimiento**:
  - Índices para mejorar la velocidad de consultas
  - Triggers para actualización automática de `updated_at`

### Añadido
- **Endpoint para crear órdenes** con detalles
- **Validación en la base de datos** para evitar órdenes sin detalles
- **Sistema de autenticación básico** con roles de usuario
- **API RESTful** para gestión de productos y pedidos

### Sistema
- Estructura inicial del proyecto Node.js con Express
- Configuración de conexión a base de datos PostgreSQL
- Integración de Swagger para documentación de API
- Implementación de middleware para manejo de errores

---

## Historial de Dependencias Añadidas

### Versión 1.2.0
- `nodemailer` para envío de correos electrónicos
- `winston` y `winston-daily-rotate-file` para sistema de logs
- `express-fileupload` para manejo de archivos
- `uuid` para generación de identificadores únicos

### Versión 1.1.0
- `password-validator` para la validación de contraseñas
- `express-rate-limit` para el limitador de velocidad en solicitudes
- `multer` y `multer-s3` para carga de archivos
- `aws-sdk` para integración con Amazon S3

### Versión 1.0.0
- `express` como framework web
- `pg` para conexión con PostgreSQL
- `bcrypt` para hash de contraseñas
- `jsonwebtoken` para autenticación JWT
- `cors` para manejo de CORS
- `dotenv` para variables de entorno
- `swagger-jsdoc` y `swagger-ui-express` para documentación de API