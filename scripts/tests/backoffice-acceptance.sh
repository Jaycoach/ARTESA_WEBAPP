#!/bin/bash
# Script de aceptación — módulo BackOffice (Fase 5).
# Corre contra EC2 Staging real, a través de nginx (nunca contra local).
# Requiere `node` en el PATH (se usa solo para parsear JSON, sin dependencias externas).
#
# Uso:
#   export BACKOFFICE_TEST_ADMIN_EMAIL=...      # usuario con rol ADMIN o BACKOFFICE ya existente en staging
#   export BACKOFFICE_TEST_ADMIN_PASSWORD=...
#   export BACKOFFICE_TEST_USER_EMAIL=...       # usuario con rol USER normal (para la prueba negativa)
#   export BACKOFFICE_TEST_USER_PASSWORD=...
#   export BACKOFFICE_TEST_PRODUCT_CODE=...     # sap_code de un producto activo real en staging
#   ./scripts/tests/backoffice-acceptance.sh
#
# Ninguna credencial va hardcodeada en este archivo — todas se leen de variables de entorno,
# y ninguna se imprime en el output (ver "Manejo de credenciales" en la metodología del proyecto).

set -uo pipefail

BASE_URL="${BACKOFFICE_TEST_BASE_URL:-http://ec2-44-216-131-63.compute-1.amazonaws.com}"
TEST_CLIENT_ID="${BACKOFFICE_TEST_CLIENT_ID:-588}"
TEST_BRANCH_ID="${BACKOFFICE_TEST_BRANCH_ID:-2600}"

: "${BACKOFFICE_TEST_ADMIN_EMAIL:?Exporta BACKOFFICE_TEST_ADMIN_EMAIL (usuario ADMIN o BACKOFFICE existente en staging)}"
: "${BACKOFFICE_TEST_ADMIN_PASSWORD:?Exporta BACKOFFICE_TEST_ADMIN_PASSWORD}"
: "${BACKOFFICE_TEST_USER_EMAIL:?Exporta BACKOFFICE_TEST_USER_EMAIL (usuario rol USER, para la prueba negativa)}"
: "${BACKOFFICE_TEST_USER_PASSWORD:?Exporta BACKOFFICE_TEST_USER_PASSWORD}"
: "${BACKOFFICE_TEST_PRODUCT_CODE:?Exporta BACKOFFICE_TEST_PRODUCT_CODE (sap_code de un producto activo real)}"

FAIL=0
ORDER_ID=""

json_get() {
  # $1 = JSON string (por stdin, nunca por argv — evita "Argument list too long"
  # en Windows con respuestas grandes), $2 = ruta tipo data.order_id (dot-path simple)
  printf '%s' "$1" | node -e "
    let data = '';
    process.stdin.on('data', d => data += d);
    process.stdin.on('end', () => {
      const obj = JSON.parse(data);
      const path = process.argv[1].split('.');
      let cur = obj;
      for (const k of path) { cur = cur?.[k]; }
      console.log(cur === undefined || cur === null ? '' : cur);
    });
  " "$2" 2>/dev/null
}

step() { echo ""; echo "== $1 =="; }
ok()   { echo "OK:   $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }

# --- Login admin BackOffice ---
step "Login como admin BackOffice"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"mail\":\"$BACKOFFICE_TEST_ADMIN_EMAIL\",\"password\":\"$BACKOFFICE_TEST_ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(json_get "$ADMIN_LOGIN" "data.token")
[ -z "$ADMIN_TOKEN" ] && ADMIN_TOKEN=$(json_get "$ADMIN_LOGIN" "token")
if [ -z "$ADMIN_TOKEN" ]; then
  fail "No se obtuvo token de admin (revisar credenciales / endpoint de login)"
else
  ok "Token de admin obtenido"
fi

# --- Login usuario normal (prueba negativa) ---
step "Login como usuario normal (rol USER, para prueba negativa)"
USER_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"mail\":\"$BACKOFFICE_TEST_USER_EMAIL\",\"password\":\"$BACKOFFICE_TEST_USER_PASSWORD\"}")
USER_TOKEN=$(json_get "$USER_LOGIN" "data.token")
[ -z "$USER_TOKEN" ] && USER_TOKEN=$(json_get "$USER_LOGIN" "token")
if [ -z "$USER_TOKEN" ]; then
  fail "No se obtuvo token de usuario normal"
else
  ok "Token de usuario normal obtenido"
fi

# --- Prueba negativa: usuario sin permiso de BackOffice no debe poder acceder ---
step "Prueba NEGATIVA: usuario normal no debe poder listar clientes de BackOffice"
NEG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/backoffice/clients" \
  -H "Authorization: Bearer $USER_TOKEN")
if [ "$NEG_STATUS" = "403" ]; then
  ok "GET /backoffice/clients devolvió 403 para usuario sin permiso (esperado)"
else
  fail "GET /backoffice/clients devolvió $NEG_STATUS para usuario sin permiso (se esperaba 403)"
fi

NEG_STATUS_ORDER=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/backoffice/orders" \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '{}')
if [ "$NEG_STATUS_ORDER" = "403" ]; then
  ok "POST /backoffice/orders devolvió 403 para usuario sin permiso (esperado)"
else
  fail "POST /backoffice/orders devolvió $NEG_STATUS_ORDER para usuario sin permiso (se esperaba 403)"
fi

# --- Listar clientes y confirmar que el cliente sintético aparece ---
step "GET /backoffice/clients — confirmar que el cliente de prueba ($TEST_CLIENT_ID) aparece"
CLIENTS_RESP=$(curl -s "$BASE_URL/api/backoffice/clients" -H "Authorization: Bearer $ADMIN_TOKEN")
FOUND_CLIENT=$(printf '%s' "$CLIENTS_RESP" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    const obj = JSON.parse(data);
    const found = (obj.data || []).some(c => String(c.client_id) === process.argv[1]);
    console.log(found);
  });
" "$TEST_CLIENT_ID" 2>/dev/null)
if [ "$FOUND_CLIENT" = "true" ]; then
  ok "Cliente de prueba encontrado en el listado"
else
  fail "Cliente de prueba ($TEST_CLIENT_ID) no apareció en GET /backoffice/clients"
fi

# --- Listar sucursales del cliente y confirmar la sucursal sintética ---
step "GET /backoffice/clients/$TEST_CLIENT_ID/branches — confirmar sucursal de prueba ($TEST_BRANCH_ID)"
BRANCHES_RESP=$(curl -s "$BASE_URL/api/backoffice/clients/$TEST_CLIENT_ID/branches" -H "Authorization: Bearer $ADMIN_TOKEN")
FOUND_BRANCH=$(printf '%s' "$BRANCHES_RESP" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    const obj = JSON.parse(data);
    const found = (obj.data || []).some(b => String(b.branch_id) === process.argv[1]);
    console.log(found);
  });
" "$TEST_BRANCH_ID" 2>/dev/null)
if [ "$FOUND_BRANCH" = "true" ]; then
  ok "Sucursal de prueba encontrada en el listado"
else
  fail "Sucursal de prueba ($TEST_BRANCH_ID) no apareció en GET /backoffice/clients/$TEST_CLIENT_ID/branches"
fi

# --- Ciclo de activar/inactivar ---
step "POST /backoffice/clients/:userId/deactivate + /activate"
# Necesitamos el user_id del cliente de prueba, no el client_id
USER_ID_OF_CLIENT=$(printf '%s' "$CLIENTS_RESP" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    const obj = JSON.parse(data);
    const c = (obj.data || []).find(c => String(c.client_id) === process.argv[1]);
    console.log(c ? c.user_id : '');
  });
" "$TEST_CLIENT_ID" 2>/dev/null)

if [ -z "$USER_ID_OF_CLIENT" ]; then
  fail "No se pudo resolver el user_id del cliente de prueba — se omite ciclo activar/inactivar"
else
  DEACTIVATE_RESP=$(curl -s -X POST "$BASE_URL/api/backoffice/clients/$USER_ID_OF_CLIENT/deactivate" -H "Authorization: Bearer $ADMIN_TOKEN")
  DEACTIVATE_OK=$(json_get "$DEACTIVATE_RESP" "success")
  [ "$DEACTIVATE_OK" = "true" ] && ok "Cliente inactivado" || fail "Fallo al inactivar cliente: $DEACTIVATE_RESP"

  ACTIVATE_RESP=$(curl -s -X POST "$BASE_URL/api/backoffice/clients/$USER_ID_OF_CLIENT/activate" -H "Authorization: Bearer $ADMIN_TOKEN")
  ACTIVATE_OK=$(json_get "$ACTIVATE_RESP" "success")
  [ "$ACTIVATE_OK" = "true" ] && ok "Cliente reactivado (queda igual que antes de la prueba)" || fail "Fallo al reactivar cliente: $ACTIVATE_RESP"
fi

# --- Reset de password de sucursal ---
step "POST /backoffice/branches/$TEST_BRANCH_ID/reset-password"
RESET_RESP=$(curl -s -X POST "$BASE_URL/api/backoffice/branches/$TEST_BRANCH_ID/reset-password" -H "Authorization: Bearer $ADMIN_TOKEN")
RESET_OK=$(json_get "$RESET_RESP" "success")
if [ "$RESET_OK" = "true" ]; then
  ok "Reset de password respondió success=true (contraseña nunca viaja en la respuesta — verificar manualmente que llegó el correo)"
else
  fail "Fallo al resetear password de sucursal: $RESET_RESP"
fi

# --- Precios del cliente ---
step "POST /backoffice/clients/$TEST_CLIENT_ID/product-prices"
PRICES_RESP=$(curl -s -X POST "$BASE_URL/api/backoffice/clients/$TEST_CLIENT_ID/product-prices" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"product_codes\":[\"$BACKOFFICE_TEST_PRODUCT_CODE\"]}")
PRICE_VALUE=$(printf '%s' "$PRICES_RESP" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    const obj = JSON.parse(data);
    const p = (obj.data || [])[0];
    console.log(p ? (p.effective_price ?? p.price ?? '') : '');
  });
" 2>/dev/null)
if [ -n "$PRICE_VALUE" ]; then
  ok "Precio con impuestos resuelto para el cliente de prueba: $PRICE_VALUE"
else
  fail "No se pudo resolver precio para $BACKOFFICE_TEST_PRODUCT_CODE con el cliente de prueba: $PRICES_RESP"
fi

# --- Resolver product_id real del sap_code de prueba (Order.createOrder lo exige) ---
step "GET /api/products — resolver product_id de $BACKOFFICE_TEST_PRODUCT_CODE"
PRODUCTS_RESP=$(curl -s "$BASE_URL/api/products" -H "Authorization: Bearer $ADMIN_TOKEN")
TEST_PRODUCT_ID=$(printf '%s' "$PRODUCTS_RESP" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    const obj = JSON.parse(data);
    const p = (obj.data || []).find(p => p.sap_code === process.argv[1]);
    console.log(p ? p.product_id : '');
  });
" "$BACKOFFICE_TEST_PRODUCT_CODE" 2>/dev/null)
[ -n "$TEST_PRODUCT_ID" ] && ok "product_id resuelto: $TEST_PRODUCT_ID" || fail "No se pudo resolver product_id para $BACKOFFICE_TEST_PRODUCT_CODE"

# --- Creación de orden a nombre del cliente ---
step "POST /backoffice/orders — crear orden a nombre del cliente de prueba"
if [ -n "$USER_ID_OF_CLIENT" ] && [ -n "$PRICE_VALUE" ] && [ -n "$TEST_PRODUCT_ID" ]; then
  ORDER_RESP=$(curl -s -X POST "$BASE_URL/api/backoffice/orders" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
    -d "{
      \"user_id\": $USER_ID_OF_CLIENT,
      \"branch_id\": $TEST_BRANCH_ID,
      \"total_amount\": $PRICE_VALUE,
      \"details\": [{\"product_id\": $TEST_PRODUCT_ID, \"quantity\": 1, \"unit_price\": $PRICE_VALUE}],
      \"comments\": \"Orden de prueba — script de aceptación BackOffice, cancelar/ignorar en SAP\"
    }")
  ORDER_OK=$(json_get "$ORDER_RESP" "success")
  ORDER_ID=$(json_get "$ORDER_RESP" "data.order_id")
  if [ "$ORDER_OK" = "true" ] && [ -n "$ORDER_ID" ]; then
    ok "Orden creada: order_id=$ORDER_ID"
  else
    fail "Fallo al crear orden BackOffice: $ORDER_RESP"
  fi
else
  fail "Se omite creación de orden (falta user_id de cliente, precio, o product_id resuelto)"
fi

echo ""
echo "======================================================"
if [ -n "$ORDER_ID" ]; then
  echo "Pendiente de verificación manual con SQL/PGAdmin (no se ejecuta aquí, ver metodología):"
  echo "  SELECT order_id, user_id, placed_by_user_id, order_origin, sap_synced, sap_doc_entry"
  echo "  FROM orders WHERE order_id = $ORDER_ID;"
  echo "  -- Esperado: user_id = $USER_ID_OF_CLIENT, placed_by_user_id = <id del admin>, order_origin = 'backoffice'"
  echo ""
  echo "  SELECT * FROM backoffice_actions WHERE target_type = 'order' AND target_id = $ORDER_ID;"
  echo "  SELECT * FROM backoffice_actions ORDER BY created_at DESC LIMIT 10; -- confirmar activate/deactivate/reset también quedaron"
  echo ""
  echo "  -- Para confirmar SalesPersonCode en SAP: disparar POST /api/orders/sync-to-sap (rol 1) y luego"
  echo "  -- consultar Orders(sap_doc_entry) en el Service Layer con \$select=DocEntry,SalesPersonCode"
fi
echo "======================================================"

if [ "$FAIL" -eq 0 ]; then
  echo "RESULTADO: TODO OK (exit 0)"
  exit 0
else
  echo "RESULTADO: HAY FALLAS (exit 1) — revisar los FAIL arriba"
  exit 1
fi
