#!/usr/bin/env bash
# Script de aceptacion — DoD la-artesa-dod (Tarea 1: fix SSL api.artesapanaderia.com)
#
# Verifica de forma ejecutable que el certificado SSL esta sano y que la
# renovacion automatica via certbot (webroot) funciona.
#
# Uso:
#   scripts/tests/check-ssl-cert.sh <dominio> [min_dias] [ssh_user@host] [ssh_key_path]
#
# Ejemplos:
#   scripts/tests/check-ssl-cert.sh api.artesapanaderia.com
#   scripts/tests/check-ssl-cert.sh api.artesapanaderia.com 60 ec2-user@52.20.47.155 artesa-portal-prod-key.pem
#
# Si se omiten ssh_user@host / ssh_key_path, el paso 3 (certbot --dry-run) se
# reporta como SKIPPED en lugar de fallar — permite correr los checks 1 y 2
# (los que no requieren SSH) de forma independiente.
#
# Exit 0 solo si TODOS los checks aplicables pasan.

set -u

DOMAIN="${1:?Uso: check-ssl-cert.sh <dominio> [min_dias] [ssh_user@host] [ssh_key_path]}"
MIN_DAYS="${2:-60}"
SSH_TARGET="${3:-}"
SSH_KEY="${4:-}"

PASS=0
FAIL=0

pass() { echo "[PASS] $1"; PASS=$((PASS+1)); }
fail() { echo "[FAIL] $1"; FAIL=$((FAIL+1)); }
skip() { echo "[SKIP] $1"; }

echo "=== Check SSL — $DOMAIN ==="
echo

# --- Check 1: dias hasta expiracion >= MIN_DAYS ---
echo "--- 1. Expiracion del certificado (minimo ${MIN_DAYS} dias) ---"
NOT_AFTER="$(echo | openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"

if [ -z "$NOT_AFTER" ]; then
  fail "No se pudo obtener la fecha de expiracion del certificado (conexion TLS fallida)"
else
  NOT_AFTER_EPOCH="$(date -d "$NOT_AFTER" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$NOT_AFTER" +%s 2>/dev/null)"
  NOW_EPOCH="$(date +%s)"
  if [ -z "$NOT_AFTER_EPOCH" ]; then
    fail "No se pudo parsear la fecha de expiracion: '$NOT_AFTER'"
  else
    DAYS_LEFT=$(( (NOT_AFTER_EPOCH - NOW_EPOCH) / 86400 ))
    echo "    notAfter=$NOT_AFTER  (dias restantes: $DAYS_LEFT)"
    if [ "$DAYS_LEFT" -ge "$MIN_DAYS" ]; then
      pass "Certificado vigente por >= ${MIN_DAYS} dias ($DAYS_LEFT dias restantes)"
    else
      fail "Certificado vence en menos de ${MIN_DAYS} dias ($DAYS_LEFT dias restantes)"
    fi
  fi
fi
echo

# --- Check 2: /api/health responde 200 SIN error TLS ---
echo "--- 2. https://$DOMAIN/api/health responde 200 con TLS valido ---"
CURL_OUT="$(curl -sS -o /tmp/check-ssl-health-body.$$ -w '%{http_code}' --max-time 15 "https://${DOMAIN}/api/health" 2>&1)"
CURL_EXIT=$?
if [ $CURL_EXIT -ne 0 ]; then
  fail "curl fallo (exit $CURL_EXIT) — posible error de validacion TLS: $CURL_OUT"
elif [ "$CURL_OUT" = "200" ]; then
  pass "HTTP 200 con certificado valido (curl sin -k)"
else
  fail "HTTP $CURL_OUT (esperado 200)"
fi
rm -f /tmp/check-ssl-health-body.$$
echo

# --- Check 3: certbot renew --dry-run exit 0 (requiere SSH) ---
echo "--- 3. certbot renew --dry-run (renovacion via webroot) ---"
if [ -z "$SSH_TARGET" ] || [ -z "$SSH_KEY" ]; then
  skip "No se paso ssh_user@host / ssh_key_path — omitiendo dry-run remoto"
else
  DRYRUN_OUT="$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i "$SSH_KEY" "$SSH_TARGET" \
    "sudo certbot renew --cert-name '${DOMAIN}' --dry-run 2>&1")"
  DRYRUN_EXIT=$?
  echo "$DRYRUN_OUT" | sed -E 's/(SAP_PASSWORD|AWS_SECRET|INTERNAL_SYNC_KEY)=[^ ]+/\1=***MASKED***/g'
  if [ $DRYRUN_EXIT -eq 0 ] && echo "$DRYRUN_OUT" | grep -qi "Congratulations\|dry run.*success\|successful"; then
    pass "certbot renew --dry-run exit 0 y confirmo renovacion simulada exitosa"
  else
    fail "certbot renew --dry-run fallo o no confirmo exito (exit $DRYRUN_EXIT)"
  fi
fi
echo

echo "=== Resumen: $PASS pass, $FAIL fail ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
