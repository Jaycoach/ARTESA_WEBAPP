# Documentación de la Base de Datos

Base de datos: undefined
Fecha de generación: 10/3/2025, 7:13:48 p. m.

## Tipos Personalizados

### Tipo: audit_event_type

**Tipo de dato:** ENUM

**Valores:**

- `PAYMENT_INITIATED`
- `PAYMENT_PROCESSED`
- `PAYMENT_FAILED`
- `PAYMENT_REVERSED`
- `DATA_ACCESSED`
- `SECURITY_EVENT`

### Tipo: cuenta_tipo

**Tipo de dato:** ENUM

**Valores:**

- `Ahorros`
- `Corriente`

### Tipo: documento_tipo

**Tipo de dato:** ENUM

**Valores:**

- `CC`
- `CE`
- `PASAPORTE`

### Tipo: empresa_tamano

**Tipo de dato:** ENUM

**Valores:**

- `Microempresa`
- `Pequeña`
- `Mediana`
- `Grande`

### Tipo: severity_level

**Tipo de dato:** ENUM

**Valores:**

- `INFO`
- `WARNING`
- `ERROR`
- `CRITICAL`

---

## Índice de Tablas

- [Tabla: active_tokens](#tabla-active-tokens)
- [Tabla: audit_anomalies](#tabla-audit-anomalies)
- [Tabla: client_contacts](#tabla-client-contacts)
- [Tabla: client_profiles](#tabla-client-profiles)
- [Tabla: login_history](#tabla-login-history)
- [Tabla: order_details](#tabla-order-details)
- [Tabla: orders](#tabla-orders)
- [Tabla: orders_audit](#tabla-orders-audit)
- [Tabla: password_resets](#tabla-password-resets)
- [Tabla: product_images](#tabla-product-images)
- [Tabla: products](#tabla-products)
- [Tabla: revoked_tokens](#tabla-revoked-tokens)
- [Tabla: roles](#tabla-roles)
- [Tabla: tokens](#tabla-tokens)
- [Tabla: transaction_audit_log](#tabla-transaction-audit-log)
- [Tabla: transactions](#tabla-transactions)
- [Tabla: users](#tabla-users)

---

## Tabla: active_tokens

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('active_tokens_id_seq'::regclass) | - |
| token_hash | character varying | NO | - | - |
| user_id | integer | NO | - | - |
| issued_at | timestamp without time zone | NO | CURRENT_TIMESTAMP | - |
| expires_at | timestamp without time zone | NO | - | - |
| device_info | text | YES | - | - |
| ip_address | inet | YES | - | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| active_tokens_pkey | PRIMARY KEY | id | - |
| active_tokens_token_hash_key | UNIQUE | token_hash | - |
| active_tokens_user_id_fkey | FOREIGN KEY | user_id | users(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| active_tokens_pkey | CREATE UNIQUE INDEX active_tokens_pkey ON public.active_tokens USING btree (id) |
| active_tokens_token_hash_key | CREATE UNIQUE INDEX active_tokens_token_hash_key ON public.active_tokens USING btree (token_hash) |
| idx_active_tokens_expires_at | CREATE INDEX idx_active_tokens_expires_at ON public.active_tokens USING btree (expires_at) |
| idx_active_tokens_hash | CREATE INDEX idx_active_tokens_hash ON public.active_tokens USING btree (token_hash) |
| idx_active_tokens_user_id | CREATE INDEX idx_active_tokens_user_id ON public.active_tokens USING btree (user_id) |

---

## Tabla: audit_anomalies

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| anomaly_id | integer | NO | nextval('audit_anomalies_anomaly_id_seq'::regclass) | - |
| audit_id | integer | YES | - | - |
| anomaly_type | character varying | NO | - | - |
| severity | severity_level | NO | - | - |
| details | jsonb | YES | - | - |
| detected_at | timestamp with time zone | YES | CURRENT_TIMESTAMP | - |
| resolved_at | timestamp with time zone | YES | - | - |
| resolved_by | integer | YES | - | - |
| resolution_notes | text | YES | - | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| audit_anomalies_audit_id_fkey | FOREIGN KEY | audit_id | transaction_audit_log(audit_id) |
| audit_anomalies_pkey | PRIMARY KEY | anomaly_id | - |
| audit_anomalies_resolved_by_fkey | FOREIGN KEY | resolved_by | users(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| audit_anomalies_pkey | CREATE UNIQUE INDEX audit_anomalies_pkey ON public.audit_anomalies USING btree (anomaly_id) |
| idx_anomalies_audit | CREATE INDEX idx_anomalies_audit ON public.audit_anomalies USING btree (audit_id) |
| idx_anomalies_type | CREATE INDEX idx_anomalies_type ON public.audit_anomalies USING btree (anomaly_type) |

---

## Tabla: client_contacts

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| contact_id | integer | NO | nextval('client_contacts_contact_id_seq'::regclass) | - |
| client_id | integer | NO | - | - |
| name | character varying | YES | - | - |
| position | character varying | YES | - | - |
| phone | character varying | YES | - | - |
| email | character varying | YES | - | - |
| is_primary | boolean | YES | false | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| client_contacts_client_id_fkey | FOREIGN KEY | client_id | client_profiles(client_id) |
| client_contacts_pkey | PRIMARY KEY | contact_id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| client_contacts_pkey | CREATE UNIQUE INDEX client_contacts_pkey ON public.client_contacts USING btree (contact_id) |
| idx_client_contacts_client_id | CREATE INDEX idx_client_contacts_client_id ON public.client_contacts USING btree (client_id) |
| idx_client_contacts_is_primary | CREATE INDEX idx_client_contacts_is_primary ON public.client_contacts USING btree (is_primary) |

---

## Tabla: client_profiles

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| client_id | integer | NO | nextval('client_profiles_client_id_seq'::regclass) | - |
| user_id | integer | YES | - | - |
| company_name | character varying | YES | - | - |
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

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| client_profiles_pkey | PRIMARY KEY | client_id | - |
| client_profiles_user_id_fkey | FOREIGN KEY | user_id | users(id) |
| unique_user_profile | UNIQUE | user_id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| client_profiles_pkey | CREATE UNIQUE INDEX client_profiles_pkey ON public.client_profiles USING btree (client_id) |
| idx_client_profiles_company_name | CREATE INDEX idx_client_profiles_company_name ON public.client_profiles USING btree (company_name) |
| idx_client_profiles_user_id | CREATE INDEX idx_client_profiles_user_id ON public.client_profiles USING btree (user_id) |
| unique_user_profile | CREATE UNIQUE INDEX unique_user_profile ON public.client_profiles USING btree (user_id) |

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

## Tabla: product_images

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('product_images_id_seq'::regclass) | - |
| sap_code | character varying | NO | - | - |
| image_url | text | YES | - | - |
| last_updated | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| product_images_pkey | PRIMARY KEY | id | - |
| product_images_sap_code_key | UNIQUE | sap_code | - |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_product_images_sap_code | CREATE INDEX idx_product_images_sap_code ON public.product_images USING btree (sap_code) |
| product_images_pkey | CREATE UNIQUE INDEX product_images_pkey ON public.product_images USING btree (id) |
| product_images_sap_code_key | CREATE UNIQUE INDEX product_images_sap_code_key ON public.product_images USING btree (sap_code) |

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
| sap_code | character varying | YES | - | Código del producto en SAP B1 (ItemCode) |
| sap_group | integer | YES | - | Código del grupo del producto en SAP B1 (ItemsGroupCode) |
| sap_last_sync | timestamp without time zone | YES | - | Fecha y hora de la última sincronización con SAP B1 |
| sap_sync_pending | boolean | YES | false | Indica si hay cambios pendientes de sincronizar con SAP B1 |
| is_active | boolean | YES | true | Indica si el producto está activo |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| products_barcode_key | UNIQUE | barcode | - |
| products_pkey | PRIMARY KEY | product_id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_products_is_active | CREATE INDEX idx_products_is_active ON public.products USING btree (is_active) |
| idx_products_sap_code | CREATE INDEX idx_products_sap_code ON public.products USING btree (sap_code) |
| idx_products_sap_sync_pending | CREATE INDEX idx_products_sap_sync_pending ON public.products USING btree (sap_sync_pending) WHERE (sap_sync_pending = true) |
| products_barcode_key | CREATE UNIQUE INDEX products_barcode_key ON public.products USING btree (barcode) |
| products_pkey | CREATE UNIQUE INDEX products_pkey ON public.products USING btree (product_id) |

---

## Tabla: revoked_tokens

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| id | integer | NO | nextval('revoked_tokens_id_seq'::regclass) | - |
| token_hash | character varying | NO | - | - |
| user_id | integer | YES | - | - |
| revoked_at | timestamp without time zone | NO | CURRENT_TIMESTAMP | - |
| expires_at | timestamp without time zone | NO | - | - |
| revocation_reason | character varying | NO | 'user_logout'::character varying | - |
| revoke_all_before | timestamp without time zone | YES | - | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| revoked_tokens_pkey | PRIMARY KEY | id | - |
| revoked_tokens_token_hash_key | UNIQUE | token_hash | - |
| revoked_tokens_user_id_fkey | FOREIGN KEY | user_id | users(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_revoked_tokens_expires_at | CREATE INDEX idx_revoked_tokens_expires_at ON public.revoked_tokens USING btree (expires_at) |
| idx_revoked_tokens_hash | CREATE INDEX idx_revoked_tokens_hash ON public.revoked_tokens USING btree (token_hash) |
| idx_revoked_tokens_user_id | CREATE INDEX idx_revoked_tokens_user_id ON public.revoked_tokens USING btree (user_id) |
| revoked_tokens_pkey | CREATE UNIQUE INDEX revoked_tokens_pkey ON public.revoked_tokens USING btree (id) |
| revoked_tokens_token_hash_key | CREATE UNIQUE INDEX revoked_tokens_token_hash_key ON public.revoked_tokens USING btree (token_hash) |

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

## Tabla: transaction_audit_log

### Columnas

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|----------|-------------|
| audit_id | integer | NO | nextval('transaction_audit_log_audit_id_seq'::regclass) | - |
| transaction_id | integer | YES | - | - |
| action_type | audit_event_type | NO | - | - |
| action_timestamp | timestamp with time zone | YES | CURRENT_TIMESTAMP | - |
| user_id | integer | YES | - | - |
| ip_address | inet | YES | - | - |
| details | jsonb | YES | - | - |
| severity | severity_level | YES | 'INFO'::severity_level | - |
| old_status | character varying | YES | - | - |
| new_status | character varying | YES | - | - |
| metadata | jsonb | YES | - | - |
| created_at | timestamp with time zone | YES | CURRENT_TIMESTAMP | - |

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| transaction_audit_log_pkey | PRIMARY KEY | audit_id | - |
| transaction_audit_log_transaction_id_fkey | FOREIGN KEY | transaction_id | transactions(transaction_id) |
| transaction_audit_log_user_id_fkey | FOREIGN KEY | user_id | users(id) |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_audit_severity | CREATE INDEX idx_audit_severity ON public.transaction_audit_log USING btree (severity) |
| idx_audit_timestamp | CREATE INDEX idx_audit_timestamp ON public.transaction_audit_log USING btree (action_timestamp) |
| idx_audit_transaction | CREATE INDEX idx_audit_transaction ON public.transaction_audit_log USING btree (transaction_id) |
| idx_audit_type | CREATE INDEX idx_audit_type ON public.transaction_audit_log USING btree (action_type) |
| idx_audit_user | CREATE INDEX idx_audit_user ON public.transaction_audit_log USING btree (user_id) |
| transaction_audit_log_pkey | CREATE UNIQUE INDEX transaction_audit_log_pkey ON public.transaction_audit_log USING btree (audit_id) |

---

## Tabla: transactions

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

### Constraints

| Nombre | Tipo | Columnas | Referencia |
|--------|------|----------|------------|
| transactions_order_id_fkey | FOREIGN KEY | order_id | orders(order_id) |
| transactions_pkey | PRIMARY KEY | transaction_id | - |
| transactions_provider_transaction_id_key | UNIQUE | provider_transaction_id | - |

### Índices

| Nombre | Definición |
|--------|------------|
| idx_transactions_created | CREATE INDEX idx_transactions_created ON public.transactions USING btree (created_at) |
| idx_transactions_order_id | CREATE INDEX idx_transactions_order_id ON public.transactions USING btree (order_id) |
| idx_transactions_status | CREATE INDEX idx_transactions_status ON public.transactions USING btree (payment_status) |
| transactions_pkey | CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (transaction_id) |
| transactions_provider_transaction_id_key | CREATE UNIQUE INDEX transactions_provider_transaction_id_key ON public.transactions USING btree (provider_transaction_id) |

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

