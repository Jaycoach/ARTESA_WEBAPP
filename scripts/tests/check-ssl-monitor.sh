#!/usr/bin/env bash
# Script de aceptacion — DoD la-artesa-dod (Tarea 2: monitoreo proactivo de
# expiracion de certificados SSL, cron + AWS SES).
#
# Verifica de forma ejecutable:
#   1. El cron de monitoreo esta registrado en el host.
#   2. scripts/production/ssl-expiry-check-cron.sh corre con exit 0 contra el
#      dominio real (certificado sano, dentro del umbral).
#   3. El mismo script corre con exit 1 contra un dominio de prueba con
#      certificado vencido (expired.badssl.com — servicio publico mantenido
#      justamente para probar el manejo de certificados expirados; no se usa
#      ningun dominio propio ni se espera a que el cert real este por vencer).
#   4. Ese caso de umbral vencido efectivamente dispara el correo de alerta
#      (se confirma via el marcador MAIL_SENT_OK que imprime
#      ssl-expiry-mailer.js al recibir confirmacion de SES/nodemailer).
#
# Uso:
#   scripts/tests/check-ssl-monitor.sh <ssh_user@host> <ssh_key_path> <dominio_real> <app_container_name> [umbral_dias=15]
#
# Ejemplo:
#   scripts/tests/check-ssl-monitor.sh ec2-user@52.20.47.155 artesa-portal-prod-key.pem api.artesapanaderia.com artesa-api-production 15
#
# Exit 0 solo si TODOS los checks pasan.

set -u

SSH_TARGET="${1:?Uso: check-ssl-monitor.sh <ssh_user@host> <ssh_key_path> <dominio_real> <app_container_name> [umbral_dias]}"
SSH_KEY="${2:?Uso: check-ssl-monitor.sh <ssh_user@host> <ssh_key_path> <dominio_real> <app_container_name> [umbral_dias]}"
DOMAIN="${3:?Uso: check-ssl-monitor.sh <ssh_user@host> <ssh_key_path> <dominio_real> <app_container_name> [umbral_dias]}"
APP_CONTAINER="${4:?Uso: check-ssl-monitor.sh <ssh_user@host> <ssh_key_path> <dominio_real> <app_container_name> [umbral_dias]}"
THRESHOLD="${5:-15}"

REMOTE_DIR="/home/ec2-user/artesa-api"
TEST_DOMAIN="expired.badssl.com"

PASS=0
FAIL=0
pass() { echo "[PASS] $1"; PASS=$((PASS+1)); }
fail() { echo "[FAIL] $1"; FAIL=$((FAIL+1)); }

ssh_run() {
  ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i "$SSH_KEY" "$SSH_TARGET" "$1"
}

echo "=== Check SSL monitor — $SSH_TARGET ($DOMAIN, umbral ${THRESHOLD}d) ==="
echo

# --- Check 1: cron registrado ---
echo "--- 1. Cron de monitoreo registrado ---"
CRON_LINE="$(ssh_run "crontab -l 2>/dev/null | grep -F 'ssl-expiry-check-cron.sh'")"
if [ -n "$CRON_LINE" ]; then
  pass "Cron encontrado: $CRON_LINE"
else
  fail "No se encontro ninguna entrada de crontab con ssl-expiry-check-cron.sh"
fi
echo

# --- Check 2: dominio real sano -> exit 0 ---
echo "--- 2. ssl-expiry-check-cron.sh con el dominio real (esperado exit 0) ---"
REAL_OUT="$(ssh_run "$REMOTE_DIR/scripts/production/ssl-expiry-check-cron.sh '$DOMAIN' '$APP_CONTAINER' '$THRESHOLD'" 2>&1)"
REAL_EXIT=$?
echo "$REAL_OUT"
if [ $REAL_EXIT -eq 0 ]; then
  pass "exit 0 — certificado real dentro del umbral, sin alerta"
else
  fail "exit $REAL_EXIT (se esperaba 0) — revisar salida arriba"
fi
echo

# --- Check 3 y 4: dominio de prueba con cert vencido -> exit 1 + correo disparado ---
echo "--- 3/4. ssl-expiry-check-cron.sh con $TEST_DOMAIN (cert vencido, esperado exit != 0 y MAIL_SENT_OK) ---"
TEST_OUT="$(ssh_run "$REMOTE_DIR/scripts/production/ssl-expiry-check-cron.sh '$TEST_DOMAIN' '$APP_CONTAINER' '$THRESHOLD'" 2>&1)"
TEST_EXIT=$?
echo "$TEST_OUT"
if [ $TEST_EXIT -ne 0 ]; then
  pass "exit $TEST_EXIT (!= 0) — el umbral vencido se detecto correctamente"
else
  fail "exit 0 con $TEST_DOMAIN — se esperaba una falla detectada"
fi

if echo "$TEST_OUT" | grep -q "MAIL_SENT_OK"; then
  pass "Correo de alerta disparado y confirmado (MAIL_SENT_OK)"
else
  fail "No se encontro confirmacion MAIL_SENT_OK — el correo no se disparo o fallo el envio"
fi
echo

echo "=== Resumen: $PASS pass, $FAIL fail ==="
[ "$FAIL" -gt 0 ] && exit 1
exit 0
