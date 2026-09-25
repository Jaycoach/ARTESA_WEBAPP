#!/usr/bin/env bash
# scripts/tests/qa-backoffice-core-cases.sh
# Fase 5 — QA funcional por caso de negocio (D5, D12, D13, 6i, uploads.delete).
# Distinto de scripts/tests/backoffice-core-regression.sh: ese valida que las rutas
# EXISTENTES no cambiaron de comportamiento (matriz de acceso); este valida que las
# reglas NUEVAS del núcleo realmente funcionan como decidido.
#
# Requiere datos de prueba dedicados (NUNCA cuentas reales de clientes/usuarios):
#   - Un usuario de plataforma de prueba (rol 3, creado vía este mismo script en el
#     Caso 3) para no tocar cuentas reales.
#   - Un cliente de prueba con perfil (CLIENT_TEST_USER_ID) para el Caso 1/4.
#   - Credenciales de sucursal de prueba, si se corre el Caso 5.
#
# Nunca hardcodear tokens/contraseñas — todo por variable de entorno. Las contraseñas
# de prueba que este script SÍ genera (Caso 3) se generan en tiempo de ejecución con
# /dev/urandom, nunca literales.
#
# Uso:
#   BASE_URL="https://staging..." ADMIN_TOKEN="..." FUNCTIONAL_ADMIN_TOKEN="..." \
#   CLIENT_TEST_USER_ID="<id de un cliente de prueba, NO real>" \
#   ./scripts/tests/qa-backoffice-core-cases.sh
#
# CURL_INSECURE=1 (opcional, aditivo): agrega `curl -k` para BASE_URL en HTTPS con
# certificado autofirmado (p. ej. "https://localhost" contra nginx en Staging). NUNCA
# usar CURL_INSECURE=1 contra Producción.
#
# Cada caso imprime PASA/FALLA. El script NO aborta en el primer fallo — corre todos
# los casos y termina con un resumen. Código de salida 1 si algún caso FALLA.

set -uo pipefail

: "${BASE_URL:?Falta BASE_URL}"
: "${ADMIN_TOKEN:?Falta ADMIN_TOKEN}"
: "${FUNCTIONAL_ADMIN_TOKEN:?Falta FUNCTIONAL_ADMIN_TOKEN}"

CURL_OPTS=()
if [ "${CURL_INSECURE:-0}" = "1" ]; then
  CURL_OPTS+=(-k)
fi

FAILS=0
TOTAL=0

check() {
  local label="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$expected" = "$actual" ]; then
    printf 'PASA  | %s | esperado=%s actual=%s\n' "$label" "$expected" "$actual"
  else
    printf 'FALLA | %s | esperado=%s actual=%s\n' "$label" "$expected" "$actual"
    FAILS=$((FAILS + 1))
  fi
}

req() {
  # req METHOD PATH TOKEN [BODY_JSON] -> imprime "STATUS|BODY" por stdout
  local method="$1" path="$2" token="$3" bodyjson="${4:-}"
  local tmp status
  tmp=$(mktemp)
  if [ -n "$bodyjson" ]; then
    status=$(curl -s "${CURL_OPTS[@]}" -o "$tmp" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" \
      -d "$bodyjson")
  else
    status=$(curl -s "${CURL_OPTS[@]}" -o "$tmp" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Authorization: Bearer ${token}" -H "Content-Type: application/json")
  fi
  printf '%s|%s' "$status" "$(cat "$tmp")"
  rm -f "$tmp"
}

echo "=== Fase 5 — QA funcional por caso — $(date -u +%Y-%m-%dT%H:%M:%SZ) — BASE_URL=${BASE_URL} ==="

# ---------------------------------------------------------------------------
echo ""
echo "--- Caso D12: comparación de correo insensible a mayúsculas en login ---"
echo "Requiere: LOGIN_TEST_EMAIL_LOWER (correo de un usuario de PRUEBA, en minúsculas)"
echo "          LOGIN_TEST_PASSWORD (su contraseña de prueba)"
if [ -n "${LOGIN_TEST_EMAIL_LOWER:-}" ] && [ -n "${LOGIN_TEST_PASSWORD:-}" ]; then
  UPPER_VARIANT=$(echo "$LOGIN_TEST_EMAIL_LOWER" | tr '[:lower:]' '[:upper:]')
  RESP=$(curl -s "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"mail\":\"${UPPER_VARIANT}\",\"password\":\"${LOGIN_TEST_PASSWORD}\"}")
  check "D12:login-con-mayusculas-acepta" "200" "$RESP"
else
  echo "(omitido — define LOGIN_TEST_EMAIL_LOWER y LOGIN_TEST_PASSWORD para correrlo)"
fi

# ---------------------------------------------------------------------------
echo ""
echo "--- Caso D5: usuario con deactivated_manually=true no puede reactivarse por verifyEmail/SAP sync ---"
echo "Requiere: DEACTIVATED_TEST_TOKEN (token de verificación de un usuario de PRUEBA ya"
echo "          inactivado manualmente vía /api/backoffice/clients/:id/deactivate)"
if [ -n "${DEACTIVATED_TEST_TOKEN:-}" ]; then
  RESP=$(curl -s "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X GET \
    "${BASE_URL}/api/auth/verify-email/${DEACTIVATED_TEST_TOKEN}")
  check "D5:verifyEmail-no-reactiva-inactivado-manual" "403" "$RESP"
else
  echo "(omitido — requiere preparar manualmente un usuario de prueba inactivado y su token)"
fi

# ---------------------------------------------------------------------------
echo ""
echo "--- Caso 3: alta de usuario de plataforma de prueba + invitación + activar/inactivar/reactivar ---"
RAND=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
TEST_MAIL="qa-backoffice-${RAND}@invalid.local"
CREATE_RESP=$(req POST "/api/backoffice/platform-users" "$ADMIN_TOKEN" \
  "{\"name\":\"QA BackOffice ${RAND}\",\"mail\":\"${TEST_MAIL}\",\"rolId\":3}")
CREATE_STATUS="${CREATE_RESP%%|*}"
check "3:crear-usuario-plataforma-prueba" "201" "$CREATE_STATUS"

NEW_USER_ID=$(printf '%s' "${CREATE_RESP#*|}" | grep -oE '"id":[0-9]+' | head -1 | grep -oE '[0-9]+')
if [ -n "$NEW_USER_ID" ]; then
  echo "  usuario de prueba creado: id=${NEW_USER_ID} mail=${TEST_MAIL}"

  RESEND_RESP=$(req POST "/api/backoffice/platform-users/${NEW_USER_ID}/resend-invitation" "$ADMIN_TOKEN")
  check "3:reenviar-invitacion" "200" "${RESEND_RESP%%|*}"

  DEACT_RESP=$(req POST "/api/backoffice/platform-users/${NEW_USER_ID}/deactivate" "$ADMIN_TOKEN" \
    '{"reason":"QA Fase 5 - caso de prueba automatizado"}')
  check "3:inactivar-usuario-plataforma" "200" "${DEACT_RESP%%|*}"

  DEACT_AGAIN_RESP=$(req POST "/api/backoffice/platform-users/${NEW_USER_ID}/deactivate" "$ADMIN_TOKEN" \
    '{"reason":"segundo intento, debe rechazar"}')
  check "3:inactivar-dos-veces-rechaza" "409" "${DEACT_AGAIN_RESP%%|*}"

  ACT_RESP=$(req POST "/api/backoffice/platform-users/${NEW_USER_ID}/activate" "$ADMIN_TOKEN")
  check "3:reactivar-usuario-plataforma" "200" "${ACT_RESP%%|*}"

  # FUNCTIONAL_ADMIN no puede gestionar usuarios de plataforma (fuera de su matriz D3).
  FORBIDDEN_RESP=$(req GET "/api/backoffice/platform-users" "$FUNCTIONAL_ADMIN_TOKEN")
  check "D3:functional-admin-sin-acceso-platform-users" "403" "${FORBIDDEN_RESP%%|*}"
else
  echo "  (no se pudo extraer el id del usuario creado — se omiten los sub-casos siguientes)"
  FAILS=$((FAILS + 1))
fi

# ---------------------------------------------------------------------------
echo ""
echo "--- Caso 4: vista previa + inactivación de cliente de prueba (NO ejecutar sobre un cliente real) ---"
if [ -n "${CLIENT_TEST_USER_ID:-}" ]; then
  PREVIEW_RESP=$(req GET "/api/backoffice/clients/${CLIENT_TEST_USER_ID}/deactivation-preview" "$ADMIN_TOKEN")
  check "4:preview-inactivacion-cliente" "200" "${PREVIEW_RESP%%|*}"
  echo "  preview body: ${PREVIEW_RESP#*|}"
  echo "  (inactivación real NO se ejecuta automáticamente por este script — hazlo manualmente"
  echo "   en la UI o con el siguiente curl si CLIENT_TEST_USER_ID es realmente un cliente de prueba):"
  echo "  curl -X POST ${BASE_URL}/api/backoffice/clients/${CLIENT_TEST_USER_ID}/deactivate -H \"Authorization: Bearer \$ADMIN_TOKEN\" -d '{\"reason\":\"...\"}'"
else
  echo "(omitido — define CLIENT_TEST_USER_ID con el id de un cliente de PRUEBA)"
fi

# ---------------------------------------------------------------------------
echo ""
echo "--- Caso uploads.delete: FUNCTIONAL_ADMIN no puede borrar imágenes (solo ADMIN) ---"
FORBIDDEN_DELETE=$(curl -s "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/upload/qa-test-nonexistent-key.jpg" \
  -H "Authorization: Bearer ${FUNCTIONAL_ADMIN_TOKEN}")
check "uploads.delete:functional-admin-rechazado" "403" "$FORBIDDEN_DELETE"

# ---------------------------------------------------------------------------
echo ""
echo "=== Resumen: ${TOTAL} casos, $((TOTAL - FAILS)) PASA, ${FAILS} FALLA ==="
if [ "$FAILS" -gt 0 ]; then
  exit 1
fi
exit 0
