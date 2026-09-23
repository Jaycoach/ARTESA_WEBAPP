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
