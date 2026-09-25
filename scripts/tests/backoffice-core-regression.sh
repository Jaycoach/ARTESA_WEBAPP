#!/usr/bin/env bash
# scripts/tests/backoffice-core-regression.sh
# Fase 2-R — línea base de regresión. Llama endpoints SIN EFECTOS (o con datos de
# prueba marcados), NUNCA sincronizaciones contra SAP ni borrados reales, y registra
# método + ruta + código HTTP + forma básica de la respuesta.
#
# Uso:
#   BASE_URL="https://staging.laartesa..." \
#   ADMIN_TOKEN="..." FUNCTIONAL_ADMIN_TOKEN="..." USER_TOKEN="..." BRANCH_TOKEN="..." \
#   ./scripts/tests/backoffice-core-regression.sh > resultados/antes.txt
#
# CURL_INSECURE=1 (opcional, aditivo): agrega `curl -k` para cuando BASE_URL es HTTPS con
# certificado autofirmado (p. ej. "https://localhost" contra nginx en Staging, para probar
# el mismo circuito TLS/proxy que un usuario real, en vez de saltarlo con localhost:3000
# directo al contenedor). NUNCA usar CURL_INSECURE=1 contra Producción — ahí el certificado
# debe ser válido y cualquier fallo de TLS debe verse, no ignorarse.
#
# Nunca hardcodear tokens en este archivo — siempre variables de entorno, nunca
# impresos ni logueados aparte del código de estado HTTP.
#
# Correr DOS VECES:
#   1) Contra el Staging actual (sin el núcleo desplegado) -> línea base "antes".
#   2) Después de desplegar feature/backoffice-core en Staging -> "después".
# Luego usar compare-regression-results.sh para diferenciar ambas salidas.

set -uo pipefail

: "${BASE_URL:?Falta BASE_URL}"
: "${ADMIN_TOKEN:?Falta ADMIN_TOKEN}"
: "${FUNCTIONAL_ADMIN_TOKEN:?Falta FUNCTIONAL_ADMIN_TOKEN}"
: "${USER_TOKEN:?Falta USER_TOKEN}"
: "${BRANCH_TOKEN:?Falta BRANCH_TOKEN}"
# Opcional: id del usuario dueño de USER_TOKEN, para las pruebas de perfil/can-create propio.
# Si no se define, esas 2 llamadas específicas se omiten (se avisa en la salida).
USER_ID="${USER_ID:-}"

CURL_OPTS=()
if [ "${CURL_INSECURE:-0}" = "1" ]; then
  CURL_OPTS+=(-k)
fi

call() {
  local method="$1" path="$2" token="$3" label="$4"
  local status body
  body=$(curl -s "${CURL_OPTS[@]}" -o /tmp/backoffice_regression_body.$$ -w "%{http_code}" \
    -X "$method" "${BASE_URL}${path}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json")
  status="$body"
  local shape
  shape=$(head -c 300 /tmp/backoffice_regression_body.$$ 2>/dev/null | tr -d '\n')
  rm -f /tmp/backoffice_regression_body.$$
  printf '%s | %s %s | %s | %s\n' "$label" "$method" "$path" "$status" "$shape"
}

call_no_auth() {
  local method="$1" path="$2" label="$3"
  local status
  status=$(curl -s "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" -X "$method" "${BASE_URL}${path}")
  printf '%s | %s %s | %s | (sin auth)\n' "$label" "$method" "$path" "$status"
}

echo "=== Fase 2-R — $(date -u +%Y-%m-%dT%H:%M:%SZ) — BASE_URL=${BASE_URL} ==="

echo "--- Login de cliente y de sucursal (con las credenciales de prueba ya provistas por Jonathan) ---"
echo "(Los logins reales no se repiten aquí para no generar tokens nuevos en cada corrida;"
echo " ADMIN_TOKEN/FUNCTIONAL_ADMIN_TOKEN/USER_TOKEN/BRANCH_TOKEN ya son tokens vigentes de sesión.)"

echo "--- Portal de clientes (rol USER) — catálogo, precios, pedidos, perfil ---"
call GET  "/api/products"                    "$USER_TOKEN" "portal:catalogo"
call GET  "/api/orders/user-branches"        "$USER_TOKEN" "portal:sucursales-propias"
call GET  "/api/orders/statuses"             "$USER_TOKEN" "portal:estados-pedido"
if [ -n "$USER_ID" ]; then
  call GET "/api/client-profiles/user/$USER_ID" "$USER_TOKEN" "portal:perfil-propio"
else
  echo "portal:perfil-propio | (omitido, USER_ID no definido)"
fi

echo "--- Rutas [1,3] (multi-rol, deben responder igual para ADMIN y FUNCTIONAL_ADMIN) ---"
call GET  "/api/client-profiles"             "$ADMIN_TOKEN"            "1,3:clients-view:ADMIN"
call GET  "/api/client-profiles"             "$FUNCTIONAL_ADMIN_TOKEN" "1,3:clients-view:FUNC_ADMIN"
call GET  "/api/admin/settings"              "$ADMIN_TOKEN"            "1,3:admin-settings:ADMIN"
call GET  "/api/admin/settings"              "$FUNCTIONAL_ADMIN_TOKEN" "1,3:admin-settings:FUNC_ADMIN"

echo "--- Rutas [1] (solo ADMIN — deben seguir dando 200 a ADMIN, 403 a FUNCTIONAL_ADMIN) ---"
call GET  "/api/users"                       "$ADMIN_TOKEN"            "1:usuarios:ADMIN"
call GET  "/api/users"                       "$FUNCTIONAL_ADMIN_TOKEN" "1:usuarios:FUNC_ADMIN(esperado 403)"
call GET  "/api/client-sync/status"          "$ADMIN_TOKEN"            "1:sync-status:ADMIN"
call GET  "/api/client-sync/status"          "$FUNCTIONAL_ADMIN_TOKEN" "1:sync-status:FUNC_ADMIN(esperado 403)"
call GET  "/api/sap/status"                  "$ADMIN_TOKEN"            "1:sap-status:ADMIN"

echo "--- /api/backoffice/* (núcleo nuevo) ---"
call GET  "/api/backoffice/platform-users"                 "$ADMIN_TOKEN"            "backoffice:platform-users:ADMIN"
call GET  "/api/backoffice/platform-users"                 "$FUNCTIONAL_ADMIN_TOKEN" "backoffice:platform-users:FUNC_ADMIN(esperado 403)"
call GET  "/api/backoffice/clients"                         "$ADMIN_TOKEN"            "backoffice:clients:ADMIN"
call GET  "/api/backoffice/clients"                         "$FUNCTIONAL_ADMIN_TOKEN" "backoffice:clients:FUNC_ADMIN"
call GET  "/api/backoffice/clients/without-profile"         "$ADMIN_TOKEN"            "backoffice:clients-without-profile:ADMIN"
call GET  "/api/backoffice/settings"                        "$ADMIN_TOKEN"            "backoffice:settings:ADMIN"
call GET  "/api/backoffice/settings"                        "$FUNCTIONAL_ADMIN_TOKEN" "backoffice:settings:FUNC_ADMIN (diferencia esperada: 6h/checkpoint, 200)"
call GET  "/api/backoffice/sync/status"                     "$ADMIN_TOKEN"            "backoffice:sync-status:ADMIN"
call GET  "/api/backoffice/sync/status"                     "$FUNCTIONAL_ADMIN_TOKEN" "backoffice:sync-status:FUNC_ADMIN (diferencia esperada: 403)"
call GET  "/api/backoffice/sync/clients/pending"             "$ADMIN_TOKEN"            "backoffice:sync-pending:ADMIN"

echo "--- Diferencias esperadas documentadas (9-bis, secureProductRoutes, 6i) ---"
if [ -n "$USER_ID" ]; then
  call GET "/api/orders/can-create/$USER_ID" "$USER_TOKEN" "9bis:can-create-propio"
else
  echo "9bis:can-create-propio | (omitido, USER_ID no definido)"
fi
call GET  "/api/orders/can-create/999999999"                "$USER_TOKEN" "9bis:can-create-ajeno (diferencia esperada: 403, antes 200)"
call GET  "/api/secure/products"                             "$ADMIN_TOKEN" "D6:secure-product-routes (diferencia esperada: 404, ruta desmontada)"

echo "--- Login de sucursal (token ya vigente, ruta protegida) ---"
call GET  "/api/branch-orders"                                "$BRANCH_TOKEN" "sucursal:branch-orders"
call GET  "/api/branch-dashboard"                             "$BRANCH_TOKEN" "sucursal:branch-dashboard"

echo "--- /api/internal/* sin clave (debe rechazar siempre, sin cambio) ---"
call_no_auth POST "/api/internal/sync-orders" "internal:sin-clave (esperado 401/403, nunca 200)"

echo "=== Fin de la corrida ==="
