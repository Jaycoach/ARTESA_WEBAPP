# Documentación de la Base de Datos

Base de datos: ARTESA_WEBAPP
Fecha de generación: 28/2/2025, 4:24:00 a. m.

## Índice

- [Tabla: public.audit_anomalies](#tabla-public.audit-anomalies)
- [Tabla: public.client_profiles](#tabla-public.client-profiles)
- [Tabla: public.login_history](#tabla-public.login-history)
- [Tabla: public.order_details](#tabla-public.order-details)
- [Tabla: public.orders](#tabla-public.orders)
- [Tabla: public.orders_audit](#tabla-public.orders-audit)
- [Tabla: public.password_resets](#tabla-public.password-resets)
- [Tabla: public.products](#tabla-public.products)
- [Tabla: public.roles](#tabla-public.roles)
- [Tabla: public.tokens](#tabla-public.tokens)
- [Tabla: public.transaction_audit_log](#tabla-public.transaction-audit-log)
- [Tabla: public.transactions](#tabla-public.transactions)
- [Tabla: public.users](#tabla-public.users)
- [Tabla: public.v_login_analysis](#tabla-public.v-login-analysis)

---

## Tabla: public.audit_anomalies

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| anomaly_id | integer | NO | nextval('audit_anomalies_anomaly_id_seq'::regclass) | - |
| audit_id | integer | YES | - | - |
| anomaly_type | character varying | NO | - | - |
| severity | USER-DEFINED | NO | - | - |
| details | jsonb | YES | - | - |
| detected_at | timestamp with time zone | YES | CURRENT_TIMESTAMP | - |
| resolved_at | timestamp with time zone | YES | - | - |
| resolved_by | integer | YES | - | - |
| resolution_notes | text | YES | - | - |

---

## Tabla: public.client_profiles

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| client_id | integer | NO | nextval('client_profiles_client_id_seq'::regclass) | - |
| user_id | integer | YES | - | - |
| company_name | character varying | NO | - | - |
| contact_name | character varying | YES | - | - |
| contact_phone | character varying | YES | - | - |
| contact_email | character varying | YES | - | - |
| address | character varying | YES | - | - |
| city | character varying | YES | - | - |
| country | character varying | YES | 'Colombia'::character varying | - |
| tax_id | character varying | YES | - | - |
| price_list | integer | YES | - | - |
| notes | text | YES | - | - |
| fotocopia_cedula | character varying | YES | - | - |
| fotocopia_rut | character varying | YES | - | - |
| anexos_adicionales | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

---

## Tabla: public.login_history

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

---

## Tabla: public.order_details

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| order_detail_id | integer | NO | nextval('order_details_order_detail_id_seq'::regclass) | - |
| order_id | integer | NO | - | - |
| product_id | integer | NO | - | - |
| quantity | integer | NO | - | - |
| unit_price | numeric | NO | - | - |

---

## Tabla: public.orders

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| order_id | integer | NO | nextval('orders_order_id_seq'::regclass) | - |
| user_id | integer | NO | - | - |
| order_date | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| total_amount | numeric | NO | - | - |

---

## Tabla: public.orders_audit

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

---

## Tabla: public.password_resets

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

---

## Tabla: public.products

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

---

## Tabla: public.roles

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('roles_id_seq'::regclass) | - |
| nombre | character varying | NO | - | - |
| description | text | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

---

## Tabla: public.tokens

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('tokens_id_seq'::regclass) | - |
| users_id | integer | YES | - | - |
| token | character varying | NO | - | - |
| expiracion | timestamp without time zone | NO | - | - |

---

## Tabla: public.transaction_audit_log

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| audit_id | integer | NO | nextval('transaction_audit_log_audit_id_seq'::regclass) | - |
| transaction_id | integer | YES | - | - |
| action_type | USER-DEFINED | NO | - | - |
| action_timestamp | timestamp with time zone | YES | CURRENT_TIMESTAMP | - |
| user_id | integer | YES | - | - |
| ip_address | inet | YES | - | - |
| details | jsonb | YES | - | - |
| severity | USER-DEFINED | YES | 'INFO'::severity_level | - |
| old_status | character varying | YES | - | - |
| new_status | character varying | YES | - | - |
| metadata | jsonb | YES | - | - |
| created_at | timestamp with time zone | YES | CURRENT_TIMESTAMP | - |

---

## Tabla: public.transactions

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| transaction_id | integer | NO | nextval('transactions_transaction_id_seq'::regclass) | - |
| order_id | integer | NO | - | - |
| payment_provider | character varying | NO | - | - |
| payment_status | character varying | NO | - | - |
| amount | numeric | NO | - | - |
| currency | character varying | NO | - | - |
| provider_transaction_id | character varying | YES | - | - |
| payment_method | character varying | YES | - | - |
| error_code | character varying | YES | - | - |
| error_message | text | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| metadata | jsonb | YES | - | - |

---

## Tabla: public.users

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

---

## Tabla: public.v_login_analysis

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

