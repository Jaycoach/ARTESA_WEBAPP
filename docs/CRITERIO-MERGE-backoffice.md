# Criterio de Merge — Módulo BackOffice a producción

## Estado actual (actualizado 2026-09-06)

Módulo completo (Fases 1-5 + mejoras de UX post-QA) implementado en `feature/backoffice-module`, **totalmente validado en staging**: migraciones de BD aplicadas, backend y frontend desplegados con la disciplina de 3 capas (branch → contenido del bundle → CDN/backend real) en cada iteración, script de aceptación ejecutado (10/10), y QA de navegador real hecho por el usuario (carrito, desglose de impuestos, toast, resumen de OV, pedidos del día, buscador de productos — todo confirmado funcionando). **Nunca desplegado a producción.** Esperando autorización de gerencia — mientras tanto, el branch queda solo documentado, sin más cambios activos.

Commits (en orden, `master..feature/backoffice-module`, 20 en total):

| Commit | Fase | Descripción |
|---|---|---|
| `39f0c43` | 0 | Investigación (roles, clientes, SAP, reset password) |
| `d2d042f` | 1 | Rol BACKOFFICE, columnas de trazabilidad en `orders`, tabla `backoffice_actions` |
| `dc2b3d6` | 2 | Endpoints BackOffice + corrección de `roles.js`/`auth.js` |
| `d6dde52` | 3 | `SalesPersonCode` a SAP (`SlpCode` no existe en este Service Layer) |
| `385f5ed` | 3 | Aclaración: `sap_sales_employee_code` sin poblar hoy |
| `525fe13` | 4 | Frontend del módulo BackOffice |
| `cbde2fc` | 5 | Script de aceptación (diseño, no ejecutado todavía) |
| `2e4f0f5` | — | Primera versión de este documento de criterio de merge |
| `7003332` | 5 | Deploy a staging + script de aceptación ejecutado (10/10) |
| `e0eca32` | 5 | Redeploy correcto del frontend (el deploy anterior se hizo en el branch equivocado por colisión de sesiones) |
| `1c42696` | 5 | Colisión confirmada en bucket S3 compartido — deploy de frontend pausado |
| `5bcd244` | 5 | **Merge de `master` ya traído a este branch** (incluye `perf/gif-to-mp4-login-landing`, `8803c25`) |
| `3804d45` | 5 | Cierre de la colisión de bucket, redeploy conjunto con 3 capas |
| `870e100` | 5 | Fix: desglose de impuestos y toast de confirmación en el carrito |
| `9ab69c9` | 5 | Feature: resumen de OV creadas + pestaña "Pedidos del día" (faceted search) |
| `26991ad` | 5 | Cierre de ronda de QA (pendientes ya resueltos, password de prueba) |
| `d8e7f06` | 5 | Cierre de QA de navegador — desglose confirmado, limitación de sesión (localStorage) documentada |
| `f0d1a18` | 5 | Feature: buscador tipo autocompletar para el catálogo (reemplaza tabla de ~500 productos) |
| `0f9b999` | 5 | Documentación del buscador de productos |
| `a3cd84c` | 5 | Buscador de productos confirmado en navegador real por el usuario |

**Importante para quien retome esto:** el merge de `master` (paso 1 de más abajo) **ya se hizo una vez**, en `5bcd244` — en ese momento `master` solo tenía el fix de GIFs. Antes de mergear a producción, hay que repetir el paso 1 igual, porque `master` puede haber avanzado más desde entonces (ej. la unificación de IVA sigue activa como línea de trabajo separada, ver `docs/CHANGELOG-unificacion-iva.md`).

## Cuando llegue la autorización, los pasos son

1. Confirmar que `feature/backoffice-module` está actualizado contra el `master` **del momento de la autorización** (no asumir que el merge de `5bcd244` sigue siendo suficiente — puede haber más commits nuevos en `master` desde entonces). Usar `git merge origin/master` normalmente; si falla con `error: cannot stat '...': Invalid argument` en un entorno Windows+OneDrive, ese es un problema mecánico ya documentado (ver `docs/CHANGELOG-backoffice.md`, sección "Merge de master + redeploy conjunto") — la solución ahí fue aplicar los archivos exclusivos del otro lado con `git checkout <rama> -- <path>` y construir el commit de merge a mano con `git write-tree`/`git commit-tree`/`git update-ref`, **solo si se confirma primero que no hay conflicto real de contenido** (`git diff --name-status` entre ambas ramas).
2. Re-ejecutar `scripts/tests/backoffice-acceptance.sh` completo contra staging **después** de ese merge, no asumir que sigue válido solo porque pasó antes.
3. Merge a `master` (squash o merge commit, a decidir por el usuario — no es una decisión que deba tomar unilateralmente).
4. Deploy a producción con el procedimiento estándar del proyecto: `deploy-production.sh` (backend) + `src/views/frontend/LoginArtesa/deploy-frontend.ps1 -Environment production` (frontend). Requiere aprobación explícita de Jonathan para tocar EC2 Producción — no se ejecuta solo porque el merge a `master` ya ocurrió.
5. Verificación post-deploy (checklist mínimo):
   - Login real como usuario con rol BACKOFFICE (o ADMIN) contra producción.
   - Listado de clientes/sucursales reales visible sin errores.
   - Creación de **una** orden de prueba a nombre de un cliente sintético (nunca un cliente real de producción — si no existe ya un fixture sintético equivalente a `client_id=588` en la base de producción, crear uno antes de esta prueba, con aprobación explícita).
   - Confirmar en SAP (Service Layer de producción, no staging) que la orden llegó con `SalesPersonCode` correcto si el admin de prueba tiene mapeo, o ausente si no lo tiene — nunca asumir `-1` por defecto.
   - Confirmar que la fila correspondiente quedó en `backoffice_actions` de producción.

## Pendientes conocidos antes de ese merge (no bloquean staging, sí producción)

- **`users.sap_sales_employee_code`**: se puebla exclusivamente de forma **manual**, vía `PATCH /backoffice/users/:userId/sap-sales-employee-code` — no hay sincronización automática desde SAP (confirmado en Fase 3, ver `docs/CHANGELOG-backoffice.md`). Al momento de escribir este documento, **ningún usuario tiene el mapeo configurado** en staging (los 3 admins/functional_admin existentes — ids 1, 538, 1144 — tienen la columna en `NULL`, y todavía no existe ningún usuario con rol BACKOFFICE creado). Antes de operar el módulo en producción, alguien debe correr ese `PATCH` para cada admin real que vaya a crear órdenes, o las órdenes viajarán a SAP sin vendedor asignado (comportamiento válido por diseño, pero probablemente no deseado operacionalmente).
- **Visibilidad de `client_id=588` en `ClientList.jsx`**: **ya cerrado**, no es un pendiente real. El changelog de la tarea de unificación de IVA (`docs/CHANGELOG-unificacion-iva.md`, sección "QA de navegador con branch sintético") documenta explícitamente que se revisó `ClientList.jsx` y se confirmó que `QA_TEST_CLIENTE_NO_USAR` es inconfundible con un cliente real — "sin cambios necesarios". Se incluye esta aclaración aquí solo para que quede registrado que se verificó antes de escribir este documento, no como acción pendiente.
- **`checkRole([1,4])` en cada endpoint de BackOffice**: debe reconfirmarse explícitamente después del merge del paso 1 — si `master` recibió cambios al sistema de autorización (`src/middleware/auth.js`, `src/constants/roles.js`) mientras este branch esperaba aprobación, hay que verificar que el rol `4` (BACKOFFICE) siga resolviendo correctamente y que ningún endpoint nuevo de BackOffice haya quedado con un array de roles desactualizado tras el merge de esos cambios.
- **Limitación conocida, no bloqueante — sesión compartida por `localStorage`**: un admin no puede tener sesión de BackOffice y sesión de la sucursal/cliente que gestiona abiertas en pestañas separadas del mismo navegador sin que se pisen (comportamiento normal de `localStorage`, no específico de BackOffice — ver `docs/CHANGELOG-backoffice.md`, cierre de QA de navegador). No se resuelve en esta tarea; queda para quien priorice trabajo futuro evaluar si se justifica mover a `sessionStorage` para este caso de uso.

## Riesgo de branch envejecido

Mientras más tiempo pase esperando aprobación, más diverge de `master`. **Criterio: si pasan más de 30 días naturales sin autorización** (contados desde `a3cd84c`, el último commit de este branch al momento de escribir esta actualización — 2026-09-06), no asumir que el análisis de Fases 1-5 sigue vigente — re-validar desde cero antes de proceder al paso 1 de este documento:
- Re-confirmar contra el Service Layer real de staging que `SalesPersonCode` sigue siendo el nombre de campo correcto (SAP podría actualizarse).
- Re-confirmar que los roles `ADMIN=1`/`USER=2`/`FUNCTIONAL_ADMIN=3`/`BACKOFFICE=4` siguen siendo esos IDs exactos en la tabla `roles` de staging (no asumir que nadie los tocó).
- Re-leer `Order.js`/`SapOrderService.js`/`taxCalculator.js` tal como están en staging en ese momento (no confiar en lo documentado en Fases 0-3 de este mismo changelog, que refleja el estado en 2026-09-05/06) — podrían haber cambiado por trabajo de otras tareas (ej. la unificación de IVA sigue activa como línea de trabajo separada).
