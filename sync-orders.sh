#!/bin/bash
set -a
source "$(dirname "$0")/.env.staging"
set +a

LOG="$(dirname "$0")/logs/cron-sync.log"

ORDER_TIME=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_DATABASE" -p "$DB_PORT" --no-password -t -c "SELECT order_time_limit FROM admin_settings LIMIT 1;" 2>/dev/null | tr -d ' \n')

if [ -z "$ORDER_TIME" ]; then
  echo "$(date -u): ERROR - No se pudo obtener order_time_limit" >> $LOG
  exit 1
fi

LIMIT_H=$(echo $ORDER_TIME | cut -d: -f1 | sed 's/^0//')
LIMIT_M=$(echo $ORDER_TIME | cut -d: -f2 | sed 's/^0//')
LIMIT_H=${LIMIT_H:-0}
LIMIT_M=${LIMIT_M:-0}

SYNC_TOTAL_MIN=$(( (LIMIT_H * 60 + LIMIT_M + 5 + 300) % 1440 ))
SYNC_H=$(( SYNC_TOTAL_MIN / 60 ))
SYNC_M=$(( SYNC_TOTAL_MIN % 60 ))

NOW_H=$(date -u +%-H)
NOW_M=$(date -u +%-M)

if [ "$NOW_H" -eq "$SYNC_H" ] && [ "$NOW_M" -eq "$SYNC_M" ]; then
  echo "$(date -u): Ejecutando sincronizacion - order_time_limit=$ORDER_TIME" >> $LOG
  RESULT=$(curl -s -X POST https://${APP_HOST}/api/internal/sync-orders \
    -H "Content-Type: application/json" \
    -H "X-Internal-Key: $INTERNAL_SYNC_KEY" \
    -k)
  echo "$(date -u): Resultado: $RESULT" >> $LOG
fi