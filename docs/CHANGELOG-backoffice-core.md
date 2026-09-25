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

**Ampliación (2026-09-25, ciclo de validación en Staging) — evidencia empírica de que este
mismo hallazgo rompe logins reales, no solo nombres guardados:** al crear usuarios de prueba
para el Paso 1 del ciclo de validación, se insertaron directamente en `users.password` hashes
de `bcrypt` calculados sobre la contraseña **cruda** (sin pasar por `sanitizeBody`). Dos de
los cuatro usuarios de prueba (ADMIN y FUNCTIONAL_ADMIN) recibieron contraseñas generadas con
`openssl rand -base64`, cuyo alfabeto incluye `/`; los otros dos (cliente y sucursal) no
tuvieron ese carácter por azar en su valor generado.

- Al intentar login real contra `POST /api/auth/login` con la contraseña cruda, ADMIN y
  FUNCTIONAL_ADMIN recibieron `401 Credenciales inválidas`. Diagnóstico: se verificó con
  `bcrypt.compare()` ejecutado directamente (sin pasar por `sanitizeBody`) que la contraseña
  cruda **sí** coincidía con el hash guardado (`compare=true` para los 3 casos probados) —
  es decir, el hash estaba bien. El log del servidor confirmó la causa real:
  `"attempt_details":"Contraseña incorrecta"` en el intento vía HTTP, para el mismo usuario
  cuyo `bcrypt.compare()` standalone daba `true` segundos antes.
- Causa: `sanitizeBody` (vía `sanitizeString`/`validator.escape()`, montado sin scoping en
  `/api` como se documentó arriba) se aplica también al campo `password` del body de
  `POST /api/auth/login`, no solo a campos de texto libre como `name`. Escapa `/` a
  `&#x2F;` antes de que el controller llame a `bcrypt.compare(password, user.password)` —
  el valor que realmente se compara ya no es el que el usuario escribió.
- **Confirmado que esto no es exclusivo de los usuarios de prueba de este ciclo:** cualquier
  usuario real cuya contraseña contenga `/`, `&`, `<`, `>`, `"` o `'` tendría el mismo problema
  en cualquier login normal por la UI — con una salvedad importante: si la cuenta se creó
  mediante el flujo normal de `register()` (que también pasa por `sanitizeBody` al escribir
  la contraseña original antes de hashearla), el hash guardado ya corresponde a la versión
  *escapada* de la contraseña, y el login (que aplica el mismo escape) sí coincide — el bug
  solo se manifiesta cuando el hash se genera por una vía que **no** pasa por `sanitizeBody`
  (como este script de QA, que insertó directo en la base de datos). No se investigó en este
  ciclo si existe alguna otra vía de creación de contraseña en el código de producción que
  hashee sin pasar por `sanitizeBody` — quedaría pendiente de otra tarea si se decide corregir
  esto.
- **Se registra como evidencia adicional del mismo hallazgo ya documentado arriba — no se
  corrige en esta tarea** (sigue fuera de alcance; ídem la nota de "Cómo se corregiría en una
  tarea aparte"). Mitigación aplicada solo en las herramientas de QA de este ciclo: los
  scripts de creación de usuarios de prueba ahora generan contraseñas con
  `openssl rand -hex` (alfabeto `0-9a-f`, sin ningún carácter que `validator.escape()` toque).

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

## Cierre — Estado DoD por fase (actualizado 2026-09-25, tras el ciclo real de validación en Staging)

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Investigación y decisiones D1-D14 | **IMPLEMENTADO** (checkpoint aprobado) |
| 1 | Git (tags, rama) + migración núcleo | **VALIDADO EN STAGING** |
| 2 | Backend: roles/permisos, usuarios de plataforma, clientes, settings, sync, D5, D7.2, D12 (código), archivo 9, hallazgos de seguridad (deleteImage, doble-escape) | **VALIDADO EN STAGING** — ver evidencia del ciclo 2026-09-25 abajo |
| D12 (migración) | Índices únicos `LOWER()` | **VALIDADO EN STAGING** |
| 6i | Fix `PasswordReset.createToken()` | **VALIDADO EN STAGING** (indirectamente, vía tokens de invitación de 72h correctos en la Fase 5-QA; sin un caso fresco de reset normal de 1h en este ciclo — ver nota) |
| 3 | Guardas D5 #4-5 en `SapClientService.js` | **VALIDADO EN STAGING** — sin inconsistencias `is_active=true AND deactivated_manually=true` (QA de solo lectura, 0 filas) |
| D13 | Script de fusión de duplicados | **VALIDADO EN STAGING** — prueba sintética exitosa (exit 0, 0 duplicados restantes, ROLLBACK real, 0 residuales); **fusión real de Producción (ids 48/1505) sigue sin ejecutarse** |
| 2-R | Línea base de regresión + comparador | **VALIDADO EN STAGING** — corridas antes/después, comparador en 0 diferencias sin explicar |
| 4 | Frontend (BackOffice UI, 4 pestañas, redirección por rol, flag legacy) | **IMPLEMENTADO** — `npm run build` pasa; backend que consume verificado end-to-end; **falta QA visual manual de Jonathan en el navegador** |
| 5 | Scripts de QA por caso (curl + SQL de solo lectura) | **VALIDADO EN STAGING** — 9/9 casos PASA, 0 FALLA |
| 6 | `docs/DEPLOY-backoffice-core.md` | **IMPLEMENTADO** (documento; corregido con el mecanismo real de deploy del frontend) |
| Fix doble-escape sucursales (3 flujos, commit `e1262ae`) | `branchRegistrationController.register`, `branchPasswordResetController.resetPassword`, `adminController.enableBranchLogin` | **VALIDADO EN STAGING para los 2 primeros** (login real exitoso con contraseña con `/` y `&`); **el 3ro no se pudo verificar de punta a punta** por un bug bloqueante no relacionado (`pool is not defined` en `adminController.js`) — el fix de rutas se aplicó igual, correcto por inspección |

**Lo único que falta para considerar el conjunto completo VALIDADO EN STAGING es la QA visual
manual de Jonathan en el navegador** (Fase 4) y la verificación end-to-end del fix de escape
del flujo 3 (bloqueada por el bug de `pool` no definido, ajeno a este núcleo). Todo lo demás
se ejecutó realmente contra Staging desplegado (no es una proyección ni un plan) en el ciclo
del 2026-09-25, con evidencia pegada abajo y en las secciones anteriores de este documento.

### Evidencia completa del ciclo de validación en Staging (2026-09-25)

**Despliegue del núcleo (commit `e1262ae` → `ef6727a`):** `deploy-staging.sh` exitoso (rebuild
parcial, exit 0), contenedor `artesa-api-staging` `healthy`, sin errores de arranque, 20/20
rutas de `/api/backoffice` confirmadas cargadas (ver evidencia detallada en la sección
"Fase 3" y en el commit `e1262ae` de este documento).

**Paso 5 — Línea base después del deploy vs. antes (`/tmp/antes.txt` 41 líneas, exit 0;
`/tmp/despues.txt` 41 líneas, exit 0):**
```
$ /tmp/compare.sh /tmp/antes.txt /tmp/despues.txt
[... 16 diferencias, todas [ESPERADA] tras completar la tabla del comparador (commit eaff48f) ...]
=== Fin de la comparación ===
Todas las diferencias encontradas están explicadas por una decisión documentada.
Código de salida: 0
```
Las 16 diferencias esperadas se dividen en: 8 rutas `/api/backoffice/*` que pasan de 404
(núcleo no desplegado) a 200/403 (núcleo activo, D3 aplicado correctamente); 2 casos de
`lastSyncTime` que pasan de un timestamp a `null` por reinicio de contenedor (estado en
memoria de `SapClientService`, no en BD — verificado en código,
`src/services/SapClientService.js:1020,1325`); 6 diferencias ya documentadas en fases
anteriores (D3, D6, 9-bis).

**Paso 6 — D13 sintético (tras corregir el orden del índice, commit `2edc264`):**
```
BEGIN
DROP INDEX
INSERT 0 1
INSERT 0 1
Par sintético creado: canonical= 2543  absorbed= 2544
SELECT 1 / UPDATE 1 / UPDATE 1 / INSERT 0 2 / CREATE INDEX
 id  |                 mail
------+--------------------------------------
 2543 | sintetico.merge.test.d13@example.com   (x2, ambas capitalizaciones resuelven al canónico)
 duplicados_restantes: 0
ROLLBACK
Código de salida: 0
```
Verificado 0 residuales (`SELECT count(*) FROM users WHERE mail LIKE '%merge.test%'` → `0`) y
el índice `uk_users_mail_lower` sigue existiendo fuera de la transacción (`→ 1`).

**Paso 7 — QA funcional (`qa-backoffice-core-cases.sh`, con `CLIENT_TEST_USER_ID=2540` y
credenciales del cliente de prueba para cubrir los 2 casos opcionales):**
```
=== Resumen: 9 casos, 9 PASA, 0 FALLA ===
Código de salida: 0
```
(D12 login con mayúsculas: PASA; D5 verifyEmail: omitido, requiere preparación manual extra
no cubierta en este ciclo; Caso 3 alta/baja/reactivación de usuario de plataforma: 6/6 PASA;
Caso 4 preview de inactivación de cliente: PASA; uploads.delete: PASA.)

**Paso 7 — QA de solo lectura (`qa-backoffice-core-readonly.sql`, tras corregir
`roles.name`→`roles.nombre`, commit `ef6727a`):** 0 duplicados por mayúsculas en `users` y
`client_branches`; los 2 índices únicos existen; las 4 columnas de inactivación manual
existen; roles 3/4 existen (`FUNCTIONAL_ADMIN`, `BACKOFFICE`); esquema de `backoffice_actions`
correcto; 0 fusiones D13 reales todavía (esperado); 0 inconsistencias
`is_active=true AND deactivated_manually=true`; 0 usuarios en rol 4. Los tokens de
`password_resets` mostrados son de invitaciones de usuario de plataforma (72h, correcto) y
filas antiguas del 2026-09-05 — no había en este ciclo un caso fresco de reset normal (1h,
6i) para verificar ese valor exacto con datos nuevos; el código del fix ya está confirmado
por lectura desde antes (ver sección 6i).

**Paso 8 — Invitación real:** `jaycoach@hotmail.com` ya existe como cuenta ADMIN real activa
(id=1) — no se pudo crear como usuario "nuevo". Con la decisión explícita de Jonathan, se usó
`POST /api/backoffice/platform-users/1/resend-invitation` → `200 {"success":true,"invitationSent":true}`.
No se completó el flujo de definir contraseña.

**Usuarios de prueba del Paso 1 (2538 ADMIN, 2539 FUNCTIONAL_ADMIN, 2540 cliente, 2601
sucursal):** se conservan, sin borrar, por instrucción explícita — Jonathan los necesita para
QA visual.

### Qué falta para el conjunto completo, y qué requiere decisión de Jonathan antes del PR a `master`

1. **QA visual manual del frontend** (única pieza de Fase 4 sin validar): login con los 4
   usuarios de prueba conservados, navegación de las 4 pestañas, toggle de
   `VITE_LEGACY_ADMIN_UI`, y completar el flujo de invitación real recibido en
   `jaycoach@hotmail.com` si se quiere verificar la UI de "definir contraseña".
2. **3 hallazgos nuevos, preexistentes, sin corregir** (documentados arriba con evidencia
   real): bug de `AuditService` en `branchPasswordResetController.js` (dos llamadas con
   argumentos mal ordenados), tokens de reset de sucursal que nacen ya expirados, y
   `adminController.js` sin importar `pool` (rompe `enableBranchLogin`/`disableBranchLogin`
   en ambas rutas, original y delegada). Ninguno bloquea el núcleo en sí (branch login vía
   registro/reset normal SÍ funciona, confirmado), pero sí bloquea la función de
   "habilitar login de sucursal manualmente desde el panel" por completo — candidatos a una
   tarea aparte, priorizados según decida Jonathan.
3. **Fusión D13 real de Producción** (ids 48/1505, ALIANZA JIMENEZ SAS) sigue pendiente de
   ejecutar — bloqueante para aplicar el índice único D12 en Producción.
4. Decisión de `VITE_LEGACY_ADMIN_UI` en el primer despliegue a Producción (Fase 6, sección 4).
5. Confirmar el resultado real de la consulta de universo de riesgo de sucursales (ya
   ejecutada: 0 — ver sección correspondiente arriba) antes de dar por cerrado ese hallazgo.

### Riesgos u hallazgos abiertos, sin resolver todavía

- ~~El bucket S3 de `deploy:production`...~~ — **RESUELTO (2026-09-25):** el mecanismo real de
  despliegue del frontend es `deploy-frontend.ps1` (Windows, perfil AWS `artesa`), no
  `npm run deploy:production` (que sí apunta a un placeholder sin usar). Bucket real de
  Producción: `artesa-frontend-production` (CloudFront `E2DQU9UCJBZKP5`). Ver `docs/DEPLOY-backoffice-core.md`.
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

## Investigación (2026-09-25) — alcance real del hallazgo de doble-escape en contraseñas

Jonathan pidió confirmar, **solo lectura, sin corregir nada**, si alguna otra vía del código
real (aparte de `register()`) guarda `users.password` o `client_branches.password` sin pasar
por `sanitizeBody`, para saber si hay usuarios reales en Producción afectados hoy, no solo el
script de QA. Se revisó cada `bcrypt.hash(...)` que escribe una contraseña, con
`git grep -n "UPDATE users SET password\|bcrypt.hash"`, y se contó el número de veces que
`sanitizeBody` (`validator.escape()`, no idempotente) se aplica al campo antes de llegar a
cada handler, siguiendo el orden real de montaje en `app.js` (los `router.use(sanitizeBody)`
de nivel-router en `userRoutes.js:10` y `productRoutes.js:88`, montados en `/api` a secas,
se ejecutan para *cualquier* request `/api/*` que los alcance, según ya documentado arriba).

**Resultado — comparación de pasadas de escape (escritura vs. lectura/login):**

| Flujo | Pasadas al escribir | Pasadas al validar/login | ¿Coinciden? |
|---|---|---|---|
| `authController.register()` → `authController.login()` | 2 (`userRoutes.js:10` + `authRoutes.js` propio en `/register`) | 2 (`userRoutes.js:10` + `authRoutes.js:137` propio en `/login`) | **Sí** — usuarios normales, sin bug |
| `passwordResetController.resetPassword()` (línea 339) → `login()` | 2 (`userRoutes.js:10` + `productRoutes.js:88`; `passwordResetRoutes.js` no tiene `sanitizeBody` propio) | 2 (igual que arriba) | **Sí** — sin bug |
| `passwordResetController.adminResetPassword()` (línea 484) → `login()` | 2 (idéntica ruta que `resetPassword`, mismo archivo de rutas sin `sanitizeBody` propio) | 2 | **Sí** — sin bug |
| `branchRegistrationController.register()` (línea 126) → `branchAuthController.login()` | 3 (`userRoutes.js:10` + `productRoutes.js:88` + `branchRegistrationRoutes.js:64` propio; mount `/api/branch-registration` en `app.js:522`, después de `productRoutes`) | 2 (`userRoutes.js:10` + `branchAuthRoutes.js:163` propio; mount `/api/branch-auth` en `app.js:455`, **antes** de `productRoutes.js` en `app.js:456`, así que nunca recibe esa pasada) | **NO — bug real** |
| `branchPasswordResetController.resetPassword()` (línea 291) → `login()` | 3 (`userRoutes.js:10` + `productRoutes.js:88` + `branchPasswordResetRoutes.js:159` propio; mount `/api/branch-password` en `app.js:482`, después de `productRoutes`) | 2 (igual que arriba) | **NO — bug real** |
| `adminController.enableBranchLogin()` (línea 378) → `login()` | 3 (`userRoutes.js:10` + `productRoutes.js:88` + `adminRoutes.js:24` propio, `router.use` a nivel de router; mount `/api/admin` en `app.js:462`) — y la ruta delegada nueva `POST /api/backoffice/settings/branches/:branchId/enable-login` (`backofficeCoreRoutes.js`) da la MISMA cuenta (3), por diseño: replica la cadena original, así que **no es un bug nuevo introducido por este núcleo** | 2 | **NO — bug preexistente, ya estaba así antes de este núcleo** |
| `userModel.createUser()` / `userModel.updateUser()` (con campo `password`, líneas 53/220) | N/A | N/A | **Sin llamador real** — se confirmó con `git grep` que ningún controller invoca estas dos funciones con contraseña; `PUT /api/users/:id` (`userController.updateUser`, la única ruta real que usa `userModel`) solo actualiza `name`/`mail`, nunca `password`. Código muerto para este propósito, no hay usuarios afectados por esta vía. |

**Verificación empírica (no solo derivación de las rutas), replicando exactamente
`validator.escape(str.trim())` de `src/middleware/security.js:6-12`, corrida dentro del
contenedor `artesa-api-staging` (sin tocar ninguna cuenta real):**
```
escaped2 !== escaped3: true
login (2 pasadas) coincide con hash de reset/registro (3 pasadas): false
```
Con una contraseña de prueba `Test/Pass&123` (contiene `/` y `&`): el hash calculado sobre la
versión escapada 3 veces (como la escribiría `branchRegistrationController.register()` o
`branchPasswordResetController.resetPassword()`) **no coincide** con `bcrypt.compare()` sobre
la versión escapada solo 2 veces (como la presenta `branchAuthController.login()`). Confirma
en código real, no solo en teoría de conteo de rutas, que el mismo carácter que rompió el
login de los usuarios de prueba ADMIN/FUNCTIONAL_ADMIN de este ciclo **rompería hoy, en
Producción, el login de cualquier sucursal real** cuya contraseña (puesta al registrarse o al
usar "olvidé mi contraseña") contenga `/`, `&`, `<`, `>`, `"` o `'`.

**Conclusión — severidad más alta que el hallazgo original:** el hallazgo ya documentado
arriba ("multi-escape...) es preexistente y **no se corrige en esta tarea** (así lo pidió
Jonathan), pero su alcance real es más amplio de lo que decía la entrada original: no es solo
un riesgo teórico de nombres guardados con entidades HTML — **hoy mismo, en Producción, puede
estar bloqueando el login de sucursales reales** que se registraron o restablecieron su
contraseña con alguno de esos 6 caracteres. Los usuarios "principales" (rol 1/2/3/4, vía
`register()`/`resetPassword()`/`adminResetPassword()`) **no están afectados** — sus 3 vías de
escritura coinciden exactamente en número de pasadas con `login()`.

**Hallazgo adicional, encontrado en el camino (no relacionado con `sanitizeBody`, mismo
endpoint):** `adminController.js:377` hace `require('bcrypt')` (el paquete nativo), pero
`package.json` solo declara `bcryptjs` como dependencia — `bcrypt` **no está instalado** en
Staging (confirmado con `require.resolve('bcrypt')` dentro del contenedor →
`MODULE_NOT_FOUND`). Esto significa que `enableBranchLogin` (tanto la ruta original
`POST /api/admin/branches/:branchId/enable-login` como la nueva delegada
`POST /api/backoffice/settings/branches/:branchId/enable-login`) **probablemente arroja 500
en cualquier intento real**, independientemente del problema de escape — un bug distinto,
preexistente, que esta tarea tampoco corrige, pero que es relevante porque el nuevo
`SettingsTab.jsx` (Fase 4) le da a este endpoint una UI mucho más visible y accesible
(antes solo estaba en el panel admin legacy) — ver aviso explícito a Jonathan sobre esto en
el chat de esta sesión.

**No se corrigió nada de lo anterior — solo se investigó y se documentó, según instrucción
explícita.** Ambos hallazgos (escape y `bcrypt` faltante) quedan como candidatos a una tarea
aparte, con prioridad más alta que antes para el primero (login de sucursales reales
afectado hoy) y para el segundo (endpoint roto por dependencia faltante).

## HALLAZGO DE SEVERIDAD ALTA (2026-09-25) — universo de riesgo real en Producción, doble-escape en sucursales

**Preexistente, NO introducido por este núcleo. No se corrige en esta tarea — solo se
documenta, por instrucción explícita de Jonathan.**

El hallazgo de doble-escape de arriba (`branchRegistrationController.register()` y
`branchPasswordResetController.resetPassword()` escapan la contraseña 3 veces al escribirla;
`branchAuthController.login()` la escapa solo 2 veces al validarla) puede bloquear el login de
cualquier sucursal real cuya contraseña contenga `/`, `&`, `<`, `>`, `"` o `'`. No es posible
saber directamente si una contraseña ya hasheada tenía alguno de esos caracteres, pero **sí es
posible acotar el universo de sucursales expuestas**, porque `is_login_enabled = true` en
`client_branches` **solo** lo pone `branchRegistrationController.js:134` (registro) o
`adminController.js:387` (`enableBranchLogin`) — las dos vías de 3 pasadas de escape;
`branchPasswordResetController.js:123` únicamente *exige* que ya esté en `true`, nunca lo
activa. Es decir: **toda sucursal con `is_login_enabled = true` tuvo su contraseña escrita por
uno de los 2 flujos afectados**, sin excepción.

**Consulta de solo lectura para que Jonathan la ejecute en Producción** (no modifica nada,
no imprime ninguna contraseña ni hash):

```sql
-- Universo de riesgo: sucursales cuya password fue escrita por un flujo de 3-pasadas
-- de escape (branchRegistrationController.register / adminController.enableBranchLogin),
-- que es el único camino hacia is_login_enabled = true.
SELECT
  COUNT(*) FILTER (WHERE password IS NOT NULL) AS total_con_password,
  COUNT(*) FILTER (WHERE password IS NOT NULL AND is_login_enabled = true) AS universo_riesgo_login_habilitado,
  COUNT(*) FILTER (WHERE password IS NOT NULL AND is_login_enabled = true AND email_verified = true) AS universo_riesgo_y_correo_verificado,
  COUNT(*) FILTER (WHERE password IS NOT NULL AND is_login_enabled = false) AS con_password_pero_login_deshabilitado,
  COUNT(*) FILTER (WHERE last_login IS NOT NULL AND is_login_enabled = true) AS con_login_exitoso_historico
FROM client_branches;
```

`con_login_exitoso_historico` es una segunda cota útil: si una sucursal con
`is_login_enabled = true` **ya tiene** un `last_login` registrado, su contraseña actual no
tiene el problema (si lo tuviera, nunca habría podido loguear para generar ese
`last_login`) — a menos que haya reseteado su contraseña *después* de ese último login exitoso.
Para acotar aún más, una segunda consulta de solo lectura, opcional:

```sql
-- Sucursales con login habilitado pero SIN ningún login exitoso registrado — el subconjunto
-- de mayor sospecha (nunca han podido entrar, podría ser este bug o cualquier otra causa).
SELECT branch_id, branch_name, client_id, is_login_enabled, email_verified,
       created_at_auth, updated_at_auth, last_login, failed_login_attempts
FROM client_branches
WHERE is_login_enabled = true AND last_login IS NULL
ORDER BY updated_at_auth DESC NULLS LAST
LIMIT 200;
```

**Impacto si el universo es distinto de cero:** cada sucursal en `universo_riesgo_login_habilitado`
es un cliente real de La Artesa que, si su contraseña contiene alguno de los 6 caracteres, no
puede loguear hoy en el portal de sucursales — sin ningún error visible salvo
"Credenciales inválidas" genérico, indistinguible de una contraseña realmente incorrecta desde
la perspectiva del usuario o del soporte.

**Resultado ejecutado por Jonathan en Producción (2026-09-25):**
```
total_con_password = 0
```
**Ninguna sucursal en Producción tiene contraseña definida hoy** — el universo de riesgo
actual es **CERO**. Consistente con el hallazgo de D12 (131 sucursales totales, 0 con login
habilitado). El mecanismo del bug es real y reproducible en código (evidencia empírica ya
registrada arriba), **pero no afecta ningún dato ni usuario real en este momento** — nadie ha
sido bloqueado por esto hasta hoy.

**Decisión de Jonathan, dado que no hay datos reales en juego:** se corrige ahora, dentro de
este mismo ciclo, en vez de dejarlo como deuda técnica para una tarea aparte. Ver la sección
siguiente para la corrección aplicada a los 3 flujos.

## RESUELTO — corrección del doble-escape en los 3 flujos de sucursales (commit `e1262ae`)

Cambios (ediciones puntuales, mismo patrón que archivo 9/D12 — quitar el `sanitizeBody`
redundante para volver a la paridad de pasadas con el login):

- `src/routes/branchRegistrationRoutes.js:64` — se quitó `sanitizeBody` propio de
  `POST /register`. Queda en 2 pasadas (`userRoutes.js:10` + `productRoutes.js:88`), igual
  que `branchAuthRoutes.js:163`. `/check-email` (línea 30) no se tocó — no escribe contraseña.
- `src/routes/branchPasswordResetRoutes.js:159` — se quitó `sanitizeBody` propio de
  `POST /reset`. Mismo resultado: 2 pasadas. `/request-reset` (línea 79) no se tocó.
- `src/routes/adminRoutes.js` — el `router.use(sanitizeBody)` compartido (antigua línea 24)
  se reemplazó por un `sanitizeBody` explícito **solo** en `POST /settings` (mantiene sus 3
  pasadas de siempre, sin cambio de comportamiento ahí). `POST /branches/:branchId/enable-login`
  y `disable-login` quedan sin esa pasada extra — 2 pasadas para `enable-login`, en paridad
  con el login.
- `src/routes/backofficeCoreRoutes.js` — se quitó el `sanitizeBody` propio de las 2 rutas
  delegadas (`enable-login`/`disable-login`), que replicaban a propósito el conteo del
  original (ahora corregido) — se ajustan para seguir en paridad.

**Diagnóstico previo de `adminRoutes.js` (pedido antes de tocar el archivo):** se listaron
las 4 rutas del archivo — únicamente `POST /settings` (además de `enable-login`) tenía
dependencia real de las 3 pasadas (paridad con `/api/backoffice/settings`); `GET /settings`
es de solo lectura y `disable-login` no escribe ningún campo sensible. Ninguna otra ruta
existe en el archivo. Se confirmó con `grep -n "^router\.\(get\|post\|put\|delete\|patch\)"`.

### Evidencia real — redeploy en Staging y prueba de los 3 flujos, contraseñas con `/` y `&`

Redeploy de `feature/backoffice-core` en commit `e1262ae` sobre Staging (rebuild parcial,
exit 0; contenedor `healthy`; sin errores de arranque nuevos).

**Prueba 1 — `branchRegistrationController.register()`** (sucursal de prueba nueva,
`branch_id=2602`, contraseña `Test/Reg&1`):
```
register status=200 body={"success":true,"message":"Registro completado exitosamente. Ya puede iniciar sesión.",...}
login1 status=200 has_token=1
```
✅ Login exitoso con la contraseña que contiene `/` y `&`.

**Prueba 2 — `branchPasswordResetController.resetPassword()`** (sucursal de prueba nueva,
`branch_id=2603`, contraseña nueva `Test/Reset&1`):
```
reset status=500 body={"success":false,"message":"Error interno del servidor"}
login2 status=200 has_token=1
```
El endpoint `/reset` devolvió 500 **pero el login con la contraseña nueva funcionó** — la
contraseña sí se actualizó correctamente en la base de datos (evidencia de que el fix de
escape funciona). El 500 es un **falso negativo por un bug preexistente distinto y no
relacionado**, documentado abajo (bug de `AuditService`). No se tocó ese bug — solo se
documenta.

**Prueba 3 — `adminController.enableBranchLogin()` (vía `POST /api/backoffice/settings/branches/:branchId/enable-login`)**
(sucursal de prueba nueva, `branch_id=2604`, contraseña `Test/Enable&1`):
```
enable-login status=500 body={"success":false,"message":"Error interno del servidor"}
login3 status=401 has_token=0
```
Aquí el 500 **sí bloquea la operación por completo** (a diferencia de la Prueba 2) — ver el
hallazgo de `pool` no definido, abajo. No se pudo probar el fix de escape para este flujo de
punta a punta vía HTTP real, porque el endpoint nunca llega a ejecutar el `UPDATE` de
`client_branches.password`. El fix de escape en las rutas (`adminRoutes.js`,
`backofficeCoreRoutes.js`) se aplicó igual, y su corrección es correcta por inspección de
código (mismo patrón exacto que las Pruebas 1 y 2, ambas confirmadas empíricamente) — pero
queda sin verificación end-to-end hasta que el bug de `pool` (hallazgo nuevo, ver abajo) se
corrija en una tarea aparte.

**Limpieza:** las 3 sucursales de prueba (2602, 2603, 2604) y sus filas dependientes
(`active_branch_tokens`, `branch_login_history`, `branch_password_resets`) se borraron al
terminar — confirmado `SELECT count(*) FROM client_branches WHERE branch_id IN (2602,2603,2604)` → `0`.

## HALLAZGO NUEVO — `AuditService.logAuditEvent()` con argumentos mal ordenados en `branchPasswordResetController.js`

**Preexistente, no introducido por este núcleo, no se corrige — solo se documenta**, según el
mismo criterio ya aplicado a los hallazgos anteriores.

`AuditService.logAuditEvent(eventType, data, userId, severity = 'INFO')` — el 4to parámetro
debe ser un valor válido del enum Postgres `severity_level`. Ambos llamados de
`branchPasswordResetController.js` pasan por error el `branch_id` numérico en esa posición:

- `src/controllers/branchPasswordResetController.js:183` (dentro de `requestReset`):
  `branch.branch_id` en la posición de `severity`.
- `src/controllers/branchPasswordResetController.js:317` (dentro de `resetPassword`):
  `tokenData.branch_id` en la posición de `severity`.

**Efecto real, confirmado con logs de Staging:** en ambos casos, el `INSERT`/`UPDATE`
principal (crear el token + enviar el correo; o actualizar la contraseña + marcar el token
usado) **ya se completó exitosamente** cuando el código intenta auditar y truena con
`invalid input value for enum severity_level: "2603"` (por ejemplo). Ese error, sin capturar,
propaga como `500 Error interno del servidor` al cliente — **un falso negativo**: la sucursal
recibe un error, pero su solicitud de reset/su nueva contraseña sí se procesó. Evidencia
completa (logs reales de Staging, sucursal de prueba 2603):
```
info: Token de reset creado para sucursal {"branchId":2603,...,"tokenId":1}
info: Correo de reset de contraseña para sucursal enviado exitosamente {...}
info: Correo de reset enviado para sucursal {"branchId":2603,...}
error: Error registrando evento de auditoría {"error":"invalid input value for enum severity_level: \"2603\"",...}
error: Error enviando correo de reset para sucursal {"error":"invalid input value for enum severity_level: \"2603\"",...}
POST /api/branch-password/request-reset 500 318.259 ms - 71
```
y, para `resetPassword` (después de corregir manualmente el `expires_at` del token para
poder llegar a este punto — ver el siguiente hallazgo):
```
info: Iniciando reset de contraseña para sucursal {...,"token":"5b2cb6ab..."}
error: Error registrando evento de auditoría {"error":"invalid input value for enum severity_level: \"2603\"",...}
error: Error reseteando contraseña de sucursal {"error":"invalid input value for enum severity_level: \"2603\"",...}
POST /api/branch-password/reset 500 109.853 ms - 56
```
Login posterior con la nueva contraseña → `200`, confirma que la actualización sí se
guardó pese al 500. **Impacto:** cualquier sucursal real que use "olvidé mi contraseña" hoy
recibiría siempre un error 500 en pantalla, incluso cuando el proceso funcionó — un problema
de confiabilidad/UX real, independiente del hallazgo de escape.

## HALLAZGO NUEVO — tokens de reset de sucursal nacen ya expirados (`expires_at < created_at`)

**Preexistente, no introducido por este núcleo, no se corrige — solo se documenta.**

Al crear un token real vía `POST /api/branch-password/request-reset` para la sucursal de
prueba 2603, el registro quedó así en `branch_password_resets`:
```
 id | branch_id | token_prefix | token_len |         created_at         |       expires_at        | used_at | aun_vigente 
----+-----------+--------------+-----------+----------------------------+-------------------------+---------+-------------
  1 |      2603 | 5b2cb6abb7a7 |        64 | 2026-09-25 01:11:13.136136 | 2026-09-24 21:11:13.614 |         | f
```
**`expires_at` queda ~4 horas ANTES que `created_at`** — el token nace ya expirado. Esto
explica por qué la Prueba 2 dio `400 Token inválido o expirado` en el primer intento: no es
un problema de mi fix, es que **ningún token de reset de sucursal generado por el flujo real
puede usarse jamás** (siempre falla `expires_at > CURRENT_TIMESTAMP`). Consistente con un
desfase de timezone entre el `Date` que calcula el controller (`branchPasswordResetController.js`,
cerca de donde llama a `BranchPasswordReset.createToken`) y `CURRENT_TIMESTAMP`/columna de
Postgres — no se investigó la causa exacta línea por línea, solo se confirmó el síntoma con
datos reales. Para poder probar el fix de escape en la Prueba 2 de arriba, se corrigió
manualmente (una sola vez, solo en el dato de prueba) el `expires_at` de ese token vía SQL
directo, sin tocar el código.

**Impacto:** el flujo completo de "olvidé mi contraseña" de sucursales está roto de punta a
punta hoy — ni siquiera llega a la parte del bug de `AuditService` en un uso real, porque el
token que el correo entrega al usuario ya está expirado desde el momento en que se genera.

## HALLAZGO NUEVO (corrige un hallazgo anterior) — `enableBranchLogin`/`disableBranchLogin` rotos por `pool` no definido, no por `bcrypt` faltante

**Preexistente, no introducido por este núcleo, no se corrige — solo se documenta.** Corrige
el hallazgo anterior de esta misma sección (el de `require('bcrypt')`/`MODULE_NOT_FOUND`):
esa observación seguía siendo cierta (`bcrypt` nativo no está instalado), **pero no es la
causa real del fallo**, porque el código nunca llega a ejecutar esa línea.

`src/controllers/adminController.js` **no importa `pool`** en ningún lugar (confirmado:
`grep -n "require('../config/db')" src/controllers/adminController.js` → sin resultados), a
pesar de que `pool.query(...)` se usa 6 veces en el archivo: líneas 351, 364, 393 (dentro de
`enableBranchLogin`) y 474, 496, 499 (dentro de `disableBranchLogin`). **Ambas funciones
truenan con `ReferenceError: pool is not defined` en su primera consulta**, antes de llegar
siquiera al `require('bcrypt')`. Evidencia real de Staging (Prueba 3, sucursal 2604):
```
error: Error al habilitar login de sucursal {"branchId":"2604","context":"AdminController","email":"qa-branch-enable-test@invalid.local","error":"pool is not defined","stack":"ReferenceError: pool is not defined\n    at enableBranchLogin (/app/src/controllers/adminController.js:351:36)\n    at /app/src/services/backofficeCore/auditWrapper.js:78:12\n..."}
POST /api/backoffice/settings/branches/2604/enable-login 500 25.550 ms - 56
```
**Impacto:** tanto la ruta original (`POST /api/admin/branches/:branchId/enable-login` /
`disable-login`) como la nueva ruta delegada del núcleo
(`POST /api/backoffice/settings/branches/:branchId/enable-login` / `disable-login`) **nunca
han funcionado, en ningún ambiente, desde que sea que `pool` dejó de importarse en este
archivo** — no es algo introducido por este núcleo (la ruta delegada solo reexpone el mismo
bug ya existente en el original). No se pudo verificar el fix de escape de esta Prueba 3 de
punta a punta por esta razón (ver arriba). El fix de escape en las rutas se aplicó de todas
formas, por consistencia y porque es correcto por inspección — solo falta que alguien más
corrija primero el `pool is not defined` para poder probarlo con una llamada HTTP real.

**Los 3 hallazgos de arriba (AuditService, expires_at, pool no definido) son candidatos a una
tarea aparte — ninguno se corrige aquí, todos preexistentes.**
