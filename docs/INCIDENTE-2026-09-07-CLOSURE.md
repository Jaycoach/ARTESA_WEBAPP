# Cierre de Incidente: Órdenes Bloqueadas (2026-09-07)

## Resumen Ejecutivo

Toda creación de orden en producción (`POST /api/orders`) fallaba con `500` desde las 13:05 hora local Colombia (18:05 UTC) del 2026-09-07. Causa: una migración de base de datos estaba escrita y aplicada en staging, pero nunca se corrió en producción. Impacto: 100% de los usuarios sin poder crear órdenes, sin importar si eran clientes nuevos o existentes con historial previo.

## Cronología (confirmada con logs y queries reales, no inferida)

| Hora (UTC) | Evento |
|---|---|
| 2026-09-07 18:05:54 | Primer `POST /api/orders 500` en logs de producción (`user_id: 941`, usuario con historial previo) |
| 2026-09-07 18:06:10 – 18:11:55 – 18:12:08 | Más fallos repetidos, incluye `user_id: 50` (Manuel Osorio, el usuario que reportó el problema) — mismo error exacto |
| 2026-09-07 18:59:49 | Último fallo confirmado en la ventana de logs revisada |
| 2026-09-08 (hora reportada por Jonathan) | Migraciones ejecutadas contra producción: `2026-09-04_create-tax-codes-tables.sql`, `2026-09-05_add-tax-codes-valid-for-ar.sql`, `2026-09-05_add-tax-snapshot-columns.sql` |
| 2026-09-08 (esta sesión) | Verificado por Claude Code con query directa a producción: `orders.iva_amount`, `orders.impuesto_saludable_amount`, `order_details.tax_code_ar/iva_amount/impuesto_saludable_amount/tax_amount`, y tablas `tax_codes`/`tax_code_components` — **todas existen ahora en el esquema real de producción** |

Tiempo entre el primer error confirmado en logs (18:05 UTC del 07-09) y la remediación reportada (madrugada del 08-09): **del orden de 8-9 horas**, no ~30h como se estimó en un borrador anterior de este documento — se corrige aquí para no dejar una cifra sin verificar.

## Causa Raíz

- `src/models/Order.js:191` (INSERT de `orders`) asume las columnas `iva_amount` e `impuesto_saludable_amount`, agregadas por el commit `c36b282` ("feat: unificar el cálculo de IVA...") junto con `db/migrations/2026-09-05_add-tax-snapshot-columns.sql`.
- La migración se aplicó en staging pero **no en producción** — no había ningún mecanismo (tabla de control, CI/CD gate) que lo hubiera detectado antes del deploy del código que ya asumía esas columnas.
- No es un defecto de lógica de negocio ni de validaciones de usuario: se descartó explícitamente durante el diagnóstico que fuera un problema de perfil de cliente, sucursal, activación de usuario, o restricción horaria — todas esas validaciones pasaban correctamente para los usuarios afectados.

## Remediación

1. **Ejecutada por Jonathan** (fuera del alcance de Claude Code, que no tiene ni tendrá autorización para correr cambios de esquema contra producción sin aprobación explícita por tarea, según el DoD del proyecto): las 3 migraciones pendientes.
2. **Verificado por Claude Code** con query de solo lectura contra producción: las columnas y tablas nuevas existen ahora en el esquema real — evidencia pegada arriba.
3. **No verificado por Claude Code**: que un `POST /api/orders` real, de punta a punta, complete exitosamente después de la migración. No se corrió ningún request de prueba contra producción como parte de este cierre — recomendado como último paso antes de dar el incidente por cerrado del todo.

## Cambios de código aplicados en este repo (rama `feature/backoffice-module`)

- `src/models/Order.js` (catch block, antes líneas 262-269): distingue `error.code` de PostgreSQL (`42703` columna faltante → 503, `23503` FK → 400, `23505` duplicado → 409) en vez de tratar todo error como un 500 genérico.
- `src/controllers/orderController.js` (catch block, antes líneas 407-419): propaga `statusCode`/`userMessage` específicos al cliente en vez del mensaje fijo `"Error al crear la orden"`.
- `docs/MIGRATION_STRATEGY.md`, `db/scripts/init-migrations-table.sql`, `scripts/verify-migrations.sh`, `db/migrations/001_initial-schema.md`: tooling y documentación nueva para prevenir que este tipo de desincronización pase inadvertida en el futuro.
- `src/.claude/skills/la-artesa-dod/SKILL.md`: nueva sección con checklist de migraciones y referencia a los códigos SQLSTATE relevantes (queda solo local, excluido de git por convención existente del proyecto).
- `scripts/tests/order-error-handling-acceptance.js`: script de aceptación real, corrido contra `EC2 Staging` (`ec2-44-216-131-63.compute-1.amazonaws.com`) y su BD real (`artesadb_dev`, confirmada como ambiente separado de producción — ver nota de corrección abajo).

## Validación en staging — primer intento (2026-09-08, código aún no deployado)

Se ejecutó `scripts/tests/order-error-handling-acceptance.js` contra staging real, no local. Resultado:

| Escenario | Resultado | Detalle |
|---|---|---|
| 503 columna faltante (`42703`) | **FALLA** | Devolvió `500` genérico ("Error al crear la orden"), no `503`. **Causa: el código nuevo del catch block nunca se desplegó al servidor de staging** — el fix vivía en el repo local/commits, pero el contenedor `artesa-api-staging` seguía corriendo el catch genérico anterior. No era un bug de la lógica nueva; era que aún no estaba deployada. |
| 400 branch inválida (`23503`) | Pasa (400), pero no prueba la rama nueva | El 400 lo produce la validación de `orderController.js` (ownership de sucursal) **antes** de llegar al `INSERT` de `Order.js` — la rama `error.code === '23503'` del catch nuevo queda sin ejercitar por la API pública, porque el propio app-level ya previene esa condición. |
| 409 duplicado (`23505`) | No aplica | Verificado con `pg_constraint` contra `artesadb_dev`: **no existe ningún `UNIQUE` constraint en `orders`**. Postgres nunca puede devolver `23505` desde este `INSERT` tal como está la tabla hoy. |
| Payload inválido | Pasa (400) | Rechazado por validación temprana del controller, no llega a `Order.js`. |

**Corrección sobre un hallazgo anterior de esta sesión:** en un mensaje previo afirmé que staging y producción comparten la misma base de datos — eso era incorrecto, basado en un `.env.staging` local desactualizado (`DB_DATABASE=laartesa`, igual al de producción). Se confirmó con el equipo que el contenedor real de staging usa `DB_DATABASE=artesadb_dev`, una base separada. El archivo `.env.staging` de este repo ya fue corregido.

## Cleanup de código muerto (commit `ac9bef2`/`5247c71`)

Con la evidencia de la tabla anterior (23503 y 23505 inalcanzables por la API pública), se removieron esas dos ramas del catch de `Order.js`, dejando solo `42703` (el caso real del incidente) y un fallback genérico para cualquier otro error. Ver diff en el commit.

## Rama separada para no arrastrar BackOffice sin aprobar

Los commits de este fix vivían inicialmente sobre `feature/backoffice-module`, que tiene ~30 commits del módulo BackOffice **no aprobados aún para producción**. Para no forzar ese merge junto con un fix urgente y no relacionado, se cherry-pickearon los 4 commits a una rama nueva `fix/order-error-handling`, basada en `origin/master` limpio, y se pusheó solo esa rama: https://github.com/Jaycoach/ARTESA_WEBAPP/pull/new/fix/order-error-handling

## Validación en staging — segundo intento, con deploy real (2026-09-08)

Deploy ejecutado por Jonathan en el EC2 de staging:
```bash
git checkout fix/order-error-handling && git pull origin fix/order-error-handling
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d --build
```
(Nota de proceso: el primer intento de deploy falló dos veces por sintaxis — `docker compose` con espacio no es lo que corre en este servidor, y no existe `docker-compose.yml` base en el repo, solo `docker-compose.staging.yml`/`docker-compose.production.yml` autosuficientes. Corregido para el segundo intento, build de 113.7s, contenedor `Healthy`.)

Con el código realmente deployado, se corrió de nuevo `scripts/tests/order-error-handling-acceptance.js`:

| Escenario | Resultado |
|---|---|
| 503 columna faltante (`42703`) | **PASS** — status 503, mensaje "El sistema está en mantenimiento. Por favor intenta en unos momentos." |
| 400 branch inválida | PASS (sin cambios respecto al primer intento) |
| 409 duplicado | Sigue sin aplicar (sin constraint) |
| Payload inválido | PASS (sin cambios) |

Verificado después de correr el test: `iva_amount` quedó restaurada en `artesadb_dev`, y `SELECT count(*) FROM orders WHERE created_at > NOW() - interval '10 minutes'` devolvió `0` — ningún dato de prueba quedó huérfano.

**Estado real según el DoD del proyecto: VALIDADO EN STAGING.** El escenario que causó el incidente original (503 por columna faltante) está confirmado funcionando de punta a punta contra el servidor real de staging, con el código realmente deployado — no por lectura de código ni inferencia.

## Próximos Pasos (P1/P2)

1. **Aprobación explícita de Jonathan** para mergear `fix/order-error-handling` a `master` y desplegar a producción — Claude Code no se autoriza este paso.
2. Confirmar contra el esquema real de producción si `2026-09-05_create-backoffice-module.sql` y `2026-09-06_add-sap-sales-employee-code.sql` están aplicadas — quedó reportado como "no aplicable" pero sin verificación directa de Claude Code (ver `db/migrations/001_initial-schema.md`).
3. Evaluar `node-pg-migrate` o Knex para tracking automático de migraciones (detalle en `docs/MIGRATION_STRATEGY.md`).
4. Agregar gate de CI/CD que bloquee un deploy si hay migraciones sin aplicar en el ambiente destino.
5. Revisar el archivo `ssl/nginx.crt` con cambios locales sin commitear detectado en el servidor de staging durante el `git checkout` de este trabajo — no bloqueó nada, pero vale confirmar que no sea un cambio en curso perdido.
