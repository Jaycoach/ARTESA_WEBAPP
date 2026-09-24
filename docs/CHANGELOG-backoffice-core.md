# CHANGELOG — BackOffice Core

Registro de evidencia de QA y despliegue del núcleo del BackOffice (`feature/backoffice-core`),
publicado reutilizando `feature/backoffice-module` sin la gestión de pedidos.
Estados por fase: IMPLEMENTADO / VALIDADO EN STAGING / APROBADO PARA PRODUCCIÓN.

## Fase 0 — Investigación

**Estado: IMPLEMENTADO** (checkpoint aprobado por Jonathan).

Decisiones cerradas:
- Clase B (gestión de clientes/sucursales nueva del branch pausado) queda **pausada**, no se publica en esta fase.
- Toda función administrativa que ya existía en `master` (hora de cierre, banner, `ClientList.jsx`, imágenes de producto, sync manual SAP) se mueve al BackOffice con su protección de rol actual, sin perder ninguna.
- Habilitar/deshabilitar login de sucursal existe en `master` como endpoint (`adminRoutes.js:41-47`, `authorize([1])`) pero sin UI — se construye UI nueva en Fase 4.
- Matriz de permisos: BACKOFFICE (rol 4) sin ninguna capacidad en el núcleo; FUNCTIONAL_ADMIN sin acceso a usuarios de plataforma, sync (ni ejecutar ni ver), seguridad/tokens ni auditoría — validado en backend con `requirePermission`, no solo en UI.

## Fase 1 — Git y base de datos

**Estado: VALIDADO EN STAGING** (2026-09-23).

### Git

- Tags de respaldo creados y pusheados a `origin`:
  - `backup/backoffice-module-pre-core` → `origin/feature/backoffice-module` (`30f4d03`)
  - `backup/master-pre-core` → `origin/master` (`f9ef58c`)
- Rama `feature/backoffice-core` creada desde `master`.
- Migración agregada en `db/migrations/2026-09-23_backoffice-core.sql`, commit `9e71a07125f74d597a213986e782d0f1b9eff407`, pusheado a `origin/feature/backoffice-core`.

### Migración `2026-09-23_backoffice-core.sql` — evidencia de aplicación en `artesadb_dev`

Aplicada por Jonathan directamente contra Staging (host con Docker, contenedor `artesa-api-staging`, `10.0.20.209`).

- **Ensayo con ROLLBACK:** código de salida 0, sin errores.
- **Comparación de esquema:** `backoffice_actions` resultó con estructura idéntica a la de `feature/backoffice-module` (`2026-09-05_create-backoffice-module.sql`). Únicas diferencias: comentarios SQL en `action_type`/`target_type` (lista de valores documentada distinta); tipos y longitudes de columna coinciden exactamente.
- **Aplicación real:** código de salida 0, en una sola transacción.
  - 4 columnas nuevas en `users`: `deactivated_manually` (`boolean NOT NULL DEFAULT false`), `deactivated_at` (`timestamptz`), `deactivated_by` (`integer`), `deactivation_reason` (`text`).
  - Antes/después: 0 usuarios con `deactivated_manually = true` (columna nueva, sin datos previos que migrar).
  - `backoffice_actions` quedó intacta: 12 registros preexistentes del QA del branch pausado, no se tocaron ni se duplicaron.
  - Roles 3 y 4: ya existían en Staging → `INSERT 0 0` (idempotencia confirmada, `ON CONFLICT (id) DO NOTHING` funcionó como se esperaba).
- **Decisión de diseño aceptada:** `users.deactivated_by REFERENCES users(id)` **sin** `ON DELETE SET NULL`, por consistencia con `backoffice_actions.admin_user_id` (misma referencia sin cascada) y para preservar la trazabilidad de auditoría — un `users.id` referenciado en `deactivated_by` no debe poder desaparecer silenciosamente si el registro que lo originó se borra.

## Pendientes anotados para Fase 6 (despliegue a Producción)

1. Probar la ruta de creación **desde cero** de esta migración contra una copia del esquema de Producción (no solo contra Staging, que ya tenía roles 3/4 y `backoffice_actions` preexistentes por el branch pausado) — Staging valida idempotencia sobre objetos existentes, pero no valida la ruta de creación en un ambiente limpio.
2. Ajustar el `setval` de la secuencia de `roles` en Producción antes o después de aplicar la migración, porque los `INSERT` de roles 3 y 4 usan `id` explícito — sin este ajuste, un `INSERT INTO roles` posterior sin `id` explícito podría colisionar con esos IDs ya ocupados.

## Convención para `backoffice_actions.target_id` (NOT NULL, sin alterar la tabla)

Documentada en Fase 0/1 para aplicarse en Fase 2, sin excepciones y sin usar `NULL` ni valores inventados:

| `target_type` | `target_id` |
|---|---|
| `user` | `users.id` del usuario afectado |
| `admin_settings` | `id` de la fila de `admin_settings` afectada |
| `sap_sync` | `0` fijo — el tipo de sincronización y el resultado van en `details` (JSONB) |

## Fase 2 — Backend

**Estado: en progreso**, con checkpoint por archivo (ver conversación).

### 6g/7 — hallazgos registrados

- **Dos objetos `fileUploadOptions` distintos, mismo nombre:** `adminRoutes.js` (antes de
  esta edición) usaba uno local de 5MB; `app.js:158-168` usa otro de 10MB con
  `parseNested`/`safeFileNames`/`debug`, para `/upload`, `/client-profiles`, `/images`.
  Se extrajo a `src/config/adminFileUploadOptions.js` **solo el de `adminRoutes.js`** (5MB).
  El de `app.js` no se tocó — son configuraciones deliberadamente distintas para rutas
  distintas, no se unifican.
- **RESUELTO:** `SELECT id, name FROM users WHERE name ~ '&(amp|lt|gt|quot|#x27|#39);'`
  ejecutada por Jonathan en Producción → **0 filas**. Ningún `users.name` existente tiene
  entidades HTML. La convención de `sanitizeBody` en los endpoints nuevos del núcleo no
  cambia (ya aplicado en el archivo 7).

### 6g — `settingsController.js` / `syncController.js`: auditoría de mejor esfuerzo

A diferencia de la auditoría de usuarios (`userStatusService.js`, transaccional, con el
mismo `dbClient` del `BEGIN`/`COMMIT`), la auditoría de los 9 handlers **delegados** desde
`settingsController.js`/`syncController.js` es de **mejor esfuerzo**: corre fuera de
cualquier transacción del controller original (`withAudit`, vía `Promise.resolve().then(...)`
después de interceptar la respuesta) y, si falla, solo se registra en el log — nunca
cambia el status code ni el body que recibe el cliente. Es el costo aceptado de no
modificar los controllers existentes (`adminController.js`, `clientSyncController.js`,
`sapSyncController.js`).

### 6f — `clientsController.js`

- **Definición de "pedido pendiente" (dos conteos, sin inventar estados):**
  - `pending_orders` = `status_id` fuera de `Order.FINAL_ORDER_STATES` (Entregado/Cerrado/Cancelado).
  - `pending_orders_not_synced` = lo mismo, **y además** `sap_synced` no es `true` (`SapOrderService.js:499`).
  Se separan porque un pedido cancelado/cerrado nunca marcado como sincronizado no debe
  contarse como "pendiente" solo por el flag de sync.
- **`Order.FINAL_ORDER_STATES`** (`Order.js`, propiedad estática, `Object.freeze([4,5,6])`)
  se expone de forma aditiva. Las constantes locales `nonModifiableStates` (`Order.js:598`)
  y `finalStates` (`Order.js:927`) **no se tocaron** — siguen igual, con el mismo valor.
- **Nuevo listado:** `GET /api/backoffice/clients/without-profile` — usuarios rol 2 sin
  `client_profiles` (el `getAll()`/`getAllProfiles` que alimenta `ClientList.jsx` no los
  trae, por su `JOIN` con `client_profiles`). Necesario para poder inactivar/reactivar a
  cualquier cliente, tenga o no perfil.
- **Verificación de `ClientProfile.getAll()`:** único llamador (`clientProfileController.js:298`
  dentro de `getAllProfiles`), montado en una única ruta (`GET /api/client-profiles`,
  `checkRole([1,3])`) — nunca accesible para rol 2 ni para sucursales. Se agregaron
  `u.is_active`, `u.deactivated_manually`, `u.deactivated_at`, `u.deactivation_reason` de
  forma aditiva (4 claves nuevas; `ClientList.jsx` sigue leyendo exactamente las mismas de antes).

### 6f — D7.2: bloqueo de sucursales cuando el cliente padre está inactivo

`BranchAuth.findByEmail`/`findById` ahora traen `COALESCE(u.is_active, false) AS parent_is_active`
(`LEFT JOIN users u ON cp.user_id = u.id`). Se revisa en 3 puntos: `branchAuthController.js`
(`login`, después de validar la contraseña — no cuenta como intento fallido ni bloquea la
sucursal), `middleware/auth.js` `verifyBranchToken` (bloquea instantáneamente cualquier token
ya emitido) y `verifyAnyToken`.

- **(a)** `verifyAnyToken` (`middleware/auth.js:123-249`) es una función que decodifica y
  acepta tokens de sucursal de forma **independiente** de `verifyBranchToken` (su propio
  `jwt.verify` + su propio `BranchAuth.findById`). Confirmado con `git grep -n "verifyAnyToken" -- src`
  (excluyendo `auth.js`): **0 referencias** — no la monta ningún route ni controller hoy. Se
  cubrió preventivamente con el mismo chequeo para que, si alguien la usa en el futuro, no
  quede como un bypass silencioso. No se eliminó (conserva el código existente).
- **(b)** `BranchAuth.findByEmail` sigue comparando `b.email_branch = $1` **exacto** (sin
  `LOWER()`). Pasa a comparación case-insensitive en el checkpoint 6h (D12), junto con el
  resto de comparaciones de correo del sistema.

### 6j — RESUELTO: logs que exponían el token/URL completo de recuperación

- `src/services/EmailService.js` (`sendPasswordResetEmail`) — se quitó `resetUrl` del `logger.info`, queda solo `{ to }`.
- `src/services/EmailService.js` (`sendVerificationEmail`) — se quitó `verificationUrl` del `logger.info`, queda solo `{ to }`.
- `src/controllers/passwordResetController.js` — se quitó `{ token: resetToken }` del `logger.info('Token generado para pruebas')` (dentro de `NODE_ENV === 'development'`).

Sin cambios de comportamiento: el correo se sigue enviando igual y la respuesta HTTP de desarrollo (que sí incluye el token en el body, no en logs) no se tocó. Los tokens que ya estaban en logs históricos no se limpian (ya expiraron).

### Archivo 6d: `src/services/backofficeCore/userStatusService.js`

`action_type` finales usados en `backoffice_actions` (no se editó la migración ya aplicada;
estos nombres son valores libres en `VARCHAR(40)`, no un enum de BD):
- `deactivate_user` — `details.scope` distingue `'platform_user'` vs `'client'`; `details.previous_state`
  distingue `'active'` (inactivación normal, con revocación de tokens) vs `'inactive_not_manual'`
  (solo se marca `deactivated_manually`, sin tocar `is_active` ni revocar tokens).
- `activate_user` — única vía de reactivación válida; solo actúa si `deactivated_manually = true`.
- `change_user_role` — solo entre ADMIN(1) y FUNCTIONAL_ADMIN(3); revoca tokens siempre
  (incondicional, inofensivo si el usuario estaba inactivo).

### Archivo 6c: `tokenRevocation.js` y `BackofficeAction.js` — parámetro `client` opcional

Ambos aceptan ahora un `client = pool` opcional al final de su firma, para participar en
transacciones externas (`userStatusService.js`). Verificado con `git grep` que **ningún
llamador existente** pasa ese argumento, así que todos siguen usando `pool` por defecto —
comportamiento idéntico al actual para `authController.js:216`, `logoutController.js:125,204`
y los 5 usos de `BackofficeAction.log` en `backofficeController.js` del branch pausado.

**`BackofficeAction.js` deja de ser byte-idéntico a `origin/feature/backoffice-module`**
(diff: se agregó el parámetro `client`). Aceptado explícitamente: en la Fase 7, cuando el
branch pausado rebase sobre `master`, se toma la versión del núcleo (con `client`) en vez de
la del branch pausado, y sus 5 llamadores en `backofficeController.js` (clase B2/C que
permanece ahí) simplemente no pasan el segundo argumento — sin cambios de comportamiento
para ellos tampoco.

### Archivos 1-2: `src/constants/roles.js` + `src/middleware/auth.js`

Commit `68260d56c87287bb10c5bd8b83d24fb323ca3467`. Ambos archivos quedaron byte-idénticos a
`origin/feature/backoffice-module` (`git diff` vacío contra esa rama tras aplicar). Verificado
con `git grep -nE "(checkRole|authorize)\("` sobre `master` y el branch pausado (~60 llamadas)
que ningún archivo pasa un nombre de rol en texto salvo el hallazgo siguiente.

### Hallazgo registrado: `checkRole(['ADMIN', 'MANAGER'])` en `priceListRoutes.js:763-765`

`'MANAGER'` no existe en `ROLES` ni en ningún otro archivo del proyecto (confirmado por grep
global en Fase 0). Con el fallback viejo *y* con el nuevo, `'MANAGER'` nunca resuelve a un
`rol_id` numérico — el comportamiento de esa ruta **no cambia** con la limpieza de `auth.js`
(en la práctica, esa ruta ya era ADMIN-only de facto). No se toca ahora. Se resuelve en el
archivo 9 del plan de Fase 2, cuando esa ruta migre a `requirePermission` según la matriz de
permisos — ahí se reemplaza por el permiso correcto en vez de dejar el string `'MANAGER'` muerto.
