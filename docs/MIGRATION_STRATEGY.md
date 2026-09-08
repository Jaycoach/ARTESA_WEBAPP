# Estrategia de Migraciones

Contexto: el incidente del 2026-09-07 (órdenes bloqueadas al 100% en producción) fue causado por una migración escrita y aplicada en staging, pero nunca ejecutada en producción — el código asumía columnas (`orders.iva_amount`, `orders.impuesto_saludable_amount`) que no existían ahí. Ver `docs/INCIDENTE-2026-09-07-CLOSURE.md` para el post-mortem completo.

## Cómo ejecutar una migración hoy (proceso manual)

1. Crear archivo: `db/migrations/YYYY-MM-DD_descripción.sql`.
2. Escribir el contenido usando `IF NOT EXISTS` / `IF EXISTS` para que sea idempotente (seguro de correr más de una vez sin romper nada).
3. Probar en staging primero.
4. Ejecutar en producción:
   ```bash
   PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_DATABASE" < db/migrations/YYYY-MM-DD_descripción.sql
   ```
5. Registrar la ejecución en `db/migrations/001_initial-schema.md` (manual, hasta que exista tooling automático) y, si `schema_migrations` ya está inicializada en ese ambiente (`db/scripts/init-migrations-table.sql`), insertar la fila correspondiente.

## Por implementar (futuro P1)

- Adoptar `node-pg-migrate` o Knex para automatizar el tracking de qué migración corrió en qué ambiente, en vez de depender de un archivo Markdown mantenido a mano.
- Gate de CI/CD que bloquee un deploy si hay migraciones en `db/migrations/` sin registro correspondiente en `schema_migrations` del ambiente destino.
- Histórico de ejecución real (tiempo, éxito/error) en `schema_migrations`, alimentado automáticamente por el runner de migraciones en vez de por `verify-migrations.sh` a mano.
