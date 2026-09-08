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

## Validación en staging — resultado real (2026-09-08)

Se ejecutó `scripts/tests/order-error-handling-acceptance.js` contra staging real, no local. Resultado:

| Escenario | Resultado | Detalle |
|---|---|---|
| 503 columna faltante (`42703`) | **FALLA** | Devolvió `500` genérico ("Error al crear la orden"), no `503`. **Causa: el código nuevo del catch block nunca se desplegó al servidor de staging** — el fix vive en este repo local/commits, pero el contenedor `artesa-api-staging` sigue corriendo el catch genérico anterior. No es un bug de la lógica nueva; es que aún no está deployada. |
| 400 branch inválida (`23503`) | Pasa (400), pero no prueba la rama nueva | El 400 lo produce la validación de `orderController.js` (ownership de sucursal) **antes** de llegar al `INSERT` de `Order.js` — la rama `error.code === '23503'` del catch nuevo queda sin ejercitar por la API pública, porque el propio app-level ya previene esa condición. |
| 409 duplicado (`23505`) | No aplica | Verificado con `pg_constraint` contra `artesadb_dev`: **no existe ningún `UNIQUE` constraint en `orders`**. Postgres nunca puede devolver `23505` desde este `INSERT` tal como está la tabla hoy. La rama `23505` en `Order.js` es código defensivo sin caso de uso real actualmente. |
| Payload inválido | Pasa (400) | Rechazado por validación temprana del controller, no llega a `Order.js`. |

**Corrección sobre un hallazgo anterior de esta sesión:** en un mensaje previo afirmé que staging y producción comparten la misma base de datos — eso era incorrecto, basado en un `.env.staging` local desactualizado (`DB_DATABASE=laartesa`, igual al de producción). Se confirmó con el equipo que el contenedor real de staging usa `DB_DATABASE=artesadb_dev`, una base separada. El archivo `.env.staging` de este repo ya fue corregido.

**Estado real según el DoD del proyecto: IMPLEMENTADO, todavía NO VALIDADO EN STAGING.** El único escenario que de verdad importa (503 por columna faltante — el que causó el incidente) no pudo validarse porque el código no está desplegado en staging. Los otros dos "pasan" pero no ejercitan las ramas nuevas del catch (`23503`/`23505`), así que tampoco cuentan como validación real de esas ramas.

## Próximos Pasos (P1/P2)

1. **Desplegar el commit `98ab4bb` a staging** (`git pull` + rebuild en `artesa-api-staging`, según el proceso de deploy documentado en el DoD) y volver a correr `scripts/tests/order-error-handling-acceptance.js` — solo entonces el escenario 503 puede pasar a VALIDADO EN STAGING.
2. Decidir qué hacer con las ramas `23503` y `23505` del catch de `Order.js`: hoy son código muerto por la vía de la API pública (el controller y el esquema ya previenen esas condiciones antes de llegar ahí). Mantenerlas como defensa en profundidad es razonable, pero no reportarlas como "validadas" sin un caso de uso real que las alcance.
3. Confirmar contra el esquema real de producción si `2026-09-05_create-backoffice-module.sql` y `2026-09-06_add-sap-sales-employee-code.sql` están aplicadas — quedó reportado como "no aplicable" pero sin verificación directa de Claude Code (ver `db/migrations/001_initial-schema.md`).
4. Evaluar `node-pg-migrate` o Knex para tracking automático de migraciones (detalle en `docs/MIGRATION_STRATEGY.md`).
5. Agregar gate de CI/CD que bloquee un deploy si hay migraciones sin aplicar en el ambiente destino.
