#!/bin/bash
# verify-migrations.sh — compara los archivos .sql en db/migrations/ contra lo que
# schema_migrations dice que ya corrió en el ambiente apuntado por las variables
# DB_HOST/DB_USER/DB_PASSWORD/DB_DATABASE (nunca hardcodear credenciales aquí).
#
# Uso:
#   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_DATABASE=... ./scripts/verify-migrations.sh

set -euo pipefail

MIGRATIONS_DIR="$(dirname "$0")/../db/migrations"

if [[ -z "${DB_HOST:-}" || -z "${DB_USER:-}" || -z "${DB_PASSWORD:-}" || -z "${DB_DATABASE:-}" ]]; then
  echo "Faltan variables de entorno: DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE" >&2
  exit 1
fi

echo "== Migraciones aplicadas según schema_migrations =="
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_DATABASE" -c \
  "SELECT version, installed_on, success FROM schema_migrations ORDER BY installed_on DESC;" \
  2>&1 || echo "(la tabla schema_migrations aún no existe en este ambiente — correr db/scripts/init-migrations-table.sql primero)"

echo ""
echo "== Archivos .sql en disco (db/migrations/) =="
ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | xargs -n1 basename

echo ""
echo "NOTA: este script solo lista ambos lados; comparar manualmente hasta que exista"
echo "tooling automático (ver docs/MIGRATION_STRATEGY.md, sección 'Por implementar')."
