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

### Archivo 9 — `adminRoutes.js` (commit `da6aad8`)

Tabla completa (3 call-sites; el archivo tiene 4 rutas en total):

| línea | ruta | protección actual | capacidad nueva | ¿cambia? |
|---|---|---|---|---|
| `:26` | `GET /settings` | solo `verifyToken` | — | Sin cambio |
| `:29-32` | `POST /settings` | `authorize([1,3])` | `settings.manage` | Cambia (mismos roles) |
| `:34-36` | `POST /branches/:branchId/enable-login` | `authorize([1])` | `branch_login.manage` | Cambia (mismos roles) |
| `:38-40` | `POST /branches/:branchId/disable-login` | `authorize([1])` | `branch_login.manage` | Cambia (mismos roles) |

Condición 6 cumplida: no se tocó `fileUploadOptions` (línea 17-18, import compartido con
`backofficeCoreRoutes.js`) ni `router.use(sanitizeBody)`/`router.use(verifyToken)` (líneas 20-24).

```
$ node --check src/routes/adminRoutes.js
SINTAXIS OK
$ grep -n "authorize" src/routes/adminRoutes.js
(sin resultados)
$ grep -n "fileUploadOptions\|router.use(sanitizeBody)\|router.use(verifyToken)" src/routes/adminRoutes.js
18:const fileUploadOptions = require('../config/adminFileUploadOptions');
21:router.use(verifyToken);
24:router.use(sanitizeBody);
32:  fileUpload(fileUploadOptions),
$ node -e "...script de verificacion..."
TOTAL: 4
GET /settings | getSettings
POST /settings | requirePermission(settings.manage) > <anonymous> > updateSettings
POST /branches/:branchId/enable-login | requirePermission(branch_login.manage) > enableBranchLogin
POST /branches/:branchId/disable-login | requirePermission(branch_login.manage) > disableBranchLogin
```

### Archivo 9 — `userRoutes.js` (commit `97ea0f4`) — último de los 7 archivos restantes

Tabla completa (1 call-site; el archivo tiene 3 rutas en total):

| línea | ruta | protección actual | capacidad nueva | ¿cambia? |
|---|---|---|---|---|
| `:44` | `GET /users` | `checkRole([1])` | `platform_users.manage` | Cambia (mismo rol) |
| `:58` | `GET /users/:id` | solo `verifyToken` | — | Sin cambio |
| `:79` | `PUT /users/:id` | solo `verifyToken` | — | Sin cambio |

Riesgo verificado: `getUsers` (`userController.js:116-135`) es un listado estándar, sin exponer
contraseñas.

```
$ node --check src/routes/userRoutes.js
SINTAXIS OK
$ grep -n "checkRole" src/routes/userRoutes.js
(sin resultados)
$ node -e "...script de verificacion..."
TOTAL: 3
GET /users | verifyToken > requirePermission(platform_users.manage) > getUsers
GET /users/:id | verifyToken > getUserById
PUT /users/:id | verifyToken > updateUser
```

### Archivo 9 — CERRADO: reconciliación final y grep global

**62 call-sites migrados** = `clientSyncRoutes(14) + sapSyncRoutes(11) + orderRoutes(9) +
uploadRoutes(9) + productRoutes(7) + clientProfileRoutes(2) + clientBranchRoutes(1) +
priceListRoutes(3) + productImageRoutes(2) + adminRoutes(3) + userRoutes(1) = 62`, coincide con
`68 − 6 (secureProductRoutes.js, desmontado) = 62`.

```
$ grep -rn "checkRole\|authorize" src/routes/*.js
```
Resultado: solo quedan `productRoutes.js:101,118` y `uploadRoutes.js:184,218`
(`checkRole([1,2,3])`/`checkRole([1,2])`, sin cambio, incluyen USER — fuera de la matriz por
diseño), los 6 de `secureProductRoutes.js` (desmontado, inalcanzable), y 2 menciones en
comentarios de `backofficeCoreRoutes.js` (no llamadas reales).

**Hallazgo menor, sin tocar:** `paymentRoutes.js:3` importa `checkRole` pero nunca lo usa en
ninguna de sus 2 rutas — import muerto preexistente, nunca tuvo una llamada real (por eso no
apareció en el inventario de 68 de la Fase 0). Fuera de alcance del archivo 9.

## Fase 5 — Plan de QA acumulado (pendiente de ejecutar contra Staging real)

Casos agregados durante la Fase 2, a ejecutar cuando arranque la Fase 5 formal:

- Con token de FUNCTIONAL_ADMIN: `GET /api/backoffice/settings` → 200; `GET /api/backoffice/sync/status` → 403
  (detecta cualquier interferencia de otro router en el montaje del núcleo).
- `GET /orders/can-create/:userId`:
  - cliente A consultando `can-create` de A → 200;
  - cliente A consultando `can-create` de B → 403;
  - ADMIN consultando `can-create` de cualquiera → 200.
- 6i: token de reset de contraseña de usuario usado a los 61 minutos de generado → rechazado
  (`INVALID_TOKEN`, antes seguía siendo válido hasta las 24h).

### Fase 5 — Scripts de QA (IMPLEMENTADO, pendiente de que Jonathan los corra)

Dos scripts nuevos, complementarios a `scripts/tests/backoffice-core-regression.sh` (Fase 2-R,
que valida la matriz de acceso) — estos validan que las reglas de negocio nuevas realmente
funcionan:

- **`scripts/tests/qa-backoffice-core-cases.sh`**: QA funcional por caso, agrupado por
  decisión (D12, D5, alta/baja de usuario de plataforma con motivo obligatorio, doble
  inactivación rechazada con 409, D3 — FUNCTIONAL_ADMIN sin acceso a `platform-users`,
  `uploads.delete` restringido a ADMIN). Crea su propio usuario de plataforma de prueba
  (correo `qa-backoffice-<random>@invalid.local`, nunca hardcodeado) y lo deja inactivo/activo
  según el flujo — no toca cuentas reales. Los casos D12/D5/4 requieren que Jonathan defina
  variables de entorno apuntando a datos de PRUEBA existentes (`LOGIN_TEST_EMAIL_LOWER`,
  `DEACTIVATED_TEST_TOKEN`, `CLIENT_TEST_USER_ID`) — si no se definen, esos casos se omiten
  explícitamente en la salida (no fallan en falso). Imprime PASA/FALLA por caso y termina con
  código de salida 1 si algo falló.
  - Verificado: `bash -n scripts/tests/qa-backoffice-core-cases.sh` → sin errores de sintaxis.
  - Verificadas contra el código real las rutas/campos usados: `POST /api/backoffice/platform-users`
    responde `201` con `data.id` (`platformUsersController.js:156-161`); doble inactivación
    responde `409` (`platformUsersController.js:185`); `DELETE /api/upload/:fileName` es la ruta
    real de `deleteImage` (`uploadRoutes.js:143-148`, montada en `/api/upload` por `app.js:473`);
    `GET /api/auth/verify-email/:token` usa parámetro de ruta, no query string
    (`authRoutes.js` ~325).
- **`scripts/tests/qa-backoffice-core-readonly.sql`**: verificación de solo lectura (ningún
  `UPDATE`/`INSERT`/`DELETE`) — segura de correr en Producción en cualquier momento. Confirma:
  cero duplicados de correo por mayúsculas (D12), existencia de los índices `uk_*_lower`,
  columnas de inactivación manual en `users` (Fase 1), roles 3/4, esquema de
  `backoffice_actions`, historial de fusiones D13 y que las cuentas absorbidas quedaron
  correctamente inactivas con el correo liberado, que ningún usuario inactivado manualmente
  quedó con `is_active=true` (caso de inconsistencia que señalaría un bug real en las guardas
  D5/Fase 3), vigencia de tokens de reset (~1h tras 6i), y censo de usuarios en rol 4
  (BACKOFFICE, sin capacidades activas en este núcleo).
- **Instrucciones para Jonathan (orden sugerido):**
  1. Antes de nada: `psql -f scripts/tests/qa-backoffice-core-readonly.sql` contra Staging para
     tener una foto del estado actual (debe mostrar 0 en los casos "esperado: 0 filas").
  2. Aplicar D13 (`db/scripts/merge-duplicate-users-staging-synthetic-test.sql` primero, luego
     el real si aplica) y D12 (migración, ya `VALIDADO EN STAGING`) si aún no están aplicados ahí.
  3. Correr `qa-backoffice-core-cases.sh` con los tokens de Staging.
  4. Volver a correr el SQL de solo lectura y comparar contra el paso 1.
  5. Cualquier `FALLA` o fila inesperada en el SQL: no avanzar a Fase 6/Producción sin revisarlo.

## D12 — Datos de duplicados por mayúsculas (ejecutados por Jonathan, 23/24-sep-2026)

- **Producción (`laartesa`):** `users` tiene 1 duplicado por mayúsculas (ids 48 y 1505,
  ALIANZA JIMENEZ SAS — se resuelve con la fusión D13 antes del despliegue). `client_branches`:
  `UNIQUE (email_branch)` exacto ya existe, **0 correos repetidos** (ni exactos ni por
  mayúsculas), 15 sucursales tienen mayúsculas en el correo.
- **Staging (`artesadb_dev`):** `users` sin duplicados. `client_branches`: igual que
  Producción, 0 repetidos, 16 sucursales con mayúsculas.
- **Hallazgo menor, no corregido:** en ambos ambientes existe además
  `idx_client_branches_email_branch`, redundante con la constraint única existente. Se
  conserva (no se elimina nada).

### D12 — código: CERRADO (commit `926ae95`) — migración: VALIDADO EN STAGING

**Evidencia pegada — verificación de frontend (punto 1, mensaje de `register`):**
```
$ git grep -n "ya está registrado\|already" -- src/views/frontend
src/views/frontend/LoginArtesa/src/Components/Register/EmailVerification.jsx:88:            apiMessage.includes('already verified') ||
```
Ningún componente compara el texto `"ya está registrado"` — seguro cambiar el mensaje directo.

**Evidencia pegada — las 12 comparaciones migradas a `LOWER()`:**
```
$ git grep -n "LOWER(" -- src/controllers/authController.js src/models/userModel.js \
  src/models/BranchAuth.js src/controllers/branchAuthController.js \
  src/controllers/branchPasswordResetController.js src/controllers/adminController.js \
  src/controllers/branchRegistrationController.js
src/controllers/adminController.js:365:        'SELECT branch_id FROM client_branches WHERE LOWER(email_branch) = LOWER($1) AND branch_id != $2',
src/controllers/authController.js:395:                WHERE LOWER(u.mail) = LOWER($1)
src/controllers/authController.js:654:                'SELECT id FROM users WHERE LOWER(mail) = LOWER($1)',
src/controllers/authController.js:919:            'SELECT id, email_verified FROM users WHERE LOWER(mail) = LOWER($1)',
src/controllers/branchAuthController.js:435:                 WHERE LOWER(email_branch) = LOWER($1)`,
src/controllers/branchAuthController.js:526:                 WHERE LOWER(email_branch) = LOWER($1)`,
src/controllers/branchAuthController.js:816:                FROM client_branches WHERE LOWER(email_branch) = LOWER($1)`,
src/controllers/branchPasswordResetController.js:109:         WHERE LOWER(cb.email_branch) = LOWER($1)`,
src/controllers/branchRegistrationController.js:32:                 WHERE LOWER(email_branch) = LOWER($1)`,
src/controllers/branchRegistrationController.js:104:                'SELECT branch_id, email_branch, password, branch_name FROM client_branches WHERE LOWER(email_branch) = LOWER($1)',
src/models/BranchAuth.js:18:                 WHERE LOWER(b.email_branch) = LOWER($1) AND b.is_login_enabled = true`,
src/models/userModel.js:86:            WHERE LOWER(mail) = LOWER($1);
```

**Evidencia pegada — cero comparaciones exactas restantes:**
```
$ git grep -nE "(mail|email_branch) = \$[0-9]" -- src/
(sin resultados)
```

**Evidencia pegada — diff completo de `register()` (`authController.js`):**
```diff
@@ -392,7 +392,7 @@ class AuthController {
                 FROM users u
                 JOIN roles r ON u.rol_id = r.id
                 LEFT JOIN client_profiles cp ON u.id = cp.user_id
-                WHERE u.mail = $1
+                WHERE LOWER(u.mail) = LOWER($1)
             `;
             
             const result = await pool.query(query, [mailField]);
@@ -651,7 +651,7 @@ class AuthController {
 
             // 1. Verificar si el usuario ya existe
             const userExists = await pool.query(
-                'SELECT id FROM users WHERE mail = $1',
+                'SELECT id FROM users WHERE LOWER(mail) = LOWER($1)',
                 [mail]
             );
 
@@ -659,7 +659,7 @@ class AuthController {
                 logger.warn('Intento de registro con correo existente', { mail });
                 return res.status(400).json({
                     success: false,
-                    message: 'El correo electrónico ya está registrado'
+                    message: 'El correo electrónico ya está registrado. Si es tuyo, usa "Olvidé mi contraseña" para recuperar el acceso.'
                 });
             }
 
@@ -747,14 +747,25 @@ class AuthController {
             });
 
         } catch (error) {
+            if (error.code === '23505' && ['uk_users_mail', 'uk_users_mail_lower'].includes(error.constraint)) {
+                logger.warn('Registro rechazado por índice único (condición de carrera)', {
+                    mail: req.body.mail,
+                    constraint: error.constraint
+                });
+                return res.status(400).json({
+                    success: false,
+                    message: 'El correo electrónico ya está registrado. Si es tuyo, usa "Olvidé mi contraseña" para recuperar el acceso.'
+                });
+            }
+
             logger.error('Error en el proceso de registro', {
                 error: error.message,
                 stack: error.stack,
                 mail: req.body.mail
             });
 
-            const errorMessage = process.env.NODE_ENV === 'development' 
-                ? error.message 
+            const errorMessage = process.env.NODE_ENV === 'development'
+                ? error.message
                 : 'Error interno del servidor';
 
             return res.status(500).json({
@@ -905,7 +916,7 @@ class AuthController {
         
         // Verificar si el usuario existe y necesita verificación
         const { rows } = await pool.query(
-            'SELECT id, email_verified FROM users WHERE mail = $1',
+            'SELECT id, email_verified FROM users WHERE LOWER(mail) = LOWER($1)',
             [mail]
         );
```

### D12 — migración VALIDADO EN STAGING (aplicada por Jonathan en `artesadb_dev`)

- Precondición verificada: 0 duplicados por `LOWER()` en `users` y en `client_branches`.
- Aplicación en una sola transacción: código de salida 0.
- Índices creados (confirmados):
  - `uk_users_mail_lower` → `CREATE UNIQUE INDEX ... ON users USING btree (lower((mail)::text))`
  - `uk_client_branches_email_lower` → `CREATE UNIQUE INDEX ... ON client_branches USING btree (lower((email_branch)::text))`
- **Estado:** la migración queda **VALIDADO EN STAGING**; el código D12 (las 12 comparaciones +
  cambios de `register()`) sigue **IMPLEMENTADO** hasta que la Fase 5 lo valide con evidencia real.
- **Nota temporal, no aplica a Producción:** mientras el host de Staging compartido corra un
  branch sin el código D12 (hoy `fix/price-list-sync-unification`, la migración ya aplicada pero
  el código aún sin desplegar ahí), un `register` con una variante de mayúsculas de un correo
  existente responderá `500` por el índice nuevo (el prechequeo exacto no lo detecta, pero el
  `INSERT` sí choca con `uk_users_mail_lower`). Es esperado y temporal — en Producción, migración
  y código se despliegan juntos (ver REGLA CRÍTICA de la Fase 6), así que este caso no ocurre ahí.

## 6i — RESUELTO: bug de `PasswordReset.createToken()` (sombreado de `expiresAt`)

**Único llamador real:** `passwordResetController.js:119,122` (`requestReset`), pasa
`new Date(Date.now() + 3600000)` = 1 hora. El correo (`EmailService.sendPasswordResetEmail`)
ya decía "expirará en 1 hora". El bug forzaba 24h reales pese al mensaje. Corregido quitando
la redeclaración de `expiresAt` dentro de `createToken()` (`PasswordReset.js`).

**Restricción intencional de seguridad:** el enlace de recuperación de contraseña de un
usuario normal ahora expira realmente en 1 hora (antes eran 24h reales). Diferencia esperada
en la comparación de la Fase 2-R.

**`BranchPasswordReset.createToken()` (`BranchPasswordReset.js:14-43`): NO tiene el mismo bug**
— usa el `expiresAt` recibido directamente, sin redeclararlo. No se tocó.

```
$ node --check src/models/PasswordReset.js
SINTAXIS OK
```

## Fase 3 — RESUELTO: guardas D5 #4-5 en `SapClientService.js`

- `syncAllClientsWithSAP()` (línea ~967): `UPDATE ... WHERE id=$1 AND deactivated_manually = false`;
  si `rowCount=0`, incrementa `stats.omitidos_por_inactivacion_manual` y loguea `warn`.
- `syncClientsWithSAP()` (línea ~1280): mismo patrón; el contador solo se incrementa cuando
  la reactivación se omite (no cuando se aplica, que sigue sumando `stats.activated` igual que antes).
- Sin conflicto con `fix/price-list-sync-unification` (confirmado en el archivo 9: esa rama
  solo toca `SapOrderService.js` y migraciones, nunca `SapClientService.js`).

```
$ node --check src/services/SapClientService.js
SINTAXIS OK
```

Con esto, los 5 caminos de D5 quedan cubiertos: #1-3 (Fase 2, commit `d79e5fb`) + #4-5 (Fase 3, este commit).

## D13 — Script de fusión de cuentas duplicadas (IMPLEMENTADO, pendiente de que Jonathan lo ejecute)

- `db/scripts/merge-duplicate-users.sql`: parametrizado (`canonical_id`, `absorbed_id`, `admin_id`
  vía `psql -v`), una sola transacción, sigue exactamente D13 del CHANGELOG: copia el hash de
  contraseña de la absorbida a la canónica, libera el correo de la absorbida
  (`fusionado-en-<canonico>.<local>@invalid.local`), la marca `deactivated_manually=true` con
  motivo (incluye el correo original), revoca tokens de ambas cuentas (mismo esquema que
  `TokenRevocation.revokeAllUserTokens`), audita `merge_user_accounts` (target absorbida) y
  `password_replaced_by_merge` (target canónica), y verifica al final 0 duplicados por
  `LOWER(mail)` (aborta con `RAISE EXCEPTION` si falla). SQL inverso documentado al final del
  archivo (con marcadores a rellenar desde `backoffice_actions.details`). Ninguna fila se borra.
- **Modo ensayo:** misma invocación con `sed 's/^COMMIT;$/ROLLBACK;/'` sin editar el archivo.
- **Para Producción (ALIANZA JIMENEZ SAS):** `canonical_id=48`, `absorbed_id=1505`, `admin_id=1`.
- `db/scripts/merge-duplicate-users-staging-synthetic-test.sql`: prueba end-to-end en Staging sin
  tocar datos reales — baja `uk_users_mail_lower` (D12), crea un par sintético con el mismo correo
  en distinta capitalización, **recrea el índice**, corre la fusión completa inline, verifica login
  con ambas capitalizaciones y 0 duplicados, y termina en `ROLLBACK` — DDL es transaccional en
  PostgreSQL, así que el índice nunca deja de existir de verdad para nadie fuera de esta transacción.
- Estado: **IMPLEMENTADO**. Falta que Jonathan lo ejecute en Staging (primero el sintético, luego
  el ensayo/real con datos reales si aplica) y, en Producción, en el orden de la REGLA CRÍTICA.

## Fase 2-R — Línea base de regresión (IMPLEMENTADO, pendiente de que Jonathan la corra)

- `scripts/tests/backoffice-core-regression.sh`: `curl` contra `BASE_URL` parametrizable, con
  `ADMIN_TOKEN`/`FUNCTIONAL_ADMIN_TOKEN`/`USER_TOKEN`/`BRANCH_TOKEN` por variable de entorno
  (nunca hardcodeados). Solo endpoints **sin efectos** (todos `GET`, salvo el `POST` sin clave
  a `/api/internal/*` que se espera rechazado). Cubre: portal de cliente, rutas `[1,3]` y `[1]`
  representativas, las 19 rutas de `/api/backoffice/*`, las diferencias ya documentadas (9-bis,
  D6, 6h), sucursal, y `/api/internal/*` sin clave.
- `scripts/tests/compare-regression-results.sh`: compara dos salidas (antes/después) y marca
  cada diferencia como `[ESPERADA]` (con la razón, tomada de una tabla de decisiones ya
  documentadas: 9-bis, D6, matriz D3) o `[NO EXPLICADA]` — sale con código 1 si hay alguna sin
  explicar.
- **Instrucciones para Jonathan:**
  1. Correr contra el Staging **actual** (sin el núcleo desplegado) → línea base `antes.txt`.
  2. Desplegar `feature/backoffice-core` en Staging.
  3. Correr de nuevo → `despues.txt`.
  4. `./scripts/tests/compare-regression-results.sh antes.txt despues.txt`.
  5. Si hay `[NO EXPLICADA]`, no avanzar a la Fase 5 sin revisarlo primero.
- `bash -n` sobre ambos scripts: sintaxis OK.

## Fase 4 — Frontend (IMPLEMENTADO, pendiente `npm run build` de Jonathan en su propio entorno de validación final y QA visual)

### Qué se reutilizó de `feature/backoffice-module` (clase A) vs. qué es nuevo

- **Reutilizado (patrón, no código con lógica de clase C):** el patrón de ruta lazy-loaded bajo
  `/dashboard/*` en `App.jsx` (mismo estilo `lazy(() => import(...))` + `<Suspense>`) y el patrón
  de filtrado de items del `Sidebar.jsx` por rol/capacidad — se tomaron como referencia (`git diff`
  contra `origin/feature/backoffice-module`) pero **no se hizo checkout de esos archivos**, porque
  ambos ya tenían cambios propios en esta rama (Login/Sidebar) — se aplicaron ediciones puntuales.
- **Nuevo (no existía en la rama pausada, es parte del núcleo D1-D14):** todo el árbol
  `Components/Dashboard/Pages/Backoffice/` (4 pestañas + shell), `services/backofficeCoreService.js`,
  `constants/backofficePermissions.js`. Nombrado deliberadamente distinto del `backofficeService.js`
  de la rama pausada para evitar colisión en un futuro rebase de Fase 7 (cuando se publique la
  clase B2/C).

### Archivos modificados (ediciones puntuales, no checkout)

- **`App.jsx`**: import lazy de `BackofficePage` + 2 rutas (`backoffice`, `backoffice/*`) bajo
  `/dashboard`, mismo patrón `Suspense`/`LoadingScreen` que el resto de rutas del dashboard.
- **`Login.jsx`**: se agregó `user` a la desestructuración de `useAuth()`. El `useEffect` de
  redirección post-login ahora calcula `defaultPath`: roles 1/3/4 → `/dashboard/backoffice`,
  cualquier otro rol (incluye rol 2 y sucursales) → `/dashboard` sin cambios. Se respeta primero
  cualquier `from` de deep-link ya existente — el default de BackOffice solo aplica si no hay
  deep-link pendiente.
- **`Sidebar.jsx`**: ícono `FaUserTie` nuevo; constante de módulo `LEGACY_ADMIN_UI` leída de
  `import.meta.env.VITE_LEGACY_ADMIN_UI === 'true'` (default `false` si la env var no está
  definida); estado `hasBackofficeAccess` (roles 1/3/4); los items "Clientes" y "Administración"
  se marcaron `legacyOnly: true` — **no se borraron**, quedan ocultos por defecto y reaparecen si
  se define `VITE_LEGACY_ADMIN_UI=true` en el build; nuevo item "BackOffice" (`backofficeOnly: true`)
  apuntando a `/dashboard/backoffice`.

### Archivos nuevos

- `constants/backofficePermissions.js` — espejo de solo-lectura de `src/constants/permissions.js`
  del backend (17 capacidades, `ROLES`, `roleHasPermission`). El backend sigue siendo la única
  fuente de verdad para la autorización real; este archivo solo controla qué se muestra u oculta
  en la UI.
- `services/backofficeCoreService.js` — wrapper de axios sobre las 20 rutas de
  `/api/backoffice/*` (usuarios de plataforma, clientes, settings, sync), con un helper `wrap()`
  que normaliza `{ success, data }` / `{ success: false, error }` para que los componentes no
  manejen `try/catch` repetido.
- `Components/Dashboard/Pages/Backoffice/BackofficePage.jsx` — shell de pestañas, filtra pestañas
  visibles por `roleHasPermission`, deniega acceso si el rol no es 1/3/4 o si no hay ninguna
  pestaña habilitada. Para ADMIN (rol 1), consulta `GET /client-profiles/user/:id` y, si existe
  perfil de cliente, muestra un enlace "Ver portal de cliente" hacia `/dashboard` (no cambia el rol,
  solo navegación).
- `Components/Dashboard/Pages/Backoffice/PlatformUsersTab.jsx` — listado, alta con invitación,
  reenvío de invitación, activar/inactivar (con motivo obligatorio), cambio de rol inline
  (solo ADMIN↔FUNCTIONAL_ADMIN, igual que la regla de backend en `userStatusService.changeRole`).
- `Components/Dashboard/Pages/Backoffice/ClientsTab.jsx` — sub-pestañas "Con perfil" / "Registros
  sin perfil"; modal de vista previa de inactivación (pedidos pendientes, pedidos pendientes sin
  sincronizar, sucursales, sucursales con login habilitado — mismos campos que
  `getDeactivationPreview` del backend); motivo obligatorio; botones de acción ocultos si el rol
  no tiene `clients.manage_status`.
- `Components/Dashboard/Pages/Backoffice/SettingsTab.jsx` — formulario de hora de cierre + banner
  (multipart/FormData); sección de login de sucursal (habilitar/deshabilitar) visible solo con
  `branch_login.manage`.
- `Components/Dashboard/Pages/Backoffice/SyncTab.jsx` — estado y pendientes de sincronización;
  botones de disparo manual (clientes/sucursales/productos) visibles solo con `sap_sync.execute`.
- `Components/Dashboard/Pages/Backoffice/BackofficePage.scss` — utilidades compactas
  (`.bo-card`, `.bo-table`, `.bo-badge`, `.bo-btn`, `.bo-form-row`, `.bo-alert`,
  `.backoffice-page__tabs`) para no depender de un sistema de diseño nuevo.

### Bandera `VITE_LEGACY_ADMIN_UI`

- Permite ocultar las pantallas legacy "Clientes"/"Administración" del sidebar sin borrar ni
  una línea de esas pantallas — quedan intactas y accesibles por URL directa si alguien las
  necesita durante la transición. Si no se define la variable en el build, el valor por defecto
  es `false` (oculto) — es decir, el comportamiento por defecto post-deploy ya prioriza la UI
  nueva de BackOffice, y Jonathan puede revertir visualmente el sidebar a la vista legacy con un
  solo build flag si hiciera falta, sin tocar código.

### Validación — `npm run build`

Comando ejecutado: `npm run build` (equivale a `vite build`) dentro de
`src/views/frontend/LoginArtesa/`. Resultado: **build exitoso**, 1213 módulos transformados,
sin errores. Salida resumida (rutas relevantes al núcleo):

```
✓ 1213 modules transformed.
dist/assets/BackofficePage-C690swxD.css            2.04 kB │ gzip:   0.72 kB
dist/assets/BackofficePage-mltXYO3T.js             17.55 kB │ gzip:   4.55 kB
✓ built in 23.51s
```

No se reportaron errores de compilación, imports rotos, ni warnings nuevos atribuibles al
núcleo (el único warning de la corrida es el ya preexistente de Tailwind sobre features
experimentales, no relacionado con este trabajo).

- Estado: **IMPLEMENTADO**. Falta que Jonathan valide visualmente en su propio entorno (QA
  manual: login por rol 1/3/4, navegación entre pestañas, flags `VITE_LEGACY_ADMIN_UI`) y, en
  Staging, que el flujo de extremo a extremo (crear usuario de plataforma → invitación →
  activar cuenta → cambio de rol) funcione contra el backend real ya desplegado.

## Fase 6 — Plan de despliegue a Producción (borrador acumulado)

### REGLA CRÍTICA — orden de despliegue obligatorio

Las guardas D5 (`authController.js` `verifyEmail`, `clientSyncController.js` `activateClient`
y `simulateSapSync`, commit `d79e5fb`) y las de la Fase 3 (`SapClientService.js`, pendientes)
consultan `users.deactivated_manually`. **Esta columna no existe en Producción** hasta que se
aplique la migración del núcleo (`db/migrations/2026-09-23_backoffice-core.sql`, ya
`VALIDADO EN STAGING`, ver Fase 1).

**La migración DEBE aplicarse en Producción ANTES de desplegar este código.** Si el código se
despliega primero, cada `UPDATE users ... WHERE ... AND deactivated_manually = false` fallará
con `42703` (`undefined_column`) — y eso rompe, en producción real: `verifyEmail` (nadie podría
verificar su correo), `activateClient` (activación manual de clientes), `simulateSapSync`, y los
2 crons de sincronización SAP de `SapClientService.js` (Fase 3, aún no aplicados a este archivo).

Detalle completo del plan de despliegue (pasos, comandos, rollback, puntos de decisión
pendientes): `docs/DEPLOY-backoffice-core.md`.

## Cierre — Estado DoD por fase (2026-09-24)

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Investigación y decisiones D1-D14 | **IMPLEMENTADO** (checkpoint aprobado) |
| 1 | Git (tags, rama) + migración núcleo | **VALIDADO EN STAGING** |
| 2 | Backend: roles/permisos, usuarios de plataforma, clientes, settings, sync, D5, D7.2, D12 (código), archivo 9, hallazgos de seguridad (deleteImage, doble-escape) | **IMPLEMENTADO** — código completo, sin ejecutar contra Staging como conjunto |
| D12 (migración) | Índices únicos `LOWER()` | **VALIDADO EN STAGING** (código D12 sigue IMPLEMENTADO) |
| 6i | Fix `PasswordReset.createToken()` | **IMPLEMENTADO** |
| 3 | Guardas D5 #4-5 en `SapClientService.js` | **IMPLEMENTADO** |
| D13 | Script de fusión de duplicados | **IMPLEMENTADO** — script listo, sin ejecutar (ni ensayo ni real) |
| 2-R | Línea base de regresión + comparador | **IMPLEMENTADO** — scripts listos, sin correr contra Staging |
| 4 | Frontend (BackOffice UI, 4 pestañas, redirección por rol, flag legacy) | **IMPLEMENTADO** — `npm run build` pasa, sin QA visual manual de Jonathan |
| 5 | Scripts de QA por caso (curl + SQL de solo lectura) | **IMPLEMENTADO** — sin correr |
| 6 | `docs/DEPLOY-backoffice-core.md` | **IMPLEMENTADO** (es un documento, no requiere validación en Staging) |

**Ninguna fase de código quedó en VALIDADO EN STAGING ni en APROBADO PARA PRODUCCIÓN** — solo
las dos migraciones (Fase 1 y D12) fueron aplicadas y confirmadas por Jonathan directamente.
Todo el código del núcleo está escrito, compilado/verificado localmente (`node --check` en
cada archivo backend, `npm run build` en el frontend) y pusheado a
`origin/feature/backoffice-core`, pero **no se ha ejecutado ningún ciclo real contra Staging
desplegado** ni contra Producción.

### Qué debe correr Jonathan, y en qué orden, antes de pedir el PR a `master`

1. Desplegar `feature/backoffice-core` en Staging (backend + frontend).
2. `scripts/tests/backoffice-core-regression.sh` contra Staging **antes** del deploy → línea
   base; de nuevo **después** → comparar con `compare-regression-results.sh`.
3. Aplicar (si no están aplicadas ya en ese Staging) las migraciones de Fase 1 y D12 — ya
   validadas individualmente, pero confirmar que el código desplegado las usa correctamente.
4. Ensayar D13 con el script sintético
   (`db/scripts/merge-duplicate-users-staging-synthetic-test.sql`), luego, si hay un caso real
   de prueba, el script real en modo ensayo (`ROLLBACK`) antes que en modo real.
5. Correr `scripts/tests/qa-backoffice-core-cases.sh` y
   `scripts/tests/qa-backoffice-core-readonly.sql` contra ese mismo Staging.
6. QA visual manual del frontend: login con rol 1/3/4, navegación de las 4 pestañas, flujo
   completo de alta de usuario de plataforma (crear → invitación real recibida → activar
   cuenta con el link del correo → cambio de rol), inactivación/activación de cliente con
   motivo, toggle de `VITE_LEGACY_ADMIN_UI`.
7. Si todo lo anterior pasa sin `[NO EXPLICADA]` ni `FALLA`: pasar Fase 2, D12(código), 6i,
   Fase 3, D13(script), 2-R y Fase 4/5 a **VALIDADO EN STAGING** en este mismo documento, con
   la evidencia real pegada (no un resumen).
8. Solo entonces seguir `docs/DEPLOY-backoffice-core.md` para Producción.

### Riesgos u hallazgos abiertos, sin resolver todavía

- El bucket S3 de `deploy:production` del frontend (`package.json:19`) parece un placeholder
  (`s3://tu-bucket-production`) — confirmar el real antes de cualquier deploy a Producción.
- La fusión D13 del caso conocido de Producción (ALIANZA JIMENEZ SAS, ids 48/1505) sigue sin
  ejecutarse — es un bloqueante para aplicar el índice único D12 en Producción (Paso 2b/3 del
  plan de despliegue).
- Nadie ha confirmado aún si el primer despliegue a Producción debe salir con
  `VITE_LEGACY_ADMIN_UI=true` (transición gradual) o sin ella — ver Fase 6, sección 4.

### Próximo paso que requiere detenerse y preguntar (por instrucción explícita del prompt de cierre autónomo)

**No se crea Pull Request hacia `master` en esta sesión.** Cuando Jonathan confirme que el
ciclo de Staging (pasos 1-7 arriba) quedó limpio, se debe pedir su aprobación explícita antes
de abrir el PR — ese es uno de los 5 puntos de parada del prompt de cierre autónomo.

### Verificación puntual — ítem "Clientes" del sidebar sí quedó marcado `legacyOnly`

Jonathan pidió verificar contra el archivo real (no el resumen del CHANGELOG) si el ítem
"Clientes" (`/dashboard/Users`) tiene `legacyOnly: true`, dado que la Fase 4 solo mencionó
"Clientes" y "Administración" como marcados así sin pegar el diff completo de ese archivo.

**Evidencia — `grep` contra el estado real de `Sidebar.jsx` (commit `1997104`, ya pusheado):**
```
$ grep -n "legacyOnly\|restricted\|backofficeOnly" src/views/frontend/LoginArtesa/src/Components/Dashboard/SidebarSection/Sidebar.jsx
109:        { path: "/dashboard/Users", icon: FaUsers, label: "Clientes", restricted: true, adminOnly: true, legacyOnly: true },
111:        { path: "/dashboard/admin", icon: FaTools, label: "Administración", adminOnly: true, legacyOnly: true },
112:        { path: "/dashboard/backoffice", icon: FaUserTie, label: "BackOffice", backofficeOnly: true }
120:  // legacyOnly: solo se muestra si VITE_LEGACY_ADMIN_UI está encendido (D1: esas
126:        (!item.legacyOnly || LEGACY_ADMIN_UI) &&
127:        (!item.backofficeOnly || hasBackofficeAccess)
```

**Conclusión: (a) — el código ya estaba correcto, no hacía falta ningún cambio.** El ítem
"Clientes" sí tiene `legacyOnly: true` desde el commit original de la Fase 4
(`1997104`, `git log` confirmado). No se hizo ningún commit adicional para este punto porque
no había nada que corregir — se deja esta entrada como constancia de la verificación pedida
y su resultado, ya que el CHANGELOG de la Fase 4 no había pegado el fragmento textual del
array de ítems y por eso no era auto-verificable sin volver al archivo real.
