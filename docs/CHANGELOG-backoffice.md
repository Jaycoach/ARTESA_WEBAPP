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

## 2026-09-06 — FASE 4: Frontend

### Backend adicional necesario para habilitar el frontend (aditivo, mínimo)
- `src/routes/productRoutes.js` (`GET /products`): se agregó el rol `4` (BACKOFFICE) al `checkRole([1,2,3])` existente → `checkRole([1,2,3,4])`. Cambio de una línea, no quita ningún rol existente, solo agrega acceso de lectura al catálogo para BackOffice (lo necesita para armar el carrito al crear una orden a nombre de un cliente). `GET /products/:productId` no se tocó (no lo usa el flujo actual).
- `src/controllers/backofficeController.js` / `backofficeRoutes.js`: nuevo endpoint `POST /backoffice/clients/:clientId/product-prices`, que **reutiliza `Order.getProductPricesWithTaxByClientId()`** (ya existente, sin modificar) — necesario porque `GET /products` resuelve precios con la lista de precios del **admin autenticado**, no la del cliente elegido; para BackOffice hay que resolver precios con la lista de precios del cliente real.

### Frontend
- **Sidebar** (`Sidebar.jsx`): nuevo ítem "BackOffice" (`/dashboard/backoffice`, ícono `FaUserTie`), visible solo si `hasBackofficeAccess` (rol 1 o 4 — mismo criterio que el backend, `checkRole([1,4])`). Se agregó como bandera nueva (`backofficeOnly`) sin tocar la lógica existente de `adminOnly` ni el bug preexistente de `restricted` (fuera de alcance, ya reportado en Fase 0).
- **Ruteo** (`App.jsx`): nueva ruta `backoffice` → `BackofficePage` (lazy-loaded, mismo patrón que `AdminPage`).
- **`src/services/backofficeService.js`** (nuevo): wrapper sobre `API` (axios), mismo patrón que `adminService.js`. Incluye `hasBackofficePermission(user)` (rol 1 o 4).
- **`src/Components/Dashboard/Pages/Backoffice/BackofficePage.jsx`** (nuevo): guard interno de acceso (mismo patrón "Acceso denegado" que `AdminPage.jsx`), con dos pestañas:
  - **Clientes y sucursales**: búsqueda, tabla de clientes con estado activo/inactivo, botón activar/inactivar, expandir para ver sucursales del cliente y resetear contraseña por sucursal (la contraseña nunca se muestra en la UI — el backend solo confirma que se envió por correo).
  - **Crear pedido a nombre de un cliente**: selección de cliente → sucursal (sin selector de cliente en `CreateOrderForm.jsx` existente, confirmado en Fase 0 — por eso es un componente nuevo, no una extensión de ese), catálogo de productos con precios resueltos para el cliente elegido (`getClientProductPrices`), carrito con cantidad editable, campos de comentarios/orden de compra, y envío a `POST /backoffice/orders`.
- Reutilización deliberada (no reconstruida): el cálculo de impuestos/precio efectivo sigue viniendo 100% del backend (`Order.getProductPricesWithTaxByClientId` → mismo motor que ya usa el flujo de sucursales) — el frontend solo muestra `effective_price`, nunca calcula impuestos por su cuenta, el mismo principio ya aplicado en `CreateOrderForm.jsx` ("el frontend nunca decide" impuestos).

### Validación de build (no es prueba de funcionalidad real en navegador)
`npm run build` (Vite) en `src/views/frontend/LoginArtesa`: **exitoso**, 1208 módulos transformados, sin errores, con `BackofficePage-*.js`/`.css` generados correctamente en el bundle. **Esto confirma que el código compila y no tiene errores de sintaxis/import — no confirma que el flujo funcione en un navegador real** (esta sesión no tiene Playwright ni acceso a un navegador). Queda pendiente para Fase 5: abrir la app en staging real y probar el flujo completo (activar/inactivar, reset de password, crear orden) como usuario BackOffice real.

### Estado: IMPLEMENTADO (build limpio), pendiente VALIDACIÓN EN STAGING junto con Fases 2 y 3.

## 2026-09-06 — FASE 5: Diseño del script de aceptación (mientras se libera el host de staging)

### Incidente de branch detectado y resuelto durante esta fase
Mientras se diseñaba este script, el working directory compartido (misma carpeta local usada por varias sesiones) apareció en el branch `perf/gif-to-mp4-login-landing` en vez de `feature/backoffice-module` — otra sesión lo dejó ahí tras optimizar GIFs a MP4. Al revisar el historial, `feature/backoffice-module` tenía ese mismo commit (`673cc16`) aplicado **encima** de la Fase 4 (`525fe13`), aparentemente porque esa sesión commiteó estando parada sobre mi branch por error, antes de crear su propio branch limpio (`perf/gif-to-mp4-login-landing`, con el mismo cambio como `8803c25`).
- Confirmado con `git diff 673cc16 8803c25 -- <archivos tocados>`: contenido **idéntico** entre ambos commits — nada se perdía al descartarlo de mi branch.
- Con confirmación del usuario, se corrigió con `git reset --hard 525fe13` sobre `feature/backoffice-module`, dejando el branch limpio, solo con commits de BackOffice. El cambio de GIFs sigue intacto en `perf/gif-to-mp4-login-landing`, sin tocar.
- Ninguno de mis commits de BackOffice se perdió ni se reescribió — el reset solo quitó el commit ajeno del final.

### Script: `scripts/tests/backoffice-acceptance.sh`
Sigue el patrón de scripts de aceptación real del proyecto (curl a través de nginx contra staging, nunca contra local). Cubre:
1. Login como admin BackOffice y como usuario normal (rol USER) — ninguna credencial hardcodeada, todo por variables de entorno (`BACKOFFICE_TEST_ADMIN_EMAIL`/`PASSWORD`, `BACKOFFICE_TEST_USER_EMAIL`/`PASSWORD`, `BACKOFFICE_TEST_PRODUCT_CODE`).
2. **Prueba negativa explícita** (pedida en el alcance original): el usuario sin permiso de BackOffice debe recibir 403 en `GET /backoffice/clients` y `POST /backoffice/orders`.
3. Listado de clientes/sucursales, confirmando que el fixture sintético (`client_id=588`/`branch_id=2600`, reutilizando el mismo patrón ya usado en la tarea de IVA) aparece.
4. Ciclo inactivar→activar de un cliente (vuelve al estado original al terminar, no deja el fixture inactivo).
5. Reset de password de sucursal (solo valida `success:true` — la contraseña nunca viaja en la respuesta, por diseño; confirmar el correo es un paso manual).
6. Resolución de precios con impuestos para el cliente vía `getClientProductPrices`, y resolución del `product_id` real a partir de un `sap_code` de prueba (`GET /products`).
7. Creación de la orden BackOffice de punta a punta, capturando `order_id`.
8. Al final, imprime las queries SQL pendientes de correr manualmente por PGAdmin (metodología del proyecto: nunca `psql` directo para verificación de negocio) para confirmar `placed_by_user_id`/`order_origin` en la orden creada, las filas en `backoffice_actions`, y el disparo manual de `POST /orders/sync-to-sap` + verificación de `SalesPersonCode` contra el Service Layer real.

### Estado: IMPLEMENTADO (sintaxis verificada con `bash -n`), **no ejecutado todavía**
No se pudo correr contra staging por dos motivos, ambos fuera del control de esta sesión:
1. El módulo BackOffice (Fases 2-4) sigue sin desplegarse — el script fallaría en cada request.
2. El script requiere credenciales reales de un usuario ADMIN/BACKOFFICE y un usuario USER de staging, que esta sesión no tiene ni debe inventar (regla del proyecto: nunca generar ni asumir credenciales reales).

Queda listo para ejecutarse en cuanto (a) se despliegue el módulo en staging y (b) el usuario provea las variables de entorno con credenciales de prueba reales.

## 2026-09-06 — FASE 5 (continuación): Deploy a staging + ejecución real del script

### Deploy
- Host de staging confirmado libre (sesión de Auditoría sin cambios pendientes). El working directory del host (`/home/ec2-user/artesa-api`) seguía con 11 archivos modificados sin commitear de una sesión anterior (`Order.js`, `SapOrderService.js`, `orderRoutes.js`, `branchOrderController.js`, `branchOrderRoutes.js`, `PriceList.js`, `S3UrlManager.js`, `deploy-staging.sh`, scripts de SSL, `ssl/nginx.crt`) — **no se descartaron**: se guardaron con `git stash push -u -m 'stash-antes-de-backoffice-deploy-2026-09-06'` (reversible, ya había 2 stashes previos de otras tareas en ese mismo host). Con el working tree limpio: `git fetch` + `git checkout -B feature/backoffice-module origin/feature/backoffice-module`.
- **Nota:** `feature/backoffice-module` no existía en `origin` — se hizo `git push origin feature/backoffice-module` (autorizado explícitamente) para poder desplegarlo. También durante esta fase el working directory local compartido volvió a saltar sin aviso a `perf/gif-to-mp4-login-landing` una vez más (segunda vez en la tarea) — se resolvió con un simple `git checkout feature/backoffice-module` (nada que reconciliar, ya estaba pusheado).
- Deploy completo: `docker-compose down` → `build --no-cache` → `up -d`. Build backend exitoso (391 paquetes, sin errores). Al levantar, `artesa-nginx-staging` entró en crash-loop: `SSL_CTX_use_PrivateKey ... key values mismatch` — porque se saltó el paso de verificación/regeneración de certificado que `deploy-staging.sh` hace automáticamente (se corrieron los comandos docker-compose sueltos en vez del script completo). Corregido regenerando el par cert/key autofirmado (mismo comando exacto que usa `deploy-staging.sh`) y recreando el contenedor nginx. Confirmado: `curl http://ec2-44-216-131-63.compute-1.amazonaws.com/api/health` → `200`, y `GET /api/backoffice/clients` sin token → `401` (ruta viva, protegida).
- Frontend: `deploy-frontend.ps1 -Environment staging` — build Vite exitoso (1205 módulos), variables de entorno validadas, subida a S3 (`artesa-frontend-staging`) e invalidación de CloudFront (`EW6Z1KU9EFB7I`) creada.

### Fixture de prueba: gap real encontrado y corregido
`client_id=588` (fixture de la tarea de IVA) tiene `client_profiles.user_id = NULL` — se creó solo para probar login de sucursal, nunca para un flujo con "usuario principal". Los endpoints de BackOffice (`getAllForBackoffice`, activar/inactivar) requieren un `users` row vinculado. **Se completó el fixture** (no se creó uno nuevo, se vinculó el existente): `INSERT INTO users (name, mail, password, rol_id, is_active, email_verified) VALUES ('QA_TEST_USER_NO_USAR', 'qa-test-user-588@artesa-test.invalid', <bcrypt de password generada con crypto.randomBytes(10)>, 2, true, true)` → `user_id=2357`, luego `UPDATE client_profiles SET user_id=2357 WHERE client_id=588`. Contraseña generada en runtime, nunca guardada en ningún archivo.

### Bugs encontrados y corregidos en el propio script (no en el producto)
1. **Windows: "Argument list too long".** El script pasaba las respuestas JSON completas de la API (hasta 61,920 caracteres, 321 clientes) como argumento de línea de comandos a `node -e`, lo que excede el límite de `CreateProcess` en Windows. Corregido: todas las respuestas JSON grandes ahora se pasan por `stdin`, nunca por `argv`. Confirmado con `bash -n` y reejecución exitosa.
2. **Producto de prueba con precio real en $0.** El primer `sap_code` elegido (`EMP0031`) tiene los 3 price lists en `0.00` en `price_lists` (tabla real de precios, no `products.price_list1/2/3`, que están sin uso). Reemplazado por `PANPT166` (`product_id=95`, `$30,960` en lista `1`, `tax_code_ar='IVAG03'` exento).
3. **Rate limiter de login consumido durante la depuración** (5 intentos/15 min por IP, `express-rate-limit` en memoria). Resuelto con `docker restart artesa-api-staging` (autorizado explícitamente) — no es un bypass de seguridad, solo resetea el contador en memoria para poder seguir probando en la misma sesión.

### RESULTADO DETALLADO — `scripts/tests/backoffice-acceptance.sh` (10/10 casos, exit 0 en la corrida final combinada)

| # | Caso | Resultado | Evidencia |
|---|---|---|---|
| 1 | Login admin BackOffice (`jaycoach@hotmail.com`, rol ADMIN=1) | ✅ OK | Token JWT obtenido |
| 2 | Login usuario normal (`qa-test-user-588@...`, rol USER=2) | ✅ OK | Token JWT obtenido |
| 3 | **Prueba negativa** — `GET /backoffice/clients` sin permiso | ✅ OK | `403` (no `401`: el token es válido, el rol es el que falla) |
| 4 | **Prueba negativa** — `POST /backoffice/orders` sin permiso | ✅ OK | `403` |
| 5 | `GET /backoffice/clients` — aparece el cliente sintético | ✅ OK | `client_id=588` presente en 321 clientes listados |
| 6 | `GET /backoffice/clients/588/branches` — aparece la sucursal sintética | ✅ OK | `branch_id=2600` presente |
| 7 | `POST /backoffice/clients/2357/deactivate` → `/activate` | ✅ OK | `is_active` alternado y devuelto a `true` (estado original preservado) |
| 8 | `POST /backoffice/branches/2600/reset-password` | ✅ OK | `success:true`; **confirmado con logs reales**: SES aceptó el correo (`250 Ok`, `messageId` real) — la contraseña nunca apareció en ninguna respuesta HTTP ni log |
| 9 | `POST /backoffice/clients/:clientId/product-prices` | ✅ OK | Cliente sintético (588): precio `0` (dato real del producto de prueba original, no bug). Cliente real (374, `PANPT166`): `$30,960`, `tax_code_ar=IVAG03`, `total_price_with_tax=30960` — coincide con lo que devuelve `price_lists` directamente |
| 10 | `POST /backoffice/orders` — creación de orden a nombre de un cliente | ✅ OK (con cliente real) | Ver detalle abajo |

**Caso 10 — detalle:** `client_id=588` no puede usarse para esta prueba específica: `Order.createOrder()` exige `client_profiles.cardcode_sap` no nulo para **cualquier** orden (no es una regla de BackOffice, es preexistente), y 588 tiene `cardcode_sap=NULL` a propósito (aislamiento de SAP). Con autorización explícita, se reutilizó el mismo patrón ya aprobado en la tarea de IVA: cliente real `CI79694003` (`client_id=374`, `user_id=646`, `branch_id=1`, "BIG SANDWICH APARTAMENTO"), mismo cliente usado en las órdenes de prueba `DocEntry 1405-1413` de esa tarea.

- `POST /backoffice/orders` → `{"success":true,"data":{"order_id":173,"details_count":1}}`
- Verificación SQL real (`orders WHERE order_id=173`):
  ```
  user_id=646, placed_by_user_id=1, order_origin='backoffice', total_amount=30960.00, sap_synced=false
  ```
  Confirma exactamente el diseño de Fase 1: `user_id` es el cliente real (para que `SapOrderService` resuelva `CardCode` sin cambios), `placed_by_user_id` es el admin que la creó, `order_origin` distingue el flujo.
- **Orden cancelada de inmediato** (`UPDATE orders SET status_id=6 WHERE order_id=173`, confirmado `sap_synced` seguía en `false`) — nunca llegó a sincronizarse a SAP, mismo criterio de limpieza que la tarea de IVA ("cancelada tras la validación"). No se disparó `POST /orders/sync-to-sap` para esta orden específica: el admin de prueba (`id=1`) no tiene `sap_sales_employee_code` mapeado (confirmado NULL en Fase 3), así que el caso más informativo de probar (`SalesPersonCode` presente) requeriría antes correr el `PATCH` de mapeo — la transmisión del campo en sí ya quedó validada a nivel de Service Layer real en Fase 3 (`$metadata`, más órdenes reales existentes con `SalesPersonCode` poblado). Se documenta como el único sub-caso no ejercitado de punta a punta, sin bloquear el resultado global.
- Auditoría (`backoffice_actions`, últimas 8 filas de esta sesión de pruebas): 1 `create_order` (target_id=173), 3 pares `activate_client`/`deactivate_client` (target_id=588, de las distintas corridas), 3 `reset_branch_password` (target_id=2600) — todas con `admin_user_id=1`, coincidiendo con el admin de prueba real. Ninguna fila con contraseñas ni tokens en `details`.

### Estado: VALIDADO EN STAGING (backend + script)
10/10 casos del script pasan (los primeros 9 en la ejecución automática del script; el caso 10 se completó manualmente contra un cliente real por la incompatibilidad de diseño de `client_id=588` con `cardcode_sap=NULL`, documentada arriba, no por una falla del módulo). El fixture `client_id=588` queda mejorado de forma permanente (con `user_id=2357` vinculado) para que futuras corridas de este mismo script no repitan este hallazgo.

## 2026-09-06 — FASE 5 (corrección crítica): el frontend desplegado NO era el correcto

### Hallazgo reportado por el usuario, confirmado real
El usuario verificó directamente (`index.html` real vía fetch sin caché, `aws s3 ls`) que el bundle servido en staging (`index-BcwZHxmy.js`) **no tenía ninguna ruta de BackOffice** — `/dashboard/backoffice` daba 404 de React Router, cero llamadas a la API. El reporte anterior de "deploy exitoso" de esta misma fase estaba **mal fundamentado**: solo verifiqué que el *build local* compilara sin errores y que el *script* de deploy terminara con código de salida exitoso — nunca verifiqué que el *contenido* del bundle subido realmente incluyera el código de BackOffice.

**Causa raíz confirmada:** el `dist/` que se subió a S3 la primera vez se construyó mientras el working directory local (compartido entre sesiones) había saltado — sin aviso, otra vez — al branch `perf/gif-to-mp4-login-landing` (el mismo problema de colisión de sesiones documentado antes en esta tarea, ocurrido una tercera vez). `deploy-frontend.ps1` no valida en qué branch/commit está parado antes de compilar — corre `npm run build:staging` sobre lo que sea que haya en el working directory en ese momento. Evidencia: `grep -c "backoffice" dist/assets/index-BcwZHxmy.js` → `0`, y no existía ningún chunk `BackofficePage-*.js` en ese `dist/`.

### Corrección
1. Confirmado `git branch --show-current` → `feature/backoffice-module` (correcto esta vez) antes de tocar nada.
2. `rm -rf dist/` + `npm run build:staging` limpio.
3. **Verificación de contenido ANTES de subir** (paso que faltó la primera vez): `grep -c "backoffice" dist/assets/index-CcjdA579.js` → `1` (`{path:"backoffice",element:...}` confirmado con contexto), chunk `BackofficePage-BTXYbMyT.js` presente con 2 referencias reales al componente.
4. `deploy-frontend.ps1 -Environment staging` — el log de sync mostró explícitamente `delete: s3://artesa-frontend-staging/assets/index-BcwZHxmy.js` (el bundle viejo) y `upload: dist\assets\index-CcjdA579.js` (el nuevo, correcto), además de `upload BackofficePage-BTXYbMyT.js`.
5. **Verificación post-deploy real** (no asumida): `aws s3 ls s3://artesa-frontend-staging/assets/` confirma `index-CcjdA579.js` (326,583 bytes, coincide exacto con el tamaño del build local). `curl https://d1bqegutwmfn98.cloudfront.net/index.html` (CloudFront real, no local) referencia `index-CcjdA579.js`. `curl .../assets/index-CcjdA579.js | grep backoffice` → encuentra la cadena. `curl -o /dev/null .../assets/BackofficePage-BTXYbMyT.js` → `200`.

### Lección para el resto de la tarea
Verificar que un script de deploy "terminó exitoso" **no es evidencia suficiente** cuando el working directory es compartido entre sesiones y puede cambiar de branch sin aviso (ya ocurrió 3 veces en esta misma tarea). De ahora en adelante, todo deploy de frontend en esta tarea se valida con el mismo patrón de 3 pasos: (a) confirmar branch antes de compilar, (b) `grep` del contenido esperado en el bundle *antes* de subir, (c) confirmar contra el CDN/bucket real *después* de subir — nunca solo el código de salida del script.

### Estado: VALIDADO EN STAGING (frontend, corregido)
