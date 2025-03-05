# Códigos de Error API - LA ARTESA

Este documento define los códigos de error estándar utilizados en la API de LA ARTESA para facilitar el manejo de errores en el frontend y proporcionar respuestas consistentes.

## Estructura de respuesta de error

Las respuestas de error siguen una estructura estándar:

```json
{
  "success": false,
  "errorCode": "ERROR_CODE",
  "message": "Descripción del error en lenguaje entendible para el usuario"
}
```

## Códigos de error HTTP

| Código HTTP | Descripción |
|-------------|-------------|
| 400 | Bad Request - La solicitud tiene estructura incorrecta o datos inválidos |
| 401 | Unauthorized - No autorizado, requiere autenticación |
| 403 | Forbidden - No tiene permisos suficientes para realizar la acción |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Conflicto con el estado actual del recurso |
| 422 | Unprocessable Entity - Datos correctos pero semánticamente inválidos |
| 429 | Too Many Requests - Demasiadas solicitudes (rate limiting) |
| 500 | Internal Server Error - Error interno del servidor |

## Códigos de error específicos

### Autenticación (AUTH_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `AUTH_INVALID_CREDENTIALS` | Credenciales inválidas | 401 |
| `AUTH_EXPIRED_TOKEN` | Token expirado | 401 |
| `AUTH_INVALID_TOKEN` | Token inválido o malformado | 401 |
| `AUTH_MISSING_TOKEN` | Token no proporcionado | 401 |
| `AUTH_INSUFFICIENT_PERMISSIONS` | Permisos insuficientes para la acción | 403 |
| `AUTH_ACCOUNT_LOCKED` | Cuenta bloqueada por múltiples intentos fallidos | 429 |
| `AUTH_RATE_LIMITED` | Demasiados intentos de autenticación | 429 |

### Recuperación de contraseña (PWD_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `PWD_MISSING_TOKEN` | Token de recuperación no proporcionado | 400 |
| `PWD_INVALID_TOKEN` | Token inválido o expirado | 400 |
| `PWD_MISSING_PASSWORD` | Nueva contraseña no proporcionada | 400 |
| `PWD_SAME_PASSWORD` | La nueva contraseña es igual a la actual | 400 |
| `PWD_PASSWORD_COMPLEXITY` | La contraseña no cumple los requisitos de seguridad | 400 |
| `PWD_USER_NOT_FOUND` | Usuario no encontrado | 404 |

### Usuarios (USER_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `USER_NOT_FOUND` | Usuario no encontrado | 404 |
| `USER_ALREADY_EXISTS` | El correo electrónico ya está registrado | 409 |
| `USER_INVALID_DATA` | Datos de usuario inválidos | 400 |
| `USER_INACTIVE` | Usuario inactivo | 403 |

### Productos (PROD_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `PROD_NOT_FOUND` | Producto no encontrado | 404 |
| `PROD_INVALID_DATA` | Datos del producto inválidos | 400 |
| `PROD_DUPLICATE_BARCODE` | El código de barras ya existe | 409 |
| `PROD_INSUFFICIENT_STOCK` | Stock insuficiente | 422 |

### Órdenes (ORDER_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `ORDER_NOT_FOUND` | Orden no encontrada | 404 |
| `ORDER_INVALID_DATA` | Datos de orden inválidos | 400 |
| `ORDER_NO_DETAILS` | Orden sin detalles | 400 |
| `ORDER_PRODUCT_NOT_FOUND` | Producto en la orden no encontrado | 404 |

### Perfiles de clientes (PROFILE_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `PROFILE_NOT_FOUND` | Perfil de cliente no encontrado | 404 |
| `PROFILE_ALREADY_EXISTS` | El usuario ya tiene un perfil | 409 |
| `PROFILE_INVALID_DATA` | Datos de perfil inválidos | 400 |
| `PROFILE_FILE_NOT_FOUND` | Archivo del perfil no encontrado | 404 |
| `PROFILE_FILE_TOO_LARGE` | Archivo excede el tamaño máximo permitido | 400 |

### Pagos (PAY_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `PAY_TRANSACTION_FAILED` | Transacción fallida | 400 |
| `PAY_INVALID_AMOUNT` | Monto inválido | 400 |
| `PAY_INVALID_CURRENCY` | Moneda no soportada | 400 |
| `PAY_INVALID_METHOD` | Método de pago no soportado | 400 |
| `PAY_MISSING_HEADERS` | Headers requeridos faltantes | 400 |

### Archivos (FILE_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `FILE_TOO_LARGE` | Archivo demasiado grande | 400 |
| `FILE_INVALID_TYPE` | Tipo de archivo no soportado | 400 |
| `FILE_UPLOAD_FAILED` | Error en la carga del archivo | 500 |
| `FILE_NOT_FOUND` | Archivo no encontrado | 404 |

### Base de datos (DB_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `DB_QUERY_ERROR` | Error en consulta a base de datos | 500 |
| `DB_CONNECTION_ERROR` | Error de conexión a base de datos | 500 |
| `DB_TRANSACTION_ERROR` | Error en transacción de base de datos | 500 |
| `DB_CONSTRAINT_VIOLATION` | Violación de restricción de integridad | 409 |

### Validación (VAL_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `VAL_MISSING_FIELD` | Campo requerido faltante | 400 |
| `VAL_INVALID_FORMAT` | Formato de campo inválido | 400 |
| `VAL_INVALID_LENGTH` | Longitud de campo inválida | 400 |
| `VAL_INVALID_VALUE` | Valor de campo inválido | 400 |

### Seguridad (SEC_*)

| Código | Descripción | HTTP |
|--------|-------------|------|
| `SEC_INVALID_IP` | Acceso desde IP no permitida | 403 |
| `SEC_SUSPICIOUS_ACTIVITY` | Actividad sospechosa detectada | 403 |
| `SEC_CORS_VIOLATION` | Violación de política CORS | 403 |
| `SEC_CSRF_TOKEN_INVALID` | Token CSRF inválido | 403 |

## Implementación en el código

Ejemplo de uso en un controlador:

```javascript
return res.status(400).json({
  success: false,
  errorCode: 'PWD_INVALID_TOKEN',
  message: 'El token es inválido o ha expirado'
});
```

## Manejo de errores en el frontend

Ejemplo de manejo de errores en React:

```javascript
try {
  const response = await api.post('/auth/login', credentials);
  // Manejo de éxito...
} catch (error) {
  if (error.response) {
    const { errorCode } = error.response.data;
    
    switch (errorCode) {
      case 'AUTH_INVALID_CREDENTIALS':
        setError('Las credenciales son incorrectas');
        break;
      case 'AUTH_ACCOUNT_LOCKED':
        setError('Tu cuenta ha sido bloqueada temporalmente. Intenta más tarde');
        break;
      // Otros casos...
      default:
        setError('Ha ocurrido un error. Intenta nuevamente');
    }
  }
}
```