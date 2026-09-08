# Migration Tracking

Este archivo documenta qué migraciones existen en `db/migrations/` y en qué ambientes se han corrido. No reemplaza una tabla `schema_migrations` real (ver `db/scripts/init-migrations-table.sql`) — es un registro manual de bitácora mientras no haya tooling automático.

Formato: `YYYY-MM-DD_descripción.sql`

## Migraciones registradas

| Archivo | Staging | Producción |
|---|---|---|
| `2026-09-04_create-tax-codes-tables.sql` | Aplicada | Aplicada (2026-09-08, remediación incidente) |
| `2026-09-05_add-tax-codes-valid-for-ar.sql` | Aplicada | Aplicada (2026-09-08, remediación incidente) |
| `2026-09-05_add-tax-snapshot-columns.sql` | Aplicada (2026-09-05) | **NO estaba aplicada** hasta 2026-09-08 — causa raíz del incidente de órdenes bloqueadas del 2026-09-07 13:05. Aplicada el 2026-09-08. |
| `2026-09-05_create-backoffice-module.sql` | Aplicada | Reportado por Jonathan como no aplicable/no pendiente en el contexto del incidente del 2026-09-07 — **no verificado directamente por Claude Code contra el esquema real de producción, confirmar antes de asumir** |
| `2026-09-06_add-sap-sales-employee-code.sql` | Aplicada | Idem — mismo estado sin verificar directamente |

## Próximas a crear

- (agregar aquí cuando se cree una migración nueva, con su estado por ambiente)

## Cómo actualizar esta tabla

Cada vez que se corra una migración contra un ambiente, actualizar la fila correspondiente con la fecha real de ejecución. Este archivo es la fuente de verdad manual hasta que se implemente `node-pg-migrate` (ver `docs/MIGRATION_STRATEGY.md`).
