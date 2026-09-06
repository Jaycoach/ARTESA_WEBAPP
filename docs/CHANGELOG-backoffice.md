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
