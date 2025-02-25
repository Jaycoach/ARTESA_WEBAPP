# **LA ARTESA - WEB APP Documentation**

Este proyecto es una API para la aplicación web **LA ARTESA**, que permite gestionar usuarios, autenticación, productos, pedidos y otras funcionalidades relacionadas con SAP Business One.

---

## **Tabla de Contenidos**
1. [Requisitos](#requisitos)
2. [Configuración del Proyecto](#configuración-del-proyecto)
3. [Base de Datos](#base-de-datos)
   - [Estructura de Tablas](#estructura-de-tablas)
4. [Endpoints](#endpoints)
   - [Autenticación](#autenticación)
   - [Usuarios](#usuarios)
   - [Productos](#productos)
5. [Subida de Imágenes](#subida-de-imágenes)
6. [Ejecución del Proyecto](#ejecución-del-proyecto)
7. [Documentación de la API](#documentación-de-la-api)
8. [Documentación Adicional](#documentación-adicional)

---

## **Requisitos**
- Node.js (v16 o superior)
- PostgreSQL (v12 o superior)
- npm (v8 o superior)

---

## **Configuración del Proyecto**

### **1. Clonar el Repositorio**
```bash
git clone https://github.com/Jaycoach/ARTESA_WEBAPP.git
cd ARTERSA_WEBAPP
2. Instalar Dependencias
bash
Copy
npm install
3. Configurar Variables de Entorno
Crea un archivo .env en la raíz del proyecto y agrega las siguientes variables:

env
Copy
# Configuración de la base de datos
DB_HOST=localhost
DB_USER=admin
DB_PASSWORD=4dm1n*
DB_DATABASE=ARTESA_WEBAPP
DB_PORT=5432

# Configuración de JWT
JWT_SECRET=mi_secreto_jwt

# Configuración de Multer (Local)
UPLOADS_DIR=uploads

# Configuración de AWS S3 (solo para producción)
AWS_ACCESS_KEY_ID=tu-access-key-id
AWS_SECRET_ACCESS_KEY=tu-secret-access-key
AWS_REGION=tu-region
AWS_S3_BUCKET_NAME=nombre-de-tu-bucket-s3
Base de Datos
Estructura de Tablas
La base de datos incluye las siguientes tablas principales:

products: Almacena información sobre los productos.

Campos:

product_id (Serial, PK)

name (VARCHAR)

description (TEXT)

code (VARCHAR, Unique)

price_list1 (NUMERIC)

price_list2 (NUMERIC)

price_list3 (NUMERIC)

barcode (VARCHAR, Unique)

image_url (TEXT)

stock (INT)

created_at (TIMESTAMP)

updated_at (TIMESTAMP)

users: Almacena información de los usuarios.

orders: Almacena información de los pedidos.

order_details: Almacena los detalles de los pedidos.

Para más detalles, consulta el Diagrama ER.

Endpoints
Autenticación
Registro de Usuarios: POST /api/auth/register

Inicio de Sesión: POST /api/auth/login

Usuarios
Obtener Todos los Usuarios: GET /api/users

Obtener un Usuario por ID: GET /api/users/:id

Productos
Crear un Producto: POST /api/products

Obtener Todos los Productos: GET /api/products

Obtener un Producto por Código: GET /api/products/:code

Actualizar la Imagen de un Producto: PUT /api/products/:code/image

Subida de Imágenes
La aplicación permite la subida de imágenes utilizando Multer. Durante el desarrollo, las imágenes se almacenan en la carpeta uploads del servidor. En producción, las imágenes se suben a Amazon S3.

Ejemplo de Uso
Realiza una solicitud POST a http://localhost:3000/upload.

En el cuerpo de la solicitud, selecciona form-data.

Agrega un campo llamado image (de tipo file) y selecciona una imagen para subir.

Si la subida es exitosa, recibirás una respuesta con la URL de la imagen:

json
Copy
{
  "imageUrl": "http://localhost:3000/uploads/1698251234567.jpg"
}
Ejecución del Proyecto
Iniciar el Servidor:

bash
Copy
npm start
El servidor estará disponible en http://localhost:3000.

Acceder a la Documentación de la API:

Visita http://localhost:3000/api-docs para ver la documentación interactiva de la API.

Documentación de la API
La documentación de la API está disponible en formato Swagger. Puedes acceder a ella en:

Local: http://localhost:3000/api-docs

Producción: http://tu-dominio.com/api-docs

Documentación Adicional
CHANGELOG: Registro de cambios en la base de datos y el proyecto.

Diagrama ER: Diagrama entidad-relación de la base de datos.

# API de Pedidos

## Endpoints

### Crear una orden
- **POST** `/api/orders`
- Crea una nueva orden con detalles asociados.
- Body:
  ```json
  {
    "user_id": 1,
    "total_amount": 100.00,
    "details": [
      {
        "product_id": 101,
        "quantity": 2,
        "unit_price": 25.00
      }
    ]
  }

---

### Paso 9: Probar la aplicación
1. Inicia el servidor:
   ```bash
   npm start

# LA ARTESA - WEB APP Documentation

## Estructura del Proyecto

### Backend

/
├── scripts/
│   └── hashPasswords.js          # Utilidad para hasheo de contraseñas
├── src/
│   ├── config/
│   ├── controllers/
│   │   └── authController.js     # Controlador de autenticación
│   ├── middleware/
│   │   └── auth.js              # Middleware de autenticación
│   ├── models/
│   │   └── userModel.js         # Modelo de usuario
│   ├── routes/
│   │   ├── authRoutes.js        # Rutas de autenticación
│   │   ├── productRoutes.js     # Rutas de productos
│   │   └── secureProductRoutes.js # Rutas protegidas
│   └── views/
│       └── frontend/
│           └── LoginArtesa/     # Aplicación Frontend
├── app.js                       # Entrada principal del servidor
└── package.json

### Frontend
/src/views/frontend/LoginArtesa/
├── src/
│   ├── api/
│   │   └── config.js           # Configuración de API
│   └── Components/
│       └── Dashboard/
│           └── Sidebar Section/
│               ├── Sidebar.jsx
│               └── sidebar.css


## Sistema de Autenticación

### Backend
- `authController.js`: Maneja login y registro
- `auth.js`: Middleware para protección de rutas
- `secureProductRoutes.js`: Rutas que requieren autenticación

### Frontend
- `config.js`: Configuración de endpoints y headers
- `Sidebar.jsx`: Incluye funcionalidad de logout


# Sistema de Recuperación de Contraseña

## Nuevas Funcionalidades

### Recuperación de Contraseña
El sistema ahora incluye un flujo completo de recuperación de contraseña:

1. **Solicitud de Recuperación**
   - Endpoint: `POST /api/password/request-reset`
   - El usuario proporciona su correo electrónico
   - Se envía un email con un token de recuperación

2. **Restablecimiento de Contraseña**
   - Endpoint: `POST /api/password/reset`
   - El usuario proporciona el token y la nueva contraseña
   - Validación de token y actualización segura

### Configuración Requerida

1. Variables de Entorno
```env
SMTP_HOST=tu-servidor-smtp
SMTP_PORT=587
SMTP_USER=tu-usuario
SMTP_PASS=tu-contraseña
SMTP_FROM=noreply@tudominio.com
FRONTEND_URL=http://tu-frontend-url
```

2. Base de Datos
```sql
-- Ejecutar el script de creación de tabla password_resets
-- Ver archivo de migración para detalles
```

### Seguridad
- Tokens criptográficamente seguros
- Expiración automática de tokens
- Protección contra enumeración de usuarios
- Tokens de un solo uso

### Documentación API
La documentación completa está disponible en Swagger:
- Local: http://localhost:3000/api-docs
- Producción: https://tu-dominio.com/api-docs

## Integración Frontend

### Flujo de Recuperación
1. Usuario solicita recuperación en la página de login
2. Ingresa su correo electrónico
3. Recibe email con link de recuperación
4. Accede al link y establece nueva contraseña
5. Redirección a login con mensaje de éxito

### Endpoints
```javascript
// Solicitar recuperación
const requestReset = async (email) => {
  const response = await fetch('/api/password/request-reset', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
};

// Restablecer contraseña
const resetPassword = async (token, newPassword) => {
  const response = await fetch('/api/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword })
  });
};