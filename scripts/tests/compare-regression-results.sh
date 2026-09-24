#!/usr/bin/env bash
# scripts/tests/compare-regression-results.sh
# Compara dos salidas de backoffice-core-regression.sh (antes/después) y marca
# cada línea con diferencia como "ESPERADA (decisión X)" o "NO EXPLICADA".
#
# Uso: ./scripts/tests/compare-regression-results.sh antes.txt despues.txt

set -uo pipefail

ANTES="${1:?Uso: compare-regression-results.sh <antes.txt> <despues.txt>}"
DESPUES="${2:?Uso: compare-regression-results.sh <antes.txt> <despues.txt>}"

[ -f "$ANTES" ] || { echo "No existe $ANTES"; exit 1; }
[ -f "$DESPUES" ] || { echo "No existe $DESPUES"; exit 1; }

# Tabla de diferencias esperadas: patrón de la línea (label) -> explicación.
# Si una línea con este label cambia entre antes/después, es esperado.
declare -A EXPECTED=(
  ["9bis:can-create-ajeno"]="Esperado (checkpoint 9-bis, commit cb026a2): antes 200/lo-que-sea, ahora 403 - restricción intencional de seguridad, GET /orders/can-create/:userId ya no permite consultar el estado de otro usuario."
  ["D6:secure-product-routes"]="Esperado (D6, archivo 8): secureProductRoutes.js desmontado, 0 peticiones reales en Prod/Staging - /api/secure/* pasa a 404."
  ["backoffice:sync-status:FUNC_ADMIN"]="Esperado (D3, matriz de permisos): FUNCTIONAL_ADMIN no tiene sap_sync.view - 403 en /api/backoffice/sync/*, aunque en /api/backoffice/settings sí tenga 200."
  ["1:usuarios:FUNC_ADMIN"]="Esperado (D3): FUNCTIONAL_ADMIN no tiene platform_users.manage - 403 en GET /api/users."
  ["1:sync-status:FUNC_ADMIN"]="Esperado (D3): FUNCTIONAL_ADMIN no tiene sap_sync.view - 403 en /api/client-sync/status."
  ["backoffice:platform-users:FUNC_ADMIN"]="Esperado (D3): FUNCTIONAL_ADMIN no tiene platform_users.manage - 403."
)

echo "=== Comparación $ANTES vs $DESPUES — $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo

# Empareja líneas por su "label" (primer campo antes del primer " | ").
join_by_label() {
  local file="$1"
  grep -E '^\S.* \| ' "$file" | while IFS='|' read -r label rest; do
    label="$(echo "$label" | xargs)"
    echo "${label}||${rest}"
  done
}

declare -A ANTES_MAP DESPUES_MAP
while IFS= read -r line; do
  key="${line%%||*}"
  val="${line#*||}"
  ANTES_MAP["$key"]="$val"
done < <(join_by_label "$ANTES")

while IFS= read -r line; do
  key="${line%%||*}"
  val="${line#*||}"
  DESPUES_MAP["$key"]="$val"
done < <(join_by_label "$DESPUES")

any_unexplained=0

for key in "${!ANTES_MAP[@]}"; do
  a="${ANTES_MAP[$key]}"
  d="${DESPUES_MAP[$key]:-<<AUSENTE EN DESPUES>>}"
  if [ "$a" != "$d" ]; then
    # ¿El label coincide con alguna clave conocida de EXPECTED (por prefijo)?
    explanation=""
    for pattern in "${!EXPECTED[@]}"; do
      if [[ "$key" == *"$pattern"* ]]; then
        explanation="${EXPECTED[$pattern]}"
        break
      fi
    done
    if [ -n "$explanation" ]; then
      echo "[ESPERADA] $key"
      echo "  antes:    $a"
      echo "  después:  $d"
      echo "  razón:    $explanation"
    else
      any_unexplained=1
      echo "[NO EXPLICADA] $key"
      echo "  antes:    $a"
      echo "  después:  $d"
    fi
    echo
  fi
done

for key in "${!DESPUES_MAP[@]}"; do
  if [ -z "${ANTES_MAP[$key]:-}" ]; then
    echo "[NUEVO EN DESPUES, no estaba en la línea base] $key"
    echo "  después: ${DESPUES_MAP[$key]}"
    echo
  fi
done

echo "=== Fin de la comparación ==="
if [ "$any_unexplained" -eq 1 ]; then
  echo "HAY DIFERENCIAS NO EXPLICADAS — revisar antes de aprobar la Fase 5."
  exit 1
else
  echo "Todas las diferencias encontradas están explicadas por una decisión documentada."
  exit 0
fi
