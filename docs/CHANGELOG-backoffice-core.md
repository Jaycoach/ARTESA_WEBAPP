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

### Archivo 9 — evidencia DoD: `orderRoutes.js` (commit `65ca0a4`)

```
$ node -e "...script de verificacion..."
TOTAL: 24
GET /orders/statuses | verifyToken > getOrderStatuses
GET /orders/delivery-date | verifyToken > calculateDeliveryDate
POST /orders/process-pending | verifyToken > requirePermission(orders.maintenance) > updatePendingOrders
POST /orders/sync-to-sap | verifyToken > requirePermission(sap_sync.execute) > syncOrdersToSap
GET /orders/verify-trm | verifyToken > requirePermission(orders.maintenance) > verifyTRM
POST /orders/update-status-from-sap | verifyToken > requirePermission(sap_sync.execute) > updateOrderStatusFromSap
GET /orders/byDeliveryDate | verifyToken > getOrdersByDeliveryDate
GET /orders/status/:statusId | verifyToken > getOrdersByStatus
GET /orders/user/:userId | verifyToken > getUserOrders
GET /orders/can-create/:userId | verifyToken > checkUserCanCreateOrders
GET /orders/invoices | verifyToken > getInvoicesByUser
GET /orders/top-products | verifyToken > getTopSellingProducts
GET /orders/monthly-stats | verifyToken > getMonthlyStats
GET /orders/user-branches | verifyToken > getUserBranches
GET /orders/debug/:userId | verifyToken > requirePermission(system.diagnostics) > debugUserOrders
GET /orders/:orderId | verifyToken > getOrderById
PUT /orders/:orderId | verifyToken > updateOrder
POST /orders/prices | verifyToken > sanitizeBody > getProductPricesWithTax
PUT /orders/:orderId/cancel | verifyToken > cancelOrder
POST /orders/:orderId/send-to-sap | verifyToken > requirePermission(sap_sync.execute) > sendOrderToSap
POST /orders/:orderId/reset-sap-sync | verifyToken > requirePermission(sap_sync.execute) > resetSapSync
POST /orders/check-delivered | verifyToken > requirePermission(sap_sync.execute) > checkDeliveredOrders
POST /orders/check-invoiced | verifyToken > requirePermission(sap_sync.execute) > checkInvoicedOrders
POST /orders | verifyToken > <anonymous> > createOrder
$ grep -c "checkRole" src/routes/orderRoutes.js
0
$ node --check src/routes/orderRoutes.js
SINTAXIS OK
```

### Hallazgo lateral: controles de "todas las órdenes" escritos a mano con `rol_id !== 1`

Varios controllers de pedidos usan `rol_id !== 1` (comparación literal, no `requirePermission`) para
decidir quién ve datos de todos los usuarios vs. solo los propios: `getOrdersByDeliveryDate:1675`,
`getOrdersByStatus:1044`, `getUserOrders:562`, `getInvoicesByUser:2372`, `getTopSellingProducts:2549`,
`getMonthlyStats:2678`, `getOrderById:486`. Con esto, **FUNCTIONAL_ADMIN (rol 3) se trata igual que
un cliente** en estas 7 rutas — solo ve sus propios pedidos (rol 3 no es dueño de ningún pedido en la
práctica hoy, así que en los hechos ve una lista vacía, no un error). **Sin cambio ahora** — la matriz
de permisos del núcleo no cubre pedidos (clase C, pausada); relevante cuando se publique la gestión de
pedidos del BackOffice y haya que decidir si FUNCTIONAL_ADMIN/BACKOFFICE deben ver todos los pedidos.

### Checkpoint 9-bis — `GET /orders/can-create/:userId` (commit `cb026a2`)

**Restricción intencional por seguridad**, no una regresión: antes, cualquier usuario autenticado
podía consultar el estado de cuenta (`isActive`/`hasProfile`/`hasCardCode`/`canCreate`) de **cualquier
otro `userId`**. Ahora exige ser el dueño o ADMIN, mismo patrón que `getUserOrders:562`. Verificado
con `git grep "can-create"` en `src/views/frontend`: los 3 puntos de llamada
(`Orders.jsx:154`, `useOrderFormValidation.js:44`, `useUserActivation.js:128`) usan siempre
`user.id` propio — ningún flujo legítimo del frontend cambia de comportamiento. **En la comparación
de la Fase 2-R**, la diferencia `200 → 403` para el caso "cliente consultando el `can-create` de otro
usuario" queda explicada por esta decisión, no es un hallazgo de regresión.

```
$ node --check src/controllers/orderController.js
SINTAXIS OK
```

### Archivo 9 — evidencia DoD: `uploadRoutes.js` (commits `996e114`, `7e419f9`)

```
$ node --check src/routes/uploadRoutes.js
SINTAXIS OK
$ grep -c "checkRole" src/routes/uploadRoutes.js
3
$ grep -n "checkRole" src/routes/uploadRoutes.js
8:const { verifyToken, checkRole } = require('../middleware/auth');
184:  checkRole([1, 2]), // Administradores y usuarios normales
218:  checkRole([1, 2]), // Administradores y usuarios normales
$ node -e "...script de verificacion..."
TOTAL: 9
POST /images | verifyToken > requirePermission(uploads.manage) > uploadImage
POST / | verifyToken > requirePermission(uploads.manage) > uploadImage
DELETE /:fileName | verifyToken > requirePermission(uploads.delete) > deleteImage
POST /test-s3 | verifyToken > requirePermission(system.diagnostics) > testS3Configuration
GET /s3-status | verifyToken > <anonymous> > getS3Status
GET /list | verifyToken > <anonymous> > listFiles
GET /duplicates | verifyToken > requirePermission(uploads.manage) > findDuplicates
DELETE /bulk-delete | verifyToken > requirePermission(uploads.bulk_delete) > bulkDeleteFiles
POST /verify-iam | verifyToken > requirePermission(system.diagnostics) > verifyIAMCredentials
```
`grep -c` da 3 (no 2): 1 es la línea del `require` (sigue en uso real por `:184`/`:218`), los otros
2 son exactamente las rutas `[1,2]` sin cambio.

### Hallazgo lateral: `GET /orders/can-create/:userId` — RESUELTO en el checkpoint 9-bis (ver arriba)

Tabla completa de las 11 rutas "sin cambio" de `orderRoutes.js` verificadas por restricción de dueño
(las 2 filas que faltaban en el primer pase):

| ruta | controller:línea | ¿restringe? | evidencia | riesgo |
|---|---|---|---|---|
| `PUT /orders/:orderId` | `updateOrder:739` | Sí | `771`: `if (user.rol_id === 1) { hasPermission = true }`; `774`: `else if (currentOrder.user_id === user.id)`; `~782-796`: también permite a un usuario de la misma sucursal (`client_branches`) del dueño de la orden | Ninguno |
| `PUT /orders/:orderId/cancel` | `cancelOrder:1505` | Sí | `1534`: `if (order.user_id !== user.id && user.rol_id !== 1)` → 403 | Ninguno |
| `GET /orders/can-create/:userId` | `checkUserCanCreateOrders:1133` | Ahora sí (antes no) | Ver checkpoint 9-bis arriba, commit `cb026a2` | Resuelto |

### Archivo 9 — evidencia DoD: `clientSyncRoutes.js` (commit `bff72e6`)

```
$ node -e "...script de verificacion..."
GET /status requirePermission(sap_sync.view) > getSyncStatus
POST /sync requirePermission(sap_sync.execute) > bound syncClients
GET /clients/pending requirePermission(sap_sync.view) > getPendingClients
POST /client/:userId/sync verifyToken > requirePermission(sap_sync.execute) > bound syncClient
POST /client/:userId/activate requirePermission(platform_users.manage) > bound activateClient
GET /sap-diagnosis requirePermission(sap_sync.view) > bound sapDiagnosis
POST /sync-institutional requirePermission(sap_sync.execute) > bound syncInstitutionalClients
GET /list-ci-clients requirePermission(sap_sync.view) > listCIClients
POST /sync-all requirePermission(sap_sync.execute) > bound syncAllClients
GET /branches/validate requirePermission(sap_sync.view) > bound validateClientBranches
GET /client/:cardCode/branches/validate requirePermission(sap_sync.view) > bound validateSpecificClientBranches
POST /branches/sync requirePermission(sap_sync.execute) > bound syncClientBranches
POST /client/:cardCode/branches/sync requirePermission(sap_sync.execute) > <anonymous>
POST /test-email-ses requirePermission(system.diagnostics) > bound testEmailSes
GET /debug/client/:userId requirePermission(system.diagnostics) > bound debugClientStatus
$ grep -c "checkRole" src/routes/clientSyncRoutes.js
0
$ node --check src/routes/clientSyncRoutes.js
(sin salida = sintaxis OK)
```

### Archivo 9 — evidencia DoD: `sapSyncRoutes.js` (commit `1685646`)

```
$ node -e "...script de verificacion..."
TOTAL: 11
GET /test | requirePermission(sap_sync.view) > testSapConnection
POST /sync | requirePermission(sap_sync.execute) > bound startSync
GET /status | requirePermission(sap_sync.view) > getSyncStatus
GET /analyze-view | requirePermission(sap_sync.view) > analyzeView
GET /products/direct | requirePermission(sap_sync.view) > getProductsDirectQuery
POST /update-description | requirePermission(sap_sync.execute) > bound updateProductDescription
POST /sync/group/:groupCode | requirePermission(sap_sync.execute) > bound syncProductsByGroup
POST /sync/price-list-mapping | requirePermission(sap_sync.execute) > syncPriceListMapping
GET /test-data | requirePermission(sap_sync.view) > testSapData
GET /sync/orders/schedule | requirePermission(sap_sync.view) > bound getOrderSyncSchedule
PUT /sync/tax-codes/:groupCode | requirePermission(sap_sync.execute) > bound updateGroupTaxCodes
$ grep -c "checkRole" src/routes/sapSyncRoutes.js
0
$ node --check src/routes/sapSyncRoutes.js
SINTAXIS OK
```
`grep -n -A2` confirmó además que las 11 rutas (incluidas `/test-data` y `/sync/tax-codes/:groupCode`)
quedaron íntegras con su handler original correcto, sin líneas cortadas ni desalineadas.

### Archivo 9 — tabla antes/después, reconciliación y conflictos

- **Reconciliación:** 68 call-sites totales de `checkRole`/`authorize` en `master` (Fase 0) =
  62 migrados a `requirePermission` (archivo 9) + 6 de `secureProductRoutes.js` (código
  muerto, ya desmontado en el archivo 8, no se migra). `62 + 6 = 68` ✓.
- **4 accesos que gana FUNCTIONAL_ADMIN** (corregido: eran 5, ahora 4 — `DELETE /upload/:fileName`
  sale de la lista por el hallazgo de seguridad de `deleteImage`, ver más abajo; queda ADMIN-only
  vía `uploads.delete`). Antes ADMIN-only, ahora `[ADMIN, FUNCTIONAL_ADMIN]` por la regla por
  defecto de la categoría "OTRA"; ningún rol pierde acceso en ningún caso:
  1. `clientBranchRoutes.js:178` — `GET /client-branches/client/:clientId` → `clients.view`.
  2. `orderRoutes.js:115` — `POST /orders/process-pending` → `orders.maintenance`.
  3. `orderRoutes.js:144` — `GET /orders/verify-trm` → `orders.maintenance`.
  4. `uploadRoutes.js:245` — `GET /upload/duplicates` → `uploads.manage`.

### Hallazgo preexistente, NO corregido: `DELETE /api/upload/bulk-delete` inalcanzable

`DELETE /:fileName` (`uploadRoutes.js:141`, antes del cambio de este archivo) está registrada
**antes** que `DELETE /bulk-delete` (`:280`) en el mismo router. Express matchea rutas en orden
de registro, y `/:fileName` acepta cualquier segmento único — incluido literalmente `bulk-delete`.
Confirmado programáticamente (`layer.regexp.test('/bulk-delete')` sobre el `router.stack` real,
en orden): la primera capa que matchea es `/:fileName`, no `/bulk-delete`. Es decir, hoy
`DELETE /api/upload/bulk-delete` llega a `deleteImage` (con `fileName='bulk-delete'`), nunca a
`bulkDeleteFiles` — el borrado masivo está sombreado e inalcanzable en la práctica.
**No se corrige aquí**: reordenar las rutas activaría un endpoint de borrado masivo hoy inerte,
lo cual es una decisión de producto/seguridad aparte, no parte del archivo 9 (que solo migra
protección de rol, no cambia comportamiento). La capacidad `uploads.bulk_delete` ya se aplicó
a `:280` para que quede correcta el día que se decida corregir el orden.

### Hallazgo preexistente, NO corregido (seguridad): `deleteImage` borra cualquier clave S3

`uploadController.js:413-464` (`deleteImage`, detrás de `DELETE /api/upload/:fileName`) acepta
`?key=<clave literal>` y llama `S3Service.deleteFile(fileKey)` **sin validar ningún prefijo** —
solo cuando `key` está ausente cae al default `general/${fileName}`. Los documentos de clientes
(cédula, RUT, anexos) se guardan en el mismo bucket/mecanismo, con clave
`client-profiles/{userId}/{documentType}/{timestamp}{ext}` (`clientProfileController.js:81`,
borrados también vía `S3Service.deleteFile` en `clientProfileController.js:962`). Un token de
ADMIN comprometido (o un ADMIN malicioso) podría borrar documentos de clientes con esta ruta,
**sin ninguna auditoría** (esta ruta no pasa por `backoffice_actions`).

**Resolución adoptada para este archivo (Opción A):** capacidad nueva `uploads.delete` → `[ADMIN]`
únicamente (`permissions.js`, commit `996e114`), separada de `uploads.manage`. Se conserva
exactamente el comportamiento actual (ADMIN-only); FUNCTIONAL_ADMIN **no** gana este acceso.

**Propuesta de tarea aparte** (no incluida en el archivo 9):
1. Inventariar en el frontend quién llama `DELETE /api/upload/:fileName` y con qué valores de `key`.
2. Restringir `deleteImage` a una lista de prefijos permitidos (nunca `client-profiles/*`).
3. Auditar la acción en `backoffice_actions` cuando se delegue bajo `/api/backoffice`.
4. Solo después de 1-3, evaluar si abrir `uploads.delete` a FUNCTIONAL_ADMIN tiene sentido.
- **Conflictos:** `fix/price-list-sync-unification` vs `master` solo toca
  `db/migrations/001_initial-schema.md`, `2026-09-11_add-sap-sync-status-column.sql` y
  `src/services/SapOrderService.js` — **sin intersección** con los 11 archivos de rutas del
  archivo 9 ni con `SapClientService.js` (Fase 3). `feature/backoffice-module` vs `master`
  solo toca `src/routes/productRoutes.js` en la línea de `GET /products`
  (`checkRole([1,2,3])→[1,2,3,4]`), que el archivo 9 **no toca** (queda fuera del alcance,
  incluye USER) — sin conflicto, el rebase futuro de la Fase 7 aplica limpio.

### Hallazgo: `sanitizeBody`/`validateQueryParams` de nivel router se ejecutan en cascada

`userRoutes.js:8` (`sanitizeBody, sanitizeParams, validateQueryParams`) y `productRoutes.js:86`
(`sanitizeBody, sanitizeParams`) están montados en `/api` **a secas** (`app.js:453,456`), así
que su `router.use(...)` se ejecuta para **toda** petición `/api/*` registrada después de
ellos que no tenga ya una respuesta enviada — incluido `/api/backoffice/*` y `/api/admin/*`.
`validator.escape()` (usado por ambos, vía `sanitizeString`) **no es idempotente**
(`&` → `&amp;` → `&amp;amp;` en una segunda pasada).

**Tabla de cadenas efectivas (paridad lograda):**

| Ruta | Pasadas de `sanitizeBody` | Detalle |
|---|---|---|
| (a) `POST /api/auth/register` | 2 | `userRoutes.js:8` + `authRoutes.js:260` (responde antes de llegar a `productRoutes`) |
| (b) `POST /api/admin/settings` (original) | 3 | `userRoutes.js:8` + `productRoutes.js:86` + `adminRoutes.js:23` (router-level) |
| (c) `POST /api/backoffice/settings` | 3 | igual que (b) — ya en paridad, sin cambios |
| (d) `POST /api/backoffice/platform-users` y demás (antes de la corrección) | 3 | 1 de más vs. (a) |
| (d) — **corregido** (`4a8dfb6`) | 2 | se quitó el `sanitizeBody` propio de esos 4 endpoints; ahora depende de `userRoutes.js:8`+`productRoutes.js:86`, misma paridad que (a) |

**Hallazgo preexistente, fuera de alcance (no se corrige en esta tarea):** el patrón de
`router.use(sanitizeBody/validateQueryParams)` sin scoping en routers montados en `/api` a
secas se aplica también a rutas de otros routers no relacionados, con dos consecuencias:
(1) multi-escape de HTML en cualquier ruta mo suficientemente "profunda" en el orden de
montaje (3+ pasadas en vez de 1); (2) `validateQueryParams` podría rechazar (403) texto
legítimo que casualmente calce con el patrón de SQL-injection, en rutas que nunca pidieron
esa protección. **Cómo se corregiría en una tarea aparte:** mover `sanitizeBody`/
`sanitizeParams`/`validateQueryParams` de `userRoutes.js`/`productRoutes.js` de
`router.use(...)` global a middlewares por-ruta (como ya hace la mayoría del proyecto en
otros routers), o montar esos dos routers en subrutas propias en vez de `/api` a secas —
cualquiera de las dos requiere revisar el comportamiento actual de esas rutas existentes
antes de tocarlas, por eso queda fuera de esta tarea.

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

### Archivo 9 — `productRoutes.js` (commit `99b3921`)

Tabla completa (7 rutas):

| línea | ruta | protección actual | capacidad nueva | ¿cambia? |
|---|---|---|---|---|
| `:19` | `GET /products/sap/pending` | `checkRole([1])` | `sap_sync.view` | Cambia |
| `:99` | `GET /products` | `checkRole([1,2,3])` | — | Sin cambio (incluye USER) |
| `:116` | `GET /products/:productId` | `checkRole([1,2,3])` | — | Sin cambio (incluye USER) |
| `:134` | `POST /products` | `checkRole([1,3])` | `products.manage` | Cambia |
| `:154` | `PUT /products/:productId` | `checkRole([1,3])` | `products.manage` | Cambia |
| `:174` | `PUT /products/:productId/image` | `checkRole([1,3])` | `products.manage` | Cambia |
| `:192` | `DELETE /products/:productId` | `checkRole([1,3])` | `products.manage` | Cambia |

Riesgo verificado (condición 5): `deleteProduct` (`productController.js:491-520`) acotado a
`productId`, `Product.delete(productId)`, sin claves arbitrarias — sin riesgo tipo `deleteImage`.

```
$ node --check src/routes/productRoutes.js
SINTAXIS OK
$ grep -n "checkRole\|authorize" src/routes/productRoutes.js
4:const { verifyToken, checkRole } = require('../middleware/auth');
101:  checkRole([1, 2, 3]), // Permitir acceso a todos los usuarios autenticados
118:  checkRole([1, 2, 3]), // Permitir acceso a todos los usuarios autenticados
$ node -e "...script de verificacion..."
TOTAL: 7
GET /products/sap/pending | verifyToken > requirePermission(sap_sync.view) > getPendingSyncProducts
GET /products | verifyToken > <anonymous> > bound getProducts
GET /products/:productId | verifyToken > <anonymous> > bound getProduct
POST /products | verifyToken > requirePermission(products.manage) > bound createProduct
PUT /products/:productId | verifyToken > requirePermission(products.manage) > updateProduct
PUT /products/:productId/image | verifyToken > requirePermission(products.manage) > bound updateProductImage
DELETE /products/:productId | verifyToken > requirePermission(products.manage) > bound deleteProduct
```

### Archivo 9 — `clientProfileRoutes.js` (commit `bed58d5`)

Tabla completa (2 call-sites de los 68; el archivo tiene 13 rutas en total, las otras 11 nunca
tuvieron `checkRole`, solo `verifyToken`, sin cambio):

| línea | ruta | protección actual | capacidad nueva | ¿cambia? |
|---|---|---|---|---|
| `:187` | `GET /` | `checkRole([1,3])` | `clients.view` | Cambia |
| `:556` | `DELETE /user/:userId` | `checkRole([1])` | `clients.delete` | Cambia |

Riesgo verificado (condición 5): `deleteProfileByUserId` (`clientProfileController.js:1681-1720`)
acotado a `userId`, con salvaguarda que rechaza si el cliente tiene órdenes asociadas.

```
$ node --check src/routes/clientProfileRoutes.js
SINTAXIS OK
$ grep -c "checkRole" src/routes/clientProfileRoutes.js
0
$ node -e "...script de verificacion..."
TOTAL: 13
GET / | verifyToken > requirePermission(clients.view) > getAllProfiles
GET /user/:userId | verifyToken > getProfileByUserId
POST / | verifyToken > createProfile
PUT /user/:userId | verifyToken > updateProfileByUserId
DELETE /user/:userId | verifyToken > requirePermission(clients.delete) > deleteProfileByUserId
GET /user/:userId/documents | verifyToken > listDocuments
GET /user/:userId/file/:fileType | verifyToken > getFileByUserId
GET /user/:userId/download/:fileType | verifyToken > downloadDocument
POST /:userId/documents/:documentType | verifyToken > uploadProfileDocument
POST /debug/test-sap-sync | verifyToken > <anonymous>
POST /debug/sap-connection | verifyToken > <anonymous>
POST /debug/sap-lead-only | verifyToken > <anonymous>
GET /debug/sap-groupcode | verifyToken > <anonymous>
```

### Archivo 9 — `clientBranchRoutes.js` (commit `f50905f`)

Tabla completa (1 call-site; el archivo tiene 2 rutas en total):

| línea | ruta | protección actual | capacidad nueva | ¿cambia? |
|---|---|---|---|---|
| `:127-131` | `GET /client/:clientId` | `checkRole([1])` | `clients.view` | Cambia (gana FUNCTIONAL_ADMIN) |
| `:169` | `GET /user/:userId` | solo `verifyToken` | — | Sin cambio |

```
$ node --check src/routes/clientBranchRoutes.js
SINTAXIS OK
$ grep -c "checkRole" src/routes/clientBranchRoutes.js
0
$ node -e "...script de verificacion..."
TOTAL: 2
GET /client/:clientId | verifyToken > requirePermission(clients.view) > getBranchesByClientId
GET /user/:userId | verifyToken > getBranchesByUserId
```

### Archivo 9 — `priceListRoutes.js` (commit `cf4da7a`) — cierra el hallazgo de `MANAGER`

Tabla completa (3 call-sites de los 68; el archivo tiene 10 rutas en total):

| línea | ruta | protección actual | capacidad nueva | ¿cambia? |
|---|---|---|---|---|
| `:500` | `POST /sync` | `checkRole([1])` | `sap_sync.execute` | Cambia |
| `:579` | `GET /sync/summary` | `checkRole([1])` | `sap_sync.view` | Cambia |
| `:763` | `POST /update-product-prices` | `checkRole(['ADMIN','MANAGER'])` | `sap_sync.execute` | Cambia — **cierra el hallazgo del `MANAGER` muerto** (Fase 0/archivo 2) |

Riesgo verificado: `updateProductPricesFromLists` (`priceListController.js:504-535`) es un sync
masivo legítimo de precios desde SAP, alcance esperado de una acción `sap_sync.execute`.

```
$ node --check src/routes/priceListRoutes.js
SINTAXIS OK
$ grep -c "checkRole\|authorize" src/routes/priceListRoutes.js
0
$ node -e "...script de verificacion..."
TOTAL: 10
GET / | verifyToken > <anonymous>
GET /:priceListCode/products | verifyToken > ... > <anonymous>
GET /:priceListCode/products/:productCode/price | verifyToken > ... > getProductPrice
POST /:priceListCode/products/prices | verifyToken > ... > getMultipleProductPrices
GET /:priceListCode/statistics | verifyToken > ... > getPriceListStatistics
POST /sync | verifyToken > requirePermission(sap_sync.execute) > ... > syncPriceListsFromSap
GET /sync/summary | verifyToken > requirePermission(sap_sync.view) > getSyncSummary
GET /sap/search | verifyToken > ... > searchProductsInSap
GET /sap/validate/:priceListNo | verifyToken > ... > validatePriceListInSap
POST /update-product-prices | verifyToken > requirePermission(sap_sync.execute) > updateProductPricesFromLists
```

### Archivo 9 — `productImageRoutes.js` (commit `4cd34ba`)

Tabla completa (2 call-sites; el archivo tiene 4 rutas en total):

| línea | ruta | protección actual | capacidad nueva | ¿cambia? |
|---|---|---|---|---|
| `:111` | `POST /products/:productId/images/:imageType` | `checkRole([1,3])` | `product_images.manage` | Cambia (mismos roles) |
| `:130` | `GET /products/images/:productId/:imageType` | solo `verifyToken` | — | Sin cambio |
| `:147` | `GET /products/:productId/images` | solo `verifyToken` | — | Sin cambio |
| `:168` | `DELETE /products/images/:productId/:imageType` | `checkRole([1,3])` | `product_images.manage` | Cambia (mismos roles) |

Riesgo verificado: `deleteProductImage` (`productImageController.js:798-...`) acotado a
`productId`/`imageType`, resuelve `image_url` desde el registro del producto, sin clave
arbitraria.

```
$ node --check src/routes/productImageRoutes.js
SINTAXIS OK
$ grep -n "checkRole\|authorize" src/routes/productImageRoutes.js
(sin resultados)
$ node -e "...script de verificacion..."
TOTAL: 4
POST /products/:productId/images/:imageType | verifyToken > requirePermission(product_images.manage) > sanitizeParams > uploadProductImage
GET /products/images/:productId/:imageType | verifyToken > sanitizeParams > getProductImage
GET /products/:productId/images | verifyToken > sanitizeParams > listProductImages
DELETE /products/images/:productId/:imageType | verifyToken > requirePermission(product_images.manage) > sanitizeParams > deleteProductImage
```

## Fase 5 — Plan de QA acumulado (pendiente de ejecutar contra Staging real)

Casos agregados durante la Fase 2, a ejecutar cuando arranque la Fase 5 formal:

- Con token de FUNCTIONAL_ADMIN: `GET /api/backoffice/settings` → 200; `GET /api/backoffice/sync/status` → 403
  (detecta cualquier interferencia de otro router en el montaje del núcleo).
- `GET /orders/can-create/:userId`:
  - cliente A consultando `can-create` de A → 200;
  - cliente A consultando `can-create` de B → 403;
  - ADMIN consultando `can-create` de cualquiera → 200.
