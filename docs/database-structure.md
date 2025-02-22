# Documentación de la Base de Datos

Base de datos: ARTESA_WEBAPP

Fecha de generación: 22/2/2025, 5:15:03 a. m.

## Tabla: order_details

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| order_detail_id | integer | NO | nextval('order_details_order_detail_id_seq'::regclass) | - |
| order_id | integer | NO | - | - |
| product_id | integer | NO | - | - |
| quantity | integer | NO | - | - |
| unit_price | numeric | NO | - | - |

## Tabla: orders

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| order_id | integer | NO | nextval('orders_order_id_seq'::regclass) | - |
| user_id | integer | NO | - | - |
| order_date | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| total_amount | numeric | NO | - | - |

## Tabla: orders_audit

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| audit_id | integer | NO | nextval('orders_audit_audit_id_seq'::regclass) | - |
| order_id | integer | NO | - | - |
| user_id | integer | NO | - | - |
| action_type | character varying | NO | - | - |
| action_date | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| old_total_amount | numeric | YES | - | - |
| new_total_amount | numeric | YES | - | - |

## Tabla: password_resets

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('password_resets_id_seq'::regclass) | Identificador único del registro |
| user_id | integer | NO | - | ID del usuario que solicitó el reset de contraseña |
| token | character varying | NO | - | Token único para verificar la solicitud de reset |
| used | boolean | YES | false | Indica si el token ya fue utilizado |
| expires_at | timestamp without time zone | NO | - | Fecha y hora de expiración del token |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | Fecha y hora de creación del registro |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | Fecha y hora de última actualización del registro |

## Tabla: products

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| product_id | integer | NO | nextval('products_product_id_seq'::regclass) | - |
| name | character varying | NO | - | - |
| description | text | YES | - | - |
| price_list1 | numeric | NO | 0.00 | - |
| price_list2 | numeric | NO | 0.00 | - |
| price_list3 | numeric | NO | 0.00 | - |
| stock | integer | NO | - | - |
| barcode | character varying | YES | - | - |
| image_url | text | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

## Tabla: roles

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('roles_id_seq'::regclass) | - |
| nombre | character varying | NO | - | - |
| description | text | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

## Tabla: tokens

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('tokens_id_seq'::regclass) | - |
| users_id | integer | YES | - | - |
| token | character varying | NO | - | - |
| expiracion | timestamp without time zone | NO | - | - |

## Tabla: users

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('users_id_seq'::regclass) | - |
| name | character varying | NO | - | - |
| mail | character varying | NO | - | - |
| password | character varying | NO | - | - |
| rol_id | integer | NO | 2 | - |
| created_at | timestamp without time zone | NO | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | NO | CURRENT_TIMESTAMP | - |
| is_active | boolean | YES | true | - |

