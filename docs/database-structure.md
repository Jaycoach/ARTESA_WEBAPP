# Documentación de la Base de Datos

Base de datos: ARTESA_WEBAPP
Fecha de generación: 23/2/2025, 4:42:45 p. m.

## Índice

- [Tabla: login_history](#tabla-login-history)
- [Tabla: order_details](#tabla-order-details)
- [Tabla: orders](#tabla-orders)
- [Tabla: orders_audit](#tabla-orders-audit)
- [Tabla: password_resets](#tabla-password-resets)
- [Tabla: products](#tabla-products)
- [Tabla: roles](#tabla-roles)
- [Tabla: tokens](#tabla-tokens)
- [Tabla: users](#tabla-users)
- [Tabla: v_login_analysis](#tabla-v-login-analysis)

---

## Tabla: login_history

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('login_history_id_seq'::regclass) | Identificador único del registro |
| user_id | integer | NO | - | ID del usuario que intentó iniciar sesión |
| login_timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP | Fecha y hora del intento de inicio de sesión |
| ip_address | inet | NO | - | Dirección IP desde donde se realizó el intento |
| status | character varying | YES | 'success'::character varying | Estado del intento: success o failed |
| attempt_details | text | YES | - | Detalles adicionales del intento |
| user_agent | text | YES | - | User Agent del navegador usado |
| created_at | timestamp without time zone | NO | CURRENT_TIMESTAMP | Fecha y hora de creación del registro |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| fk_login_history_user | FOREIGN KEY | user_id | users(id) |
| login_history_pkey | PRIMARY KEY | id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_login_history_ip | CREATE INDEX idx_login_history_ip ON public.login_history USING btree (ip_address) |
| idx_login_history_status | CREATE INDEX idx_login_history_status ON public.login_history USING btree (status) |
| idx_login_history_timestamp | CREATE INDEX idx_login_history_timestamp ON public.login_history USING btree (login_timestamp) |
| idx_login_history_user_id | CREATE INDEX idx_login_history_user_id ON public.login_history USING btree (user_id) |
| login_history_pkey | CREATE UNIQUE INDEX login_history_pkey ON public.login_history USING btree (id) |

---

## Tabla: order_details

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| order_detail_id | integer | NO | nextval('order_details_order_detail_id_seq'::regclass) | - |
| order_id | integer | NO | - | - |
| product_id | integer | NO | - | - |
| quantity | integer | NO | - | - |
| unit_price | numeric | NO | - | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| order_details_order_id_fkey | FOREIGN KEY | order_id | orders(order_id) |
| order_details_pkey | PRIMARY KEY | order_detail_id | - |
| order_details_product_id_fkey | FOREIGN KEY | product_id | products(product_id) |

### Índices

| Nombre | Definición |
|--------|------------|
| order_details_pkey | CREATE UNIQUE INDEX order_details_pkey ON public.order_details USING btree (order_detail_id) |

---

## Tabla: orders

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| order_id | integer | NO | nextval('orders_order_id_seq'::regclass) | - |
| user_id | integer | NO | - | - |
| order_date | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| total_amount | numeric | NO | - | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| orders_pkey | PRIMARY KEY | order_id | - |
| orders_user_id_fkey | FOREIGN KEY | user_id | users(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| orders_pkey | CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (order_id) |

---

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

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| orders_audit_pkey | PRIMARY KEY | audit_id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| orders_audit_pkey | CREATE UNIQUE INDEX orders_audit_pkey ON public.orders_audit USING btree (audit_id) |

---

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

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| password_resets_pkey | PRIMARY KEY | id | - |
| password_resets_user_id_fkey | FOREIGN KEY | user_id | users(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_password_resets_created_at | CREATE INDEX idx_password_resets_created_at ON public.password_resets USING btree (created_at) |
| idx_password_resets_expires_at | CREATE INDEX idx_password_resets_expires_at ON public.password_resets USING btree (expires_at) |
| idx_password_resets_token | CREATE INDEX idx_password_resets_token ON public.password_resets USING btree (token) |
| idx_password_resets_user_id | CREATE INDEX idx_password_resets_user_id ON public.password_resets USING btree (user_id) |
| password_resets_pkey | CREATE UNIQUE INDEX password_resets_pkey ON public.password_resets USING btree (id) |
| unique_active_token | CREATE UNIQUE INDEX unique_active_token ON public.password_resets USING btree (user_id) WHERE (used = false) |

---

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

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| products_barcode_key | UNIQUE | barcode | - |
| products_pkey | PRIMARY KEY | product_id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| products_barcode_key | CREATE UNIQUE INDEX products_barcode_key ON public.products USING btree (barcode) |
| products_pkey | CREATE UNIQUE INDEX products_pkey ON public.products USING btree (product_id) |

---

## Tabla: roles

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('roles_id_seq'::regclass) | - |
| nombre | character varying | NO | - | - |
| description | text | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| roles_nombre_key | UNIQUE | nombre | - |
| roles_pkey | PRIMARY KEY | id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| roles_nombre_key | CREATE UNIQUE INDEX roles_nombre_key ON public.roles USING btree (nombre) |
| roles_pkey | CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id) |

---

## Tabla: tokens

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('tokens_id_seq'::regclass) | - |
| users_id | integer | YES | - | - |
| token | character varying | NO | - | - |
| expiracion | timestamp without time zone | NO | - | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| tokens_pkey | PRIMARY KEY | id | - |
| tokens_users_id_fkey | FOREIGN KEY | users_id | users(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| tokens_pkey | CREATE UNIQUE INDEX tokens_pkey ON public.tokens USING btree (id) |

---

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

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| fk_user_role | FOREIGN KEY | rol_id | roles(id) |
| users_mail_key | UNIQUE | mail | - |
| users_pkey | PRIMARY KEY | id | - |
| users_rol_id_fkey | FOREIGN KEY | rol_id | roles(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_users_mail | CREATE INDEX idx_users_mail ON public.users USING btree (mail) |
| users_mail_key | CREATE UNIQUE INDEX users_mail_key ON public.users USING btree (mail) |
| users_pkey | CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id) |

---

## Tabla: v_login_analysis

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | YES | - | - |
| user_id | integer | YES | - | - |
| login_timestamp | timestamp without time zone | YES | - | - |
| ip_address | inet | YES | - | - |
| status | character varying | YES | - | - |
| attempt_details | text | YES | - | - |
| user_agent | text | YES | - | - |
| created_at | timestamp without time zone | YES | - | - |

---

