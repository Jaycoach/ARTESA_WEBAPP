#!/usr/bin/env bash
# Cron de monitoreo de expiracion SSL (DoD la-artesa-dod, Tarea 2).
#
# Corre scripts/tests/check-ssl-cert.sh contra un dominio con un umbral bajo
# (por defecto 15 dias) y, si falla (exit != 0), dispara una alerta por correo
# (AWS SES via el EmailService existente) ejecutando el mailer dentro del
# contenedor de la app -- reutiliza las credenciales SMTP ya cargadas ahi via
# env_file, sin duplicar configuracion de correo en el host.
#
# Uso: ssl-expiry-check-cron.sh <dominio> <app_container_name> [umbral_dias=15]
# Ejemplo (crontab):
#   0 7 * * 1 /home/ec2-user/artesa-api/scripts/production/ssl-expiry-check-cron.sh api.artesapanaderia.com artesa-api-production 15 >> /home/ec2-user/artesa-api/logs/ssl-expiry-cron.log 2>&1

set -u

DOMAIN="${1:?Uso: ssl-expiry-check-cron.sh <dominio> <app_container_name> [umbral_dias]}"
APP_CONTAINER="${2:?Uso: ssl-expiry-check-cron.sh <dominio> <app_container_name> [umbral_dias]}"
THRESHOLD="${3:-15}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_SCRIPT="$SCRIPT_DIR/tests/check-ssl-cert.sh"

echo "[$(date -Iseconds)] Verificando SSL de $DOMAIN (umbral ${THRESHOLD}d)"

CHECK_OUTPUT="$("$CHECK_SCRIPT" "$DOMAIN" "$THRESHOLD" 2>&1)"
CHECK_EXIT=$?

echo "$CHECK_OUTPUT"

if [ $CHECK_EXIT -ne 0 ]; then
  echo "[$(date -Iseconds)] Umbral no cumplido (exit $CHECK_EXIT) — disparando alerta por correo"
  echo "$CHECK_OUTPUT" | docker exec -i "$APP_CONTAINER" node scripts/production/ssl-expiry-mailer.js "$DOMAIN"
  MAIL_EXIT=$?
  if [ $MAIL_EXIT -ne 0 ]; then
    echo "[$(date -Iseconds)] ERROR: no se pudo enviar la alerta por correo (exit $MAIL_EXIT)"
  fi
else
  echo "[$(date -Iseconds)] OK — certificado dentro del umbral, no se envia alerta"
fi

exit $CHECK_EXIT
