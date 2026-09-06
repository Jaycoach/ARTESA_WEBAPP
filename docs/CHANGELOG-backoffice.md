# Changelog — Módulo BackOffice (branch `feature/backoffice-module`)

Branch de pruebas, nunca mergeado a `master` sin aprobación explícita. Solo se prueba en EC2 Staging. Ningún paso toca producción.

## 2026-09-05 — FASE 0: Investigación

### Entorno usado
- Repo local (working tree limpio en `master` al momento de crear el branch).
- EC2 Staging (`ec2-user@44.216.131.63`, contenedor `artesa-api-staging`) — usado para **confirmar** que los archivos leídos localmente son los mismos que están corriendo en staging, no para traer copias nuevas (el repo local ya está al día).

### Verificación de vigencia contra staging (obligatoria antes de diseñar)
Se comparó el contenido real (`docker exec artesa-api-staging cat ...`) de los archivos backend citados abajo contra el checkout local, normalizando CRLF/LF (el checkout local es Windows, staging es Linux):

| Archivo | Resultado |
|---|---|
| `src/routes/adminRoutes.js` | Idéntico (solo diferencia CRLF/LF) |
| `src/routes/orderRoutes.js` | Idéntico |
| `src/models/Order.js` | Idéntico |
| `src/models/clientProfile.js` | Idéntico |
| `src/models/ClientBranch.js` | Idéntico |
| `src/controllers/orderController.js` | Idéntico |
| `src/controllers/adminController.js` | Idéntico |
| `src/controllers/clientSyncController.js` | Idéntico |
| `src/routes/clientProfileRoutes.js` | Idéntico |
| `src/routes/clientSyncRoutes.js` | Idéntico |
| `src/middleware/auth.js` | Idéntico |
| `src/middleware/authorize.js` | Idéntico |
| `src/constants/roles.js` | Idéntico |
| `src/controllers/branchPasswordResetController.js` | Idéntico |
| `src/controllers/passwordResetController.js` | Idéntico |
| `src/utils/taxCalculator.js` | 1 línea distinta (comentario: staging dice "MASORG", local dice "Artesa" — texto de un comentario, no afecta lógica; no se corrige en esta tarea) |
| `src/services/SapOrderService.js` | Idéntico |

**Pendiente para Fase 4:** no se pudo localizar el árbol fuente del frontend en el host de staging con una búsqueda rápida (no hay contenedor de frontend separado — solo `artesa-nginx-staging` + `artesa-api-staging`; el frontend se sirve como build estático). La verificación de `Sidebar.jsx`, `AdminPage.jsx`, `ProtectedRoute.jsx` y `CreateOrderForm.jsx` se hizo contra el repo local únicamente. Antes de tocar estos archivos en Fase 4 hay que confirmar la ruta real de despliegue del frontend en staging (volumen nginx / build servido).

### Hallazgos

**1. Módulo "Administración" actual (sidebar → `/dashboard/admin`)**
- Frontend: `Sidebar.jsx` agrega el ítem con `adminOnly: true`; `hasAdminAccess` se calcula comparando `user.role` contra `1`/`3` + una lista hardcodeada de `adminEmails` de fallback (deuda técnica existente, no se replica).
- **Hallazgo de seguridad ya existente (no introducido por esta tarea):** el filtro de sidebar solo excluye por `adminOnly`; el flag `restricted` en el ítem "Clientes" (`/dashboard/Users`) nunca se lee — ese enlace es visible para cualquier usuario autenticado.
- `ProtectedRoute.jsx` solo valida `isAuthenticated`/`authType`, **nunca el rol**. `AdminPage.jsx` hace el único guard real, pero es de UI (renderiza "Acceso denegado"), no bloquea la ruta ni la carga de bundle.
- Backend `adminRoutes.js`: `GET /admin/settings` abierto a cualquier autenticado (intencional, comentado en código); `POST /admin/settings` y `/branches/:id/enable-login|disable-login` exigen rol 1 o 1/3 vía `authorize()`.
- **Conclusión:** el módulo "Administración" actual cubre configuración de portal + sync manual SAP + habilitar/deshabilitar login de sucursal. **No cubre** nada del alcance de BackOffice (listar todos los clientes/sucursales, activar/inactivar cliente, reset de password generando contraseña aleatoria, crear orden a nombre de un cliente). No hay nada que duplicar; es una sección nueva.

**2. Modelo de roles**
- `src/constants/roles.js` solo define `ADMIN: 1, USER: 2` — **no incluye `FUNCTIONAL_ADMIN`**. El mapeo real (`ADMIN=1, USER=2, FUNCTIONAL_ADMIN=3`) está hardcodeado por separado en `src/middleware/auth.js` (`checkRole`). Esto es una inconsistencia preexistente (roles.js desactualizado), no algo a corregir en esta tarea salvo que el diseño de BackOffice lo toque directamente.
- Dos middlewares de autorización paralelos y redundantes: `authorize()` (`src/middleware/authorize.js`) y `checkRole()` (`src/middleware/auth.js`). Ambos comparan `req.user.rol_id` contra un array de enteros permitidos.
- **No existe ningún sistema de permisos/capacidades granulares.** Los roles son monolíticos (entero fijo). No hay tabla de permisos ni bitmask. Cualquier capacidad nueva se modela hoy como "qué enteros de rol pasan el check", nunca como una bandera independiente del rol.

**3. Clientes y sucursales**
- `ClientProfile.getAll()` ya existe y está expuesto (`GET /api/client-profiles`, `checkRole([1,3])`) — lista todos los clientes. Reutilizable tal cual para BackOffice.
- `ClientBranch` **no tiene** `getAll()` — solo `getByClientId`, `getByUserId`, `getById`. No hay endpoint que liste sucursales de todos los clientes a la vez. Hay que agregarlo.
- Activar cliente: **sí existe** (`POST /client/:userId/activate`, `clientSyncController.activateClient`, `checkRole([1])`, hace `UPDATE users SET is_active = true`).
- Inactivar cliente: **no existe ningún endpoint** — falta construirlo (mismo patrón, `is_active = false`).
- `enableBranchLogin`/`disableBranchLogin` son un concepto distinto (login habilitado de la sucursal, no estado activo del cliente) — no confundir ni reutilizar como si fuera lo mismo.

**4. Reset de password**
- Los dos flujos existentes (`passwordResetController.js` para usuario principal, `branchPasswordResetController.js` para sucursal) son **self-service basados en token**: quien resetea fija su propia contraseña nueva. Ambos usan `bcryptjs` con `bcrypt.hash(password, 10)`.
- El único flujo donde un admin fija credenciales directamente es `adminController.enableBranchLogin`, pero ahí el admin **elige** la contraseña (la envía en el body) — es exactamente el patrón que el PROMPT prohíbe ("nunca mostrando ni permitiendo fijar una contraseña arbitraria en texto plano por el admin").
- **No existe hoy** el patrón exacto pedido (admin dispara reset → sistema genera contraseña aleatoria → se hashea con bcrypt → nunca se muestra en texto plano, o se muestra una única vez de forma controlada). Hay que construirlo, reutilizando únicamente el hash `bcrypt.hash(x, 10)` ya usado en todo el proyecto — no el patrón de "admin fija la password".

**5. Diseño previo de comerciales/pedidos a nombre de terceros**
- Grep exhaustivo de `sales_rep_assignments`, `placed_by_user_id`, `order_origin`, "vendedor", "ejecutivo comercial": **no existe ninguna tabla, columna, migración ni documentación funcional con esto implementado.**
- **Sí existe una referencia anticipada**, únicamente en `src/.claude/skills/la-artesa-dod/SKILL.md` (instrucciones internas para Claude Code, no código de producción ni diseño aprobado):
  > "`orders.user_id` vs `placed_by_user_id` — cualquier cambio a la lógica de creación de orden debe revisar ambos flujos (cliente directo y BackOffice/comercial)."
  Esto confirma que el nombre `placed_by_user_id` ya es la convención esperada por el proyecto para esta tarea — se adopta tal cual en el diseño de Fase 1, no se inventa un nombre alternativo. No hay `sales_rep_assignments` en ningún lado; si se necesita en el futuro (asignar un comercial fijo a un cliente) queda fuera del alcance actual, que es solo BackOffice/admin creando a nombre de cualquier cliente.
- **Hallazgo de seguridad preexistente relevante para el diseño:** `orderController.createOrder` toma `user_id` directamente del body sin compararlo contra `req.user.id`, y sin ningún `checkRole`/`authorize` en `POST /orders`. La única protección indirecta es que `Order.createOrder()` valida que el `branch_id` pertenezca al `client_profiles` de ese mismo `user_id`. Es decir: la posibilidad técnica de "crear a nombre de otro" ya existe de facto, pero **sin autorización explícita, sin auditoría, y sin distinguir quién realmente ejecutó la acción**. Esto no se reporta como vulnerabilidad a corregir fuera de alcance en esta tarea (no fue pedido), pero el diseño de Fase 1/2 debe cerrar esto explícitamente para el flujo BackOffice: nuevo endpoint separado (no reutilizar `POST /orders` tal cual), protegido por el permiso BackOffice, que registre `placed_by_user_id` explícitamente.

**6. SAP CardCode / SlpCode**
- `SapOrderService.createOrderInSAP()` resuelve `CardCode` siempre vía `orders.user_id → users.id → client_profiles.user_id → client_profiles.cardcode_sap` (join fijo). Para que esto siga funcionando sin tocar esta query, `orders.user_id` debe seguir siendo el **cliente real** (nunca el admin/comercial) — confirma que `placed_by_user_id` debe ser una columna aparte, nunca sustituir a `user_id`.
- `SlpCode`: **no existe ninguna referencia** en todo el repo (ni backend, ni frontend, ni migraciones). Se introduce desde cero en Fase 3, validando contra el Service Layer de staging antes de asumir el nombre de campo (mismo enfoque que se usó con `TaxCode` en la tarea de IVA) — no se asume que `SlpCode` es el nombre correcto solo porque así se llama en la documentación estándar de SAP B1; se valida contra `PRUEBAS_ARTESA_13ENE`.

**7. Reutilización confirmada — `Order.js` / `taxCalculator.js`**
- `taxCalculator.js` (`calculateProductTax`, `calculateOrderTaxes`) es agnóstico de usuario/cliente — recibe solo ítems con `tax_code_ar`. Reutilizable sin modificación para BackOffice.
- `Order.createOrder(user_id, ...)` ya exige y valida `branch_id` perteneciente a ese `user_id` vía join con `client_profiles`. Si el endpoint BackOffice llama a esta misma función pasando el `user_id` del **cliente elegido** (no el del admin), la validación existente sigue funcionando sin cambios — el único campo nuevo a persistir es `placed_by_user_id` (el admin) y `order_origin`, en una capa por encima de `Order.createOrder`, no dentro de ella.
- Patrón ya existente y reutilizable: `getProductPricesWithTaxByClientId(clientId, productCodes)` — ya recibe `clientId` en vez de `userId`; es la referencia de cómo el proyecto ya modela "operar sobre un cliente distinto al autenticado".

**8. `CreateOrderForm.jsx` (frontend, referencia UX)**
- No tiene selector de cliente — asume siempre `user.id` del autenticado. Fase 4 requiere un componente nuevo (o una variante) que agregue selección de cliente+sucursal antes de entrar al catálogo, reutilizando el resto del flujo (catálogo, desglose de impuestos pedido al backend, submit) tal cual.

### Decisiones que se derivan de estos hallazgos (a confirmar en Fase 1)
- No se toca ni se reutiliza el módulo "Administración" existente como contenedor — se agrega una sección nueva (o sub-sección) porque el alcance no se solapa.
- Dado que no existe sistema de capacidades granular, y crear un rol numérico nuevo (`rol_id = 4`) requiere tocar el mapeo duplicado e inconsistente en dos archivos (`roles.js` + `auth.js`), se propondrá en Fase 1 una bandera de capacidad (`is_backoffice` o similar) sobre los roles `ADMIN`/`FUNCTIONAL_ADMIN` existentes, no un rol nuevo — pendiente de confirmación explícita del usuario antes de aplicar.
- `placed_by_user_id` y `order_origin` se adoptan como nombres de columna (ya anticipados por el propio proyecto), sin `sales_rep_assignments` (no hay evidencia de que se haya diseñado ni se necesite para este alcance).
- El reset de contraseña de BackOffice es una función nueva (contraseña aleatoria + bcrypt), no una reutilización de `enableBranchLogin` ni de los flujos de token self-service.
- La creación de orden a nombre de un cliente se hace por un **endpoint nuevo**, no reutilizando `POST /orders` tal cual (ese endpoint ya tiene un hueco de autorización preexistente que no se hereda al flujo BackOffice).

### Decisiones confirmadas por el usuario (2026-09-05)
- **Permiso BackOffice: rol numérico nuevo `rol_id = 4` (`BACKOFFICE`)**, no una bandera sobre roles existentes. Esto implica corregir en la misma tarea el mapeo hoy duplicado/incompleto entre `src/constants/roles.js` (le falta `FUNCTIONAL_ADMIN` y le faltará `BACKOFFICE`) y `src/middleware/auth.js` (`checkRole`, que tiene el mapeo hardcodeado por separado).
- **Sin tabla `sales_rep_assignments`**: BackOffice puede operar sobre cualquier cliente activo, sin restricción de "clientes asignados a este admin". Coincide con el alcance del PROMPT.

## 2026-09-05 — FASE 1: Diseño de datos y permisos

DDL completo en `db/migrations/2026-09-05_create-backoffice-module.sql` (no aplicado aún — pendiente de confirmación explícita del usuario antes de correr contra `artesadb_dev` en staging).

**Resumen del diseño:**
- `roles`: `INSERT` de la fila `(4, 'BACKOFFICE', ...)`. **Pendiente de confirmar por PGAdmin** que `id=4` está libre en `artesadb_dev` antes de aplicar (no se asume, se valida — mismo criterio que con `TaxCode` en la tarea de IVA).
- `orders`: nuevas columnas `placed_by_user_id` (FK a `users.id`, nullable) y `order_origin` (`'self_service'` | `'backoffice'`, default `'self_service'`, con `CHECK` constraint). `orders.user_id` **no se toca** — sigue siendo el cliente real, para que `SapOrderService.createOrderInSAP()` siga resolviendo `CardCode` sin cambios.
- `backoffice_actions`: tabla de auditoría nueva, `target_type`/`target_id` polimórficos (sin FK real, ya que apunta a `client_profiles`, `client_branches` u `orders` según la acción). `details` es JSONB y **nunca** debe llevar contraseñas en texto plano — solo metadata (ids, resultado).
- **Pendiente de confirmación de permisos por endpoint** (ver pregunta al usuario): si los endpoints nuevos deben aceptar `checkRole([4])` únicamente, o `checkRole([1, 4])` para que el rol `ADMIN` (1) retenga acceso total como superadmin, consistente con el patrón ya usado en el resto de rutas del proyecto (`adminRoutes.js` casi siempre incluye el 1 explícitamente).
- Fuera del DDL, Fase 1 también deja identificado el trabajo de corrección de `src/constants/roles.js` + `src/middleware/auth.js` (agregar `FUNCTIONAL_ADMIN: 3` y `BACKOFFICE: 4` de forma consistente en ambos archivos) como parte del alcance de Fase 2, no como refactor separado.

### Decisiones confirmadas por el usuario (2026-09-05, continuación)
- Permiso por endpoint: **`checkRole([1, 4])`** — `ADMIN` (1) retiene acceso total como superadmin (consistente con el patrón ya usado en `adminRoutes.js`), `BACKOFFICE` (4) es el rol operativo específico para este módulo.
- Aplicar la migración contra staging inmediatamente tras confirmar que `id=4` estaba libre.

### VALIDADO EN STAGING — Fase 1

**Confirmación de `id=4` libre antes de aplicar** (query real vía la propia conexión de la app, sin exponer credenciales — `docker exec artesa-api-staging node -e "...pool.query('SELECT id, nombre, description FROM roles ORDER BY id')..."`):
```json
[{"id":1,"nombre":"ADMIN",...},{"id":2,"nombre":"USER",...},{"id":3,"nombre":"FUNCTIONAL_ADMIN",...}]
```
Confirmado: no existía fila con `id=4`.

**Estado ANTES de migrar** (mismo mecanismo, contra `artesadb_dev`):
```
orders_cols_before []
backoffice_actions_before [{"exists":null}]
```

**Aplicación de la migración** (`db/migrations/2026-09-05_create-backoffice-module.sql`, copiado a `/tmp` dentro del contenedor `artesa-api-staging` y ejecutado como una sola `pool.query(sql)` con el pool de conexión ya configurado de la app — sin credenciales nuevas ni hardcodeadas):
```
MIGRATION_OK
```

**Estado DESPUÉS de migrar** (mismo mecanismo):
```json
roles_after: [
  {"id":1,"nombre":"ADMIN", ...},
  {"id":2,"nombre":"USER", ...},
  {"id":3,"nombre":"FUNCTIONAL_ADMIN", ...},
  {"id":4,"nombre":"BACKOFFICE","description":"Gestión de clientes/sucursales y creación de pedidos a nombre de un cliente, sin sucursales propias asociadas"}
]
orders_cols_after: [
  {"column_name":"order_origin","data_type":"character varying","is_nullable":"NO","column_default":"'self_service'::character varying"},
  {"column_name":"placed_by_user_id","data_type":"integer","is_nullable":"YES","column_default":null}
]
check_constraint: [{"conname":"chk_orders_order_origin"}]
backoffice_actions_cols: [
  {"column_name":"id","data_type":"integer"},
  {"column_name":"admin_user_id","data_type":"integer"},
  {"column_name":"action_type","data_type":"character varying"},
  {"column_name":"target_type","data_type":"character varying"},
  {"column_name":"target_id","data_type":"integer"},
  {"column_name":"details","data_type":"jsonb"},
  {"column_name":"created_at","data_type":"timestamp with time zone"}
]
```

Migración exit 0, esquema confirmado tal como se diseñó. Archivo temporal de migración limpiado del host (`/tmp` en el EC2); el residual dentro del contenedor `/tmp` no es persistente (se pierde al recrear el contenedor, y no requiere `docker-compose down`/`up` porque no se tocó ninguna variable de entorno ni configuración de contenedor — solo datos vía SQL).

**Puntos de llamada revisados por el cambio en `orders`** (ver metodología de objetos compartidos del proyecto): `Order.js` (`createOrder`, `create`, `getUserOrders`, `getOrderById`, `getOrderWithDetails`) y `SapOrderService.js` (`createOrderInSAP`) no seleccionan `SELECT *` en ningún punto crítico que se vea afectado por columnas nuevas con default — se revisarán explícitamente al tocar cada uno en Fase 2, ya que las columnas nuevas no rompen ninguna inserción existente (tienen `DEFAULT`/son `NULL`-ables).

**FASE 1: cerrada.** Pendiente confirmación del usuario para continuar a Fase 2 (backend: endpoints + corrección de `roles.js`/`auth.js` + registro en `backoffice_actions`).

## 2026-09-05 — FASE 2: Backend

### Corrección de `roles.js`/`auth.js` (hallazgo confirmado con evidencia real de BD: `FUNCTIONAL_ADMIN` existe como `id=3` en la tabla `roles`, pero no estaba en la constante `ROLES` del código — solo se resolvía por un fallback hardcodeado de string en `checkRole()`)
- `src/constants/roles.js`: ahora `ROLES = { ADMIN: 1, USER: 2, FUNCTIONAL_ADMIN: 3, BACKOFFICE: 4 }` — única fuente de verdad.
- `src/middleware/auth.js` (`checkRole`, línea donde estaba el fallback): eliminado el ternario hardcodeado (`roleName === 'ADMIN' ? 1 : (roleName === 'USER' ? 2 : (roleName === 'FUNCTIONAL_ADMIN' ? 3 : role))`), reemplazado por `return role;` (rol desconocido se deja tal cual, mismo comportamiento previo para nombres no reconocidos, ej. `'MANAGER'` en `priceListRoutes.js`).
- **Verificación de que nada más dependía del fallback eliminado**: grep de `checkRole(` en todo `src/routes/` — de 70+ usos, solo dos pasan strings en vez de enteros: `checkRole(['ADMIN', 'MANAGER'])` en `src/routes/priceListRoutes.js:763`. `'ADMIN'` ya resuelve por `ROLES.ADMIN` (sin cambio de comportamiento); `'MANAGER'` no existe en `ROLES` ni existía en el fallback eliminado (nunca coincidía con ningún `rol_id` numérico) — comportamiento idéntico antes y después. Grep adicional de `'FUNCTIONAL_ADMIN'`/`'BACKOFFICE'` como string literal en todo `src/`: sin coincidencias — nadie más dependía del fallback.
- `node --check` limpio en ambos archivos.

### Endpoints nuevos (`src/routes/backofficeRoutes.js`, montado en `app.js` como `${API_PREFIX}/backoffice`)
Todos protegidos por `verifyToken` + `checkRole([1, 4])` (ADMIN o BACKOFFICE) + `sanitizeBody`, cada uno registra en `backoffice_actions` salvo los de solo lectura:

- `GET /backoffice/clients?search=` — `ClientProfile.getAllForBackoffice()` (método nuevo, aditivo — no se tocó `getAll()` existente para no afectar la pantalla "Clientes"). Incluye `is_active` y admite búsqueda por razón social/NIT/CardCode.
- `GET /backoffice/clients/:clientId/branches` — reutiliza `ClientBranch.getByClientId()` sin modificarlo.
- `POST /backoffice/clients/:userId/activate` / `.../deactivate` — mismo patrón que `clientSyncController.activateClient` (no tocado), pero como endpoints nuevos independientes que además registran en `backoffice_actions`. Se agregó la inactivación que no existía en ningún lugar del proyecto (hallazgo de Fase 0).
- `POST /backoffice/branches/:branchId/reset-password` — genera contraseña aleatoria (`crypto.randomBytes(10).toString('hex')`, mismo patrón ya usado en `SapClientService.js`), la hashea con `bcryptjs` (mismo paquete que usa el login real de sucursales en `branchAuthController.js`), actualiza `client_branches.password`, y la envía por correo a `email_branch` (`EmailService.sendBackofficePasswordResetEmail`, método nuevo). **La contraseña nunca se devuelve en la respuesta HTTP ni se loguea** — solo viaja por ese correo, cumpliendo el requisito del PROMPT de que el admin nunca vea ni fije la contraseña en texto plano.
- `POST /backoffice/orders` — crea la orden llamando a `Order.createOrder(user_id_del_cliente, ...)` sin modificar `Order.js` (evita tocar un archivo con cambios sin commitear de otra sesión en el host de staging), y luego hace un `UPDATE orders SET placed_by_user_id = $admin, order_origin = 'backoffice' WHERE order_id = $nueva_orden`. `orders.user_id` sigue siendo el cliente real en todo momento — `SapOrderService.createOrderInSAP()` no requiere ningún cambio para resolver `CardCode` correctamente.

### Decisión documentada: validación de fecha de entrega simplificada
`orderController.createOrder` aplica reglas de día hábil + hora límite de corte (festivos colombianos, `AdminSettings.orderTimeLimit`). El endpoint BackOffice **reutiliza** `Order.calculateDeliveryDate()` + `AdminSettings.getSettings()` solo cuando el admin no especifica fecha de entrega (mismo cálculo automático que el flujo self-service); si el admin sí especifica una fecha, **no** se duplica aquí la validación de día hábil/festivos de `orderController.js` para no bifurcar esa lógica en dos lugares sin refactor explícito. Pendiente de decisión: si Fase 4 (frontend) debe restringir el date-picker con la misma regla, o si se justifica extraer esa validación a un helper compartido — no se decide unilateralmente, se reporta como pendiente.

### Estado: IMPLEMENTADO, pendiente VALIDACIÓN EN STAGING
`node --check` limpio en los 8 archivos tocados/creados. **No se desplegó a staging todavía**: el host de EC2 Staging (`/home/ec2-user/artesa-api`) tiene cambios locales sin commitear de otra sesión sobre `Order.js`, `SapOrderService.js`, `branchOrderController.js`, `orderRoutes.js`, SSL, entre otros — un rebuild ahora mezclaría ese trabajo no confirmado con el de BackOffice en la misma imagen. Decisión tomada con el usuario: esperar a que esa sesión termine/commitee antes de desplegar y correr el script de aceptación de Fase 2 contra staging real.

## 2026-09-05/06 — FASE 3: Transmisión de SalesPersonCode a SAP

### Hallazgo con evidencia real (obligatorio: "no asumas el nombre de campo")
Se ejecutó una prueba diagnóstica de solo lectura contra el Service Layer real de staging usando el `SapBaseService` **ya desplegado** en el contenedor (sin rebuild, sin tocar código — solo un script temporal ejecutado con `docker exec ... node script.js`, borrado al terminar):

```
GET Orders?$select=DocEntry,CardCode,SlpCode,DocDate&$top=5
→ 400 { "error": { "code": "-1000", "message": "Property 'SlpCode' of 'Document' is invalid" } }
```

**`SlpCode` NO es el nombre correcto del campo en este Service Layer.** Se descargó el `$metadata` real (EDMX), se ubicó el `EntitySet Name="Orders"` → `EntityType="SAPB1.Document"`, y dentro de ese bloque específico (no de otras entidades que también tienen campos "Slp"/"SalesEmployee", como `SalesPersons`) se encontró:
```xml
<Property Name="SalesPersonCode" Type="Edm.Int32"/>
<NavigationProperty Name="SalesPerson" Partner="PurchaseRequests" Type="SAPB1.SalesPerson">
  <ReferentialConstraint Property="SalesPersonCode" ReferencedProperty="SalesEmployeeCode"/>
```
Confirmado con datos reales (órdenes ya existentes en `PRUEBAS_ARTESA_14JUL`, las mismas usadas en la tarea de IVA):
```
GET Orders?$select=DocEntry,CardCode,SalesPersonCode,DocDate&$top=5&$orderby=DocEntry desc
→ [{"DocEntry":1413,"CardCode":"CI79694003","SalesPersonCode":1}, ...]

GET SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName&$top=10
→ [{"SalesEmployeeCode":-1,"SalesEmployeeName":"-Ningún empleado del departamento de ventas-"},
   {"SalesEmployeeCode":1,"SalesEmployeeName":"LILIANA BETANCOURT MOLINA"},
   {"SalesEmployeeCode":2,"SalesEmployeeName":"ANDRES FELIPE SILVA CALLEJAS"}, ...]
```
**Campo correcto: `SalesPersonCode` (Edm.Int32) en el recurso `Orders`**, referenciando `SalesEmployeeCode` de la entidad `SalesPersons` (maestro OSLP).

### Decisión confirmada por el usuario: origen del código
El `SalesPersonCode` de cada orden BackOffice se resuelve por **mapeo admin→vendedor SAP**, no por selección manual en cada orden. Un admin sin mapeo simplemente no envía el campo (nunca se asume `-1` como default).

### DDL (aplicado y validado en staging)
`db/migrations/2026-09-06_add-sap-sales-employee-code.sql`: `ALTER TABLE users ADD COLUMN IF NOT EXISTS sap_sales_employee_code INTEGER NULL`. Aditivo, no rompe nada de lo que corre hoy.

**VALIDADO EN STAGING** (antes/después, vía la conexión de la app, sin credenciales expuestas):
```
before: []
MIGRATION_OK
after: [{"column_name":"sap_sales_employee_code","data_type":"integer","is_nullable":"YES"}]
```

### Código (IMPLEMENTADO, no desplegado — igual que Fase 2)
- `src/services/SapOrderService.js` (`createOrderInSAP`): el `SELECT` ahora hace `LEFT JOIN users pu ON o.placed_by_user_id = pu.id` para traer `pu.sap_sales_employee_code`; el objeto `sapOrder` incluye `SalesPersonCode` solo si ese valor no es `NULL`/`undefined` (spread condicional). **`orders.user_id` y la resolución de `CardCode` no se tocan** — el vendedor viaja completamente separado del cliente real.
  ⚠️ **Riesgo de colisión conocido**: este archivo tiene cambios sin commitear de otra sesión en el host de staging (ver Fase 2). El diff de Fase 3 aquí es pequeño y bien localizado (una línea en el `SELECT`, un bloque condicional en `sapOrder`), pero al desplegar habrá que reconciliar contra lo que esa otra sesión haya cambiado — nunca sobrescribir a ciegas, diff explícito antes de aplicar.
- `src/services/SapSalesPersonService.js` (nuevo): wrapper de solo lectura sobre `SapBaseService` para `GET SalesPersons`.
- `src/controllers/backofficeController.js` / `src/routes/backofficeRoutes.js`: dos endpoints nuevos —
  - `GET /backoffice/sap-sales-persons` — lista vendedores de SAP para elegir el mapeo.
  - `PATCH /backoffice/users/:userId/sap-sales-employee-code` — fija (o limpia con `null`) el mapeo de un usuario; registra `set_sales_employee_mapping` en `backoffice_actions`.

`node --check` limpio en los 4 archivos. Pendiente de VALIDACIÓN EN STAGING junto con Fase 2, cuando el host quede libre (mismo criterio: desplegar y correr el script de aceptación real contra staging, incluyendo la creación de una orden BackOffice de prueba y su transmisión a SAP con `SalesPersonCode` correcto, sin tocar clientes/órdenes reales).

### ⚠️ Limitación conocida: hoy nadie tiene el mapeo configurado
`users.sap_sales_employee_code` se puebla **exclusivamente de forma manual**, vía `PATCH /backoffice/users/:userId/sap-sales-employee-code` (un admin con acceso llama este endpoint eligiendo un código de `GET /backoffice/sap-sales-persons`). **No hay ninguna sincronización automática desde SAP** — a diferencia de `client_profiles.cardcode_sap` o `products.tax_code_ar`, que sí se sincronizan por job, este mapeo no tiene contraparte en `SapServiceManager`/`SapClientService`; es una asignación puntual, esperada para un puñado de admins, no un catálogo masivo.

Confirmado contra `artesadb_dev` (staging), consultando los 3 usuarios con rol ADMIN/FUNCTIONAL_ADMIN existentes hoy (aún no hay ningún usuario con rol BACKOFFICE creado):
```json
[
  {"id":1,"name":"Jayco Devs SAS","rol_id":1,"sap_sales_employee_code":null},
  {"id":538,"name":"MARIA CAMILA MARTINEZ LARA","rol_id":3,"sap_sales_employee_code":null},
  {"id":1144,"name":"juanpan","rol_id":3,"sap_sales_employee_code":null}
]
```
**Ningún admin tiene el mapeo configurado todavía.** Consecuencia práctica: si el módulo BackOffice se usara hoy tal cual (una vez desplegado), toda orden creada por un admin sin mapeo viajaría a SAP **sin `SalesPersonCode`** (el campo se omite, SAP aplica su propio default) — no es un bug, es el comportamiento diseñado para "admin sin mapeo", pero implica que **nadie tiene vendedor asignado hasta que alguien corra el `PATCH` explícitamente** para cada admin que vaya a operar el módulo. Esto queda como pendiente operativo para Fase 5 (QA), no de código: antes de dar el módulo por completamente funcional en staging, correr el `PATCH` al menos para el admin de prueba que se use en el QA, para validar el caso "con mapeo" además del caso "sin mapeo".
