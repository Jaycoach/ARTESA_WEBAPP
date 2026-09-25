# Plan de despliegue a Producción — BackOffice Core

Este documento es el plan de ejecución para llevar `feature/backoffice-core` a Producción.
Es un **plan**, no una ejecución: cada comando de aquí lo corre Jonathan; Claude Code no
despliega a Staging ni a Producción, no accede a la base de datos, y no imprime credenciales.

Referencia completa de decisiones, evidencia y estado de cada pieza: `docs/CHANGELOG-backoffice-core.md`.

## 0. Estado de partida (actualizado 2026-09-25, tras el ciclo completo de validación en Staging)

- Rama: `feature/backoffice-core`, basada en `master`, sin conflictos reales detectados contra
  `fix/price-list-sync-unification` ni contra `feature/backoffice-module` (ver CHANGELOG, sección
  de cada fase).
- **Todas las piezas del núcleo están VALIDADO EN STAGING** — desplegado realmente, probado
  con datos reales (SAP incluido), y con QA visual manual de Jonathan en el navegador. Ver la
  tabla de DoD completa y toda la evidencia en `docs/CHANGELOG-backoffice-core.md` (sección
  "Cierre").
- Durante el ciclo de validación se encontraron y corrigieron 2 hallazgos que requerían
  código nuevo, no previstos en el plan original: doble-escape de `sanitizeBody` en 3 flujos
  de sucursales, y 2 bugs bloqueantes en `enableBranchLogin` (`pool` no definido, `bcrypt`
  nativo no instalado) — todos corregidos y verificados con evidencia real. También se
  encontró y corrigió el timeout de nginx (`proxy_read_timeout`/`proxy_send_timeout`,
  ver Paso 5b abajo).
- Quedan **hallazgos documentados como deuda técnica, sin corregir** (ver CHANGELOG, sección
  "Deuda técnica documentada") — ninguno bloquea el despliegue, todos preexistentes o de UX menor.
- **No se ha creado Pull Request hacia `master` todavía** — es un punto de parada explícito,
  pendiente de la aprobación de Jonathan.

## 1. REGLA CRÍTICA — orden obligatorio de migración → código

Las guardas D5 (`authController.js verifyEmail`, `clientSyncController.js activateClient` y
`simulateSapSync`) y las de Fase 3 (`SapClientService.js`, 2 guardas) consultan
`users.deactivated_manually`. Esa columna **no existe en Producción** hasta aplicar
`db/migrations/2026-09-23_backoffice-core.sql`.

> **La migración del núcleo DEBE aplicarse en Producción ANTES de desplegar este código.**
> Si el código llega primero, cualquier `UPDATE ... WHERE ... AND deactivated_manually = false`
> falla con `42703` (`undefined_column`) — rompe en vivo: verificación de correo, activación
> manual de clientes, simulación de sync, y los 2 crons de sincronización SAP. Este es
> exactamente el patrón del incidente cerrado en `docs/INCIDENTE-2026-09-07-CLOSURE.md`
> (migración de Staging no aplicada a tiempo en Producción) — no se debe repetir.

La migración D12 (`db/migrations/2026-09-24_mail-case-insensitive.sql`) no tiene esta misma
urgencia (los índices únicos por `LOWER()` no son consultados por ninguna guarda D5), pero
**si se aplica el código D12 sin el índice, el único riesgo es perder la protección adicional
contra condiciones de carrera** — la unicidad seguiría chequeada en aplicación. Se recomienda
aplicarla en el mismo lote de migraciones por simplicidad, no por urgencia técnica.

## 2. Orden de ejecución completo

### Paso 1 — Congelar y respaldar (Jonathan)

```bash
# Tag de rollback, sobre el commit de producción actualmente desplegado (no sobre esta rama).
git tag -a pre-backoffice-core-$(date +%Y%m%d) -m "Antes de desplegar backoffice-core"
git push origin pre-backoffice-core-$(date +%Y%m%d)
```

Confirmar con `pg_dump` o el mecanismo de snapshot que ya use el equipo para la base de
Producción antes de tocarla — este plan no incluye ese paso porque no es específico de este
núcleo, pero es la práctica que ya exige el DoD del proyecto para cualquier migración.

### Paso 2 — Migración del núcleo

```bash
# Núcleo (roles 3/4, backoffice_actions, columnas de inactivación manual). Idempotente.
psql <conexion_produccion> -f db/migrations/2026-09-23_backoffice-core.sql
```

### Paso 2b — Verificar duplicados por mayúsculas (solo lectura, precondición de D12)

```bash
psql <conexion_produccion> -c "
  SELECT LOWER(mail), COUNT(*) FROM users GROUP BY LOWER(mail) HAVING COUNT(*) > 1;
"
```
Si aparece alguna fila (el caso ya conocido: ids 48/1505, ALIANZA JIMENEZ SAS), **ir al
Paso 3 (fusión D13) antes de continuar** — la migración D12 (Paso 2c) fallará si se intenta
aplicar el índice único mientras el duplicado sigue existiendo (confirmado con el mismo error
real durante la prueba sintética de D13 en Staging: `could not create unique index... Key
(...) is duplicated`). Si la consulta da 0 filas, saltar directo al Paso 2c.

### Paso 3 — D13, fusión de duplicados conocidos (solo si el Paso 2b encontró filas)

```bash
# Modo ensayo primero (siempre hace ROLLBACK, no toca nada real):
sed 's/^COMMIT;$/ROLLBACK;/' db/scripts/merge-duplicate-users.sql | \
  psql <conexion_produccion> -v canonical_id=48 -v absorbed_id=1505 -v admin_id=<id_admin_real>

# Revisar los RAISE NOTICE / SELECT de verificación impresos. Si se ve bien:
psql <conexion_produccion> -f db/scripts/merge-duplicate-users.sql \
  -v canonical_id=48 -v absorbed_id=1505 -v admin_id=<id_admin_real>
```

`admin_id` debe ser el id de un usuario ADMIN real en Producción (para el registro de
auditoría en `backoffice_actions`) — nunca un id inventado.

**Volver a correr la verificación del Paso 2b — debe dar 0 filas ahora.** Solo entonces
continuar al Paso 2c.

### Paso 2c — Migración D12 (índices únicos por `LOWER()`)

```bash
# Precondición: 0 duplicados por LOWER() en users y client_branches (Paso 2b en 0 filas).
psql <conexion_produccion> -f db/migrations/2026-09-24_mail-case-insensitive.sql
```

### Paso 4 — Verificación de solo lectura post-migración

```bash
psql <conexion_produccion> -f scripts/tests/qa-backoffice-core-readonly.sql
```

Todos los casos marcados "esperado: 0 filas" deben dar 0. Si alguno no, **no continuar al
paso 5** — investigar antes de desplegar código.

### Paso 5 — Backend (Docker/EC2)

```bash
git checkout master
git pull
git merge feature/backoffice-core   # solo después del PASO 6 (PR aprobado y mergeado)
./deploy-production.sh
```

`deploy-production.sh` ya hace rebuild, reinicia contenedores (`artesa-api-production`,
`artesa-nginx-production`) y espera a que `https://api.artesapanaderia.com/api/health`
responda antes de darse por exitoso. Elegir la opción de rebuild acorde a lo que cambió
(este núcleo no toca `package.json` del backend, así que "Parcial" alcanza salvo que se
combine con otro cambio pendiente que sí lo requiera).

### Paso 5b — nginx: subir `proxy_read_timeout`/`proxy_send_timeout` en `/api/` (obligatorio)

**Encontrado durante el ciclo de validación en Staging (2026-09-25):** las sincronizaciones
manuales del BackOffice (`/api/backoffice/sync/clients/all`, `/sync/branches`) tardan varios
minutos en completar (SAP responde secuencialmente, una llamada por cliente/sucursal — 2m21s
observados en Staging con 322 clientes/131 sucursales). `docker/nginx/production-ssl.conf`
tiene, igual que Staging antes del fix, `proxy_read_timeout 60s;`/`proxy_send_timeout 60s;`
**explícitos** en el único bloque `location /api/` del archivo (`production-ssl.conf:149-151`).
**Producción probablemente sincroniza más clientes/sucursales que Staging** (322/131 son solo
los de prueba), así que el mismo corte a los 60s ocurrirá ahí también, con el mismo síntoma:
la UI reporta un falso error de comunicación mientras el backend sigue trabajando y termina
bien — confirmado que esto no pierde datos, pero si sale confuso para quien lo use.

Ya se aplicó el equivalente en Staging (`docker/nginx/staging-ssl.conf`, commit `bb7dffb`):
`proxy_send_timeout`/`proxy_read_timeout` de `60s` a `260s` (margen sobre los 240s ya
configurados en el timeout de axios del frontend, commit `9bddc7e`). `proxy_connect_timeout`
se dejó sin tocar (es para establecer la conexión, no para esperar la respuesta).

**Aplicar en Producción, ANTES o junto con el Paso 5** (no depende del orden migración/código,
es puramente de infraestructura nginx):
```bash
# En docker/nginx/production-ssl.conf, dentro del único bloque location /api/ (línea ~149):
#   proxy_send_timeout 60s;   ->  proxy_send_timeout 260s;
#   proxy_read_timeout 60s;   ->  proxy_read_timeout 260s;
# (proxy_connect_timeout se deja en 60s)

docker exec artesa-nginx-production nginx -t
docker restart artesa-nginx-production
docker logs artesa-nginx-production --tail 20
curl -sk -o /dev/null -w '%{http_code}\n' https://api.artesapanaderia.com/api/health
```
Solo reinicia el contenedor de nginx, no el backend — no hay downtime del API mientras tanto.

### Paso 6 — Frontend

`.env.production` del frontend **no define `VITE_LEGACY_ADMIN_UI`** hoy, por lo que el build
de producción la tratará como `false` por defecto — es decir, **las pantallas legacy
"Clientes"/"Administración" quedarán ocultas del sidebar apenas se despliegue este frontend**,
y el nuevo "BackOffice" será el punto de entrada para roles 1/3/4. Esto es una decisión de UX
de bajo riesgo (nada se borra, las pantallas siguen existiendo y son accesibles por URL
directa, y se puede revertir agregando `VITE_LEGACY_ADMIN_UI=true` a `.env.production` y
re-desplegando) — pero es la clase de cambio visible para todo el equipo de Producción que
vale la pena confirmar con Jonathan antes del primer despliegue real:

- Si se quiere una transición gradual, agregar `VITE_LEGACY_ADMIN_UI=true` en
  `.env.production` para el primer despliegue, y quitarlo en uno posterior cuando el equipo
  ya esté usando la UI nueva.
- Si se quiere ir directo a la UI nueva, no hace falta ningún cambio en `.env.production`.

**Corrección (2026-09-25, confirmado durante el ciclo de validación en Staging):** el
mecanismo real de despliegue del frontend **no es** `npm run deploy:production` — ese script
de `package.json:19` apunta a `s3://tu-bucket-production`, un placeholder desactualizado.
El mecanismo real es `deploy-frontend.ps1` (en la raíz del frontend), que solo puede correr
en Windows (usa el perfil AWS local `artesa` y `C:\Program Files\Amazon\AWSCLIV2\aws.exe`).
Confirma el bucket real de Producción: **`artesa-frontend-production`**
(CloudFront `E2DQU9UCJBZKP5`, `https://app.artesapanaderia.com`).

```powershell
cd src/views/frontend/LoginArtesa
.\deploy-frontend.ps1 -Environment production
```

Este script ya hace `build:production` internamente, sincroniza a `s3://artesa-frontend-production`
e invalida la distribución CloudFront correspondiente — no hace falta ningún `npm run deploy:*`
ni ajuste manual de bucket.

### Paso 7 — QA funcional post-deploy

```bash
BASE_URL="https://api.artesapanaderia.com" \
ADMIN_TOKEN="..." FUNCTIONAL_ADMIN_TOKEN="..." USER_TOKEN="..." BRANCH_TOKEN="..." \
./scripts/tests/backoffice-core-regression.sh > docs/qa-evidencia/produccion-despues.txt

BASE_URL="https://api.artesapanaderia.com" \
ADMIN_TOKEN="..." FUNCTIONAL_ADMIN_TOKEN="..." \
./scripts/tests/qa-backoffice-core-cases.sh

psql <conexion_produccion> -f scripts/tests/qa-backoffice-core-readonly.sql
```

Comparar `produccion-despues.txt` contra una línea base tomada **antes** del despliegue
(mismo script, mismo comando, corrido antes del Paso 5) con
`scripts/tests/compare-regression-results.sh` — cualquier `[NO EXPLICADA]` bloquea el cierre
del despliegue hasta revisarlo.

## 3. Plan de rollback

- **Backend:** `git checkout <tag pre-backoffice-core-YYYYMMDD>` sobre el código desplegado,
  `./deploy-production.sh` de nuevo. La migración del núcleo es aditiva (nunca se hace
  `DROP`/`DELETE`) por lo que **no hace falta revertir la base de datos** para revertir el
  código — las columnas/tabla/roles nuevos simplemente quedan sin usar por el código anterior.
- **D12 (índices únicos):** si por algún motivo hay que revertir solo esto,
  `DROP INDEX CONCURRENTLY IF EXISTS uk_users_mail_lower;` y el equivalente para
  `client_branches` — documentado como reversible porque no se tocó ninguna columna ni fila,
  solo un índice.
- **D13 (fusión de cuentas):** el propio `db/scripts/merge-duplicate-users.sql` documenta al
  final el SQL inverso exacto (reactivar la cuenta absorbida, restaurar su correo original,
  revertir el registro de auditoría) — usarlo solo si la fusión ejecutada resultó ser
  incorrecta, nunca como procedimiento rutinario.
- **Frontend:** `aws s3 sync` de la versión anterior del `dist/` (si se conservó) o
  re-desplegar desde el commit anterior de `master` con `VITE_LEGACY_ADMIN_UI=true` si el
  objetivo es solo recuperar la visibilidad de las pantallas legacy sin revertir todo el build.

## 4. Puntos de decisión pendientes para Jonathan antes de ejecutar este plan

1. ~~Confirmar el bucket S3 real de Producción~~ — **RESUELTO**: es `artesa-frontend-production`,
   vía `deploy-frontend.ps1 -Environment production` (ver Paso 6). El `npm run deploy:production`
   de `package.json` sigue apuntando a un placeholder — no usarlo.
2. Decidir si el primer despliegue a Producción sale con `VITE_LEGACY_ADMIN_UI=true`
   (transición gradual) o sin ella (UI nueva de inmediato).
3. Confirmar el `admin_id` real a usar en la fusión D13 de Producción (Paso 3).
4. Ejecutar en Staging primero el ciclo completo (migraciones + código + QA) antes de tocar
   Producción — este documento asume que ese ciclo ya se corrió y quedó limpio; si no, seguir
   primero las instrucciones de Fase 2-R y Fase 5 del CHANGELOG contra Staging.

## 5. Qué queda fuera de este despliegue

- Clase B2 (CRUD de sucursales) y clase C (gestión de pedidos en nombre de clientes) —
  siguen pausadas en `feature/backoffice-module`, sin publicar, pendientes de aprobación de
  Gerencia. Este despliegue no las toca ni las habilita.
- Rol BACKOFFICE (4) queda sin capacidades activas en este núcleo — reservado para cuando se
  publique la clase C.
