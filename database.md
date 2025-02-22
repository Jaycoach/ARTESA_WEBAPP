# Estructura de la Base de Datos

## Tablas

### roles
| Campo       | Tipo      | Restricciones           | Descripción                    |
|------------|-----------|------------------------|--------------------------------|
| id         | SERIAL    | PRIMARY KEY           | Identificador único del rol    |
| name       | VARCHAR(50)| NOT NULL              | Nombre del rol                 |
| description| TEXT      |                       | Descripción del rol            |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Fecha de creación            |

### users
| Campo      | Tipo      | Restricciones           | Descripción                    |
|------------|-----------|------------------------|--------------------------------|
| id         | SERIAL    | PRIMARY KEY           | Identificador único del usuario|
| name       | VARCHAR(100)| NOT NULL             | Nombre del usuario            |
| mail       | VARCHAR(255)| NOT NULL, UNIQUE     | Correo electrónico           |
| password   | VARCHAR(255)| NOT NULL             | Contraseña encriptada        |
| rol_id     | INTEGER   | FOREIGN KEY           | Referencia a roles(id)        |
| is_active  | BOOLEAN   | DEFAULT true          | Estado del usuario            |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Fecha de creación           |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Fecha de última actualización|

## Relaciones
- users.rol_id -> roles.id (Foreign Key)

## Scripts de Creación

```sql
-- Incluir aquí todos los scripts de creación de tablas