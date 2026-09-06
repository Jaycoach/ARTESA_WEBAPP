# Criterio de Merge — Módulo BackOffice a producción

## Estado actual

Módulo completo (Fases 1-5) implementado en `feature/backoffice-module`, **validado parcialmente en staging (Fase 1 y el DDL de Fase 3, vía migraciones de BD) pero con el código de Fases 2-4 aún sin desplegar** al momento de escribir este documento — el host de EC2 Staging estaba ocupado con cambios sin commitear de otra sesión. Nunca desplegado a producción. Esperando autorización de gerencia.

Commits (en orden, `master..feature/backoffice-module`):

| Commit | Fase | Descripción |
|---|---|---|
| `39f0c43` | 0 | Investigación (roles, clientes, SAP, reset password) |
| `d2d042f` | 1 | Rol BACKOFFICE, columnas de trazabilidad en `orders`, tabla `backoffice_actions` |
| `dc2b3d6` | 2 | Endpoints BackOffice + corrección de `roles.js`/`auth.js` |
| `d6dde52` | 3 | `SalesPersonCode` a SAP (`SlpCode` no existe en este Service Layer) |
| `385f5ed` | 3 | Aclaración: `sap_sales_employee_code` sin poblar hoy |
| `525fe13` | 4 | Frontend del módulo BackOffice |
| `cbde2fc` | 5 | Script de aceptación (no ejecutado) |

## Cuando llegue la autorización, los pasos son

1. Confirmar que `feature/backoffice-module` está actualizado contra `master` (rebase o merge de `master` hacia la feature branch primero, para traer cualquier fix que haya llegado a producción mientras tanto — ej. el fix de GIFs (`perf/gif-to-mp4-login-landing`, aún no mergeado a `master` al momento de escribir esto), vulnerabilidades de `npm audit`, etc.). **Nota de este branch:** ya hubo un incidente en el que un commit ajeno (ese mismo fix de GIFs) quedó pegado encima de la Fase 4 por error de otra sesión — se detectó y se corrigió con `git reset --hard` antes de este documento (ver `docs/CHANGELOG-backoffice.md`, Fase 5). Verificar con `git log --oneline master..feature/backoffice-module` que solo aparecen los 7 commits de la tabla de arriba antes de continuar.
2. Re-ejecutar `scripts/tests/backoffice-acceptance.sh` completo contra staging **después** de ese rebase, no asumir que sigue válido solo porque pasó antes del rebase.
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
- **`checkRole([1,4])` en cada endpoint de BackOffice**: debe reconfirmarse explícitamente después del rebase del paso 1 — si `master` recibió cambios al sistema de autorización (`src/middleware/auth.js`, `src/constants/roles.js`) mientras este branch esperaba aprobación, hay que verificar que el rol `4` (BACKOFFICE) siga resolviendo correctamente y que ningún endpoint nuevo de BackOffice haya quedado con un array de roles desactualizado tras el merge de esos cambios.

## Riesgo de branch envejecido

Mientras más tiempo pase esperando aprobación, más diverge de `master`. **Criterio: si pasan más de 30 días naturales sin autorización** (contados desde `cbde2fc`, el último commit de este branch), no asumir que el análisis de Fases 1-4 sigue vigente — re-validar desde cero antes de proceder al paso 1 de este documento:
- Re-confirmar contra el Service Layer real de staging que `SalesPersonCode` sigue siendo el nombre de campo correcto (SAP podría actualizarse).
- Re-confirmar que los roles `ADMIN=1`/`USER=2`/`FUNCTIONAL_ADMIN=3`/`BACKOFFICE=4` siguen siendo esos IDs exactos en la tabla `roles` de staging (no asumir que nadie los tocó).
- Re-leer `Order.js`/`SapOrderService.js`/`taxCalculator.js` tal como están en staging en ese momento (no confiar en lo documentado en Fases 0-3 de este mismo changelog, que refleja el estado en 2026-09-05/06) — podrían haber cambiado por trabajo de otras tareas (ej. la unificación de IVA sigue activa como línea de trabajo separada).
