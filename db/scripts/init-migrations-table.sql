-- init-migrations-table.sql
-- Crea la tabla de control de migraciones. Se corre UNA SOLA VEZ por base de datos
-- (staging y producción por separado). Idempotente: seguro de correr más de una vez.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR PRIMARY KEY,
  description TEXT,
  installed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

COMMENT ON TABLE schema_migrations IS
  'Tracking de migraciones aplicadas. Cada migración registra su ejecución aquí. Ver docs/MIGRATION_STRATEGY.md.';
