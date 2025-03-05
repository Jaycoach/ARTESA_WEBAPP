# Arquitectura de LA ARTESA Web App

Este documento describe la arquitectura general del sistema, los patrones de diseño utilizados y el flujo de datos entre los componentes principales.

## Visión General

LA ARTESA Web App es una aplicación RESTful basada en Node.js y Express que proporciona una API para la gestión de usuarios, productos, pedidos y perfiles de clientes. La aplicación utiliza una arquitectura en capas con separación clara de responsabilidades.

![Diagrama de Arquitectura](./diagrams/architecture_overview.png)

## Capas de la Aplicación

### 1. Capa de Presentación (API RESTful)

Constituida por los endpoints HTTP que exponen la funcionalidad del sistema a clientes externos.

**Componentes clave:**
- **Routes**: Definen los endpoints disponibles y conectan las solicitudes HTTP con los controladores correspondientes.
- **Middleware**: Procesan las solicitudes antes de llegar a los controladores (autenticación, validación, etc.).
- **Swagger**: Proporciona documentación interactiva de la API.

### 2. Capa de Controladores

Maneja la lógica de negocio específica de cada solicitud, coordina el flujo de datos entre la capa de presentación y los modelos.

**Componentes clave:**
- **Controllers**: Implementan la lógica de cada endpoint (authController, productController, etc.).
- **Validators**: Validan y sanitizan los datos de entrada.

### 3. Capa de Servicios

Implementa la lógica de negocio compartida y proporciona funcionalidades reutilizables a los controladores.

**Componentes clave:**
- **EmailService**: Gestiona el envío de correos electrónicos.
- **AuditService**: Registra y consulta eventos de auditoría.

### 4. Capa de Acceso a Datos

Maneja las interacciones con la base de datos y abstrae los detalles de persistencia.

**Componentes clave:**
- **Models**: Representan las entidades de negocio y encapsulan la lógica de acceso a datos.
- **Database Utils**: Proporciona funciones de utilidad para las operaciones de base de datos.

### 5. Capa de Infraestructura

Proporciona servicios técnicos y configuraciones que soportan las otras capas.

**Componentes clave:**
- **Logger**: Sistema de registro centralizado.
- **Config**: Configuraciones de la aplicación.
- **Security**: Implementaciones de seguridad.

## Patrones de Diseño Utilizados

### Patrón MVC (Model-View-Controller)
- **Modelo**: Implementado en los archivos del directorio `models/`
- **Vista**: No hay vistas tradicionales; la API devuelve JSON
- **Controlador**: Implementado en los archivos del directorio `controllers/`

### Singleton
Utilizado en:
- **Database Connection Pool**: Para mantener una única instancia de conexión a la base de datos.
- **Roles Model**: Para cachear y proporcionar información sobre roles.

### Middleware Chain
Utilizado para procesar solicitudes HTTP a través de múltiples capas de middleware:
1. Global Middleware (CORS, JSON parsing, etc.)
2. Route-Specific Middleware (auth, validation, etc.)
3. Controller Execution

### Factory Method
Utilizado en:
- **Logger Creation**: Para crear instancias de logger con contexto específico.

### Facade
Utilizado en:
- **Database Utils**: Proporciona una interfaz simplificada para interactuar con la base de datos.

## Flujo de Datos

### Ejemplo: Proceso de Autenticación

1. El cliente envía credenciales a `/api/auth/login`
2. El middleware `sanitizeBody` sanitiza la entrada
3. El middleware `validateLoginData` valida que los campos requeridos estén presentes
4. `authController.login` procesa la solicitud:
   - Busca al usuario en la base de datos
   - Verifica la contraseña
   - Genera un token JWT
   - Registra el intento de login
5. Se devuelve una respuesta con el token JWT o un mensaje de error

### Ejemplo: Creación de un Pedido

1. El cliente envía datos del pedido a `/api/orders`
2. El middleware `verifyToken` verifica la autenticación
3. `orderController.createOrder` procesa la solicitud:
   - Valida los datos del pedido
   - Inicia una transacción de base de datos
   - Crea el pedido y sus detalles
   - Confirma la transacción
4. Se devuelve una respuesta con los detalles del pedido creado

## Sistema de Auditoría y Seguridad

El sistema implementa un robusto mecanismo de auditoría y seguridad:

### Auditoría
- Todos los eventos importantes se registran en `transaction_audit_log`
- Se capturan intentos de login, transacciones de pago y accesos a datos sensibles
- El sistema detecta automáticamente anomalías basadas en patrones

### Seguridad
- Autenticación basada en JWT con roles de usuario
- Rate limiting para prevenir ataques de fuerza bruta
- Sanitización de entradas para prevenir XSS e inyección SQL
- Headers de seguridad HTTP para prevenir diversos ataques

## Integración con Servicios Externos

El sistema está diseñado para integrarse con:

- **Servicio de correo electrónico**: Para envío de notificaciones y recuperación de contraseñas
- **Almacenamiento de archivos**: Local o en AWS S3 para documentos de perfiles de clientes

## Escalabilidad y Rendimiento

- **Connection Pool**: Para gestionar eficientemente las conexiones a la base de datos
- **Caching**: Implementado para información estática como roles
- **Transacciones eficientes**: Uso de transacciones de base de datos para operaciones complejas

## Observabilidad

- **Logging centralizado**: Utilizando Winston para capturar logs estructurados con contexto
- **Rotación de logs**: Para gestionar eficientemente el espacio en disco
- **Niveles de log configurables**: Diferente granularidad según el entorno

## Consideraciones para el Futuro

- **Microservicios**: Posible migración hacia una arquitectura de microservicios para módulos específicos
- **Caché distribuida**: Implementación de Redis para mejorar rendimiento
- **Contenedorización**: Empaquetado en Docker para facilitar despliegue y escalado

## Diagramas Adicionales

- [Diagrama de Componentes](./diagrams/component_diagram.png)
- [Diagrama de Secuencia - Autenticación](./diagrams/sequence_auth.png)
- [Diagrama de Secuencia - Procesamiento de Pedidos](./diagrams/sequence_orders.png)
- [Diagrama de Entidad-Relación](./diagrams/er_diagram.png)