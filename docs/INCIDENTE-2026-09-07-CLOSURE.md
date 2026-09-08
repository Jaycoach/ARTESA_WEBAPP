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

## Cambios de código aplicados en este repo (rama `feature/backoffice-module`, IMPLEMENTADO — no aún validado en staging con script de aceptación real)

- `src/models/Order.js` (catch block, antes líneas 262-269): distingue `error.code` de PostgreSQL (`42703` columna faltante → 503, `23503` FK → 400, `23505` duplicado → 409) en vez de tratar todo error como un 500 genérico.
- `src/controllers/orderController.js` (catch block, antes líneas 407-419): propaga `statusCode`/`userMessage` específicos al cliente en vez del mensaje fijo `"Error al crear la orden"`.
- Validado únicamente con `node --check` en ambos archivos (sintaxis válida) — **esto es el estado IMPLEMENTADO según el DoD del proyecto, no VALIDADO EN STAGING**, porque no se corrió un script de aceptación real (curl a un endpoint vivo con un error de cada tipo forzado) contra ningún ambiente.
- `docs/MIGRATION_STRATEGY.md`, `db/scripts/init-migrations-table.sql`, `scripts/verify-migrations.sh`, `db/migrations/001_initial-schema.md`: tooling y documentación nueva para prevenir que este tipo de desincronización pase inadvertida en el futuro.
- `src/.claude/skills/la-artesa-dod/SKILL.md`: nueva sección con checklist de migraciones y referencia a los códigos SQLSTATE relevantes.

## Próximos Pasos (P1/P2)

1. Correr un script de aceptación real (`scripts/tests/`) contra staging que fuerce cada uno de los 3 tipos de error (columna faltante simulada, FK inválida, duplicado) y confirme que el cliente recibe el `statusCode`/mensaje esperado — solo así el cambio de error handling pasa a **VALIDADO EN STAGING**.
2. Confirmar contra el esquema real de producción si `2026-09-05_create-backoffice-module.sql` y `2026-09-06_add-sap-sales-employee-code.sql` están aplicadas — quedó reportado como "no aplicable" pero sin verificación directa de Claude Code (ver `db/migrations/001_initial-schema.md`).
3. Evaluar `node-pg-migrate` o Knex para tracking automático de migraciones (detalle en `docs/MIGRATION_STRATEGY.md`).
4. Agregar gate de CI/CD que bloquee un deploy si hay migraciones sin aplicar en el ambiente destino.
