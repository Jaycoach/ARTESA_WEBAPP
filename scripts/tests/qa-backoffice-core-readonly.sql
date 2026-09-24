-- scripts/tests/qa-backoffice-core-readonly.sql
-- Fase 5 — Verificación de estado en base de datos, SOLO LECTURA.
-- Ningún UPDATE/INSERT/DELETE en este archivo. Seguro correr en Producción o Staging
-- en cualquier momento, no cambia nada.
--
-- Uso: psql -f scripts/tests/qa-backoffice-core-readonly.sql
-- Revisar cada bloque contra el resultado esperado documentado en el comentario.

\echo '=== Caso D12: cero duplicados de correo por mayúsculas en users ==='
-- Esperado: 0 filas (si aparece alguna, D13 no se aplicó o hay un caso nuevo sin fusionar).
SELECT LOWER(mail) AS mail_lower, COUNT(*) AS n, array_agg(id ORDER BY id) AS ids
FROM users
GROUP BY LOWER(mail)
HAVING COUNT(*) > 1;

\echo '=== Caso D12: cero duplicados de correo por mayúsculas en client_branches ==='
-- Esperado: 0 filas.
SELECT LOWER(email_branch) AS email_lower, COUNT(*) AS n, array_agg(branch_id ORDER BY branch_id) AS ids
FROM client_branches
GROUP BY LOWER(email_branch)
HAVING COUNT(*) > 1;

\echo '=== Caso D12: índices únicos por LOWER() existen ==='
-- Esperado: 2 filas (uk_users_mail_lower, uk_client_branches_email_lower).
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname IN ('uk_users_mail_lower', 'uk_client_branches_email_lower');

\echo '=== Caso Fase 1: columnas de inactivación manual existen en users ==='
-- Esperado: 4 filas (deactivated_manually, deactivated_at, deactivated_by, deactivation_reason).
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('deactivated_manually', 'deactivated_at', 'deactivated_by', 'deactivation_reason')
ORDER BY column_name;

\echo '=== Caso Fase 1: roles 3 (FUNCTIONAL_ADMIN) y 4 (BACKOFFICE) existen ==='
-- Esperado: 2 filas.
SELECT id, name FROM roles WHERE id IN (3, 4) ORDER BY id;

\echo '=== Caso Fase 1: tabla backoffice_actions existe con su esquema esperado ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'backoffice_actions'
ORDER BY ordinal_position;

\echo '=== Caso D13: cuentas fusionadas hasta ahora (auditoría, sin PII de contraseña) ==='
-- Muestra cada fusión ya ejecutada: quién la hizo, cuándo, sobre qué cuentas.
SELECT id, admin_user_id, action_type, target_type, target_id, details, created_at
FROM backoffice_actions
WHERE action_type IN ('merge_user_accounts', 'password_replaced_by_merge')
ORDER BY created_at DESC
LIMIT 50;

\echo '=== Caso D13: cuentas absorbidas quedaron inactivas y con correo liberado ==='
-- Esperado: is_active = false, deactivated_manually = true, mail con el patrón
-- fusionado-en-<id>.<local>@invalid.local para cada absorbida registrada arriba.
SELECT id, mail, is_active, deactivated_manually,
  (deactivation_reason IS NOT NULL) AS tiene_motivo
FROM users
WHERE mail LIKE 'fusionado-en-%@invalid.local'
ORDER BY id;

\echo '=== Caso Fase 3 (D5 #4-5): usuarios inactivados manualmente que el sync de SAP NO debe tocar ==='
-- Lista de referencia: cualquier usuario aquí que un sync manual reciente haya
-- reactivado (revisar is_active=true con deactivated_manually=true) sería un bug real.
SELECT id, mail, is_active, deactivated_manually, deactivated_at, deactivation_reason
FROM users
WHERE deactivated_manually = true
ORDER BY deactivated_at DESC NULLS LAST
LIMIT 50;

\echo '=== Caso Fase 3: usuarios inconsistentes (is_active=true pero deactivated_manually=true) ==='
-- Esperado: 0 filas. Si aparece alguna, algo reactivó a un usuario inactivado
-- manualmente sin pasar por activateUser() — investigar antes de desplegar a Producción.
SELECT id, mail, is_active, deactivated_manually, deactivated_at
FROM users
WHERE is_active = true AND deactivated_manually = true;

\echo '=== Caso 6i: tokens de reset de contraseña con expiración != 1 hora desde su creación ==='
-- Esperado tras el fix: expires_at - created_at ~= 1 hora para tokens creados por
-- passwordResetController.requestReset (el único llamador real de PasswordReset.createToken).
-- Una diferencia grande y sistemática indicaría que el fix no se desplegó.
SELECT id, user_id, created_at, expires_at,
       EXTRACT(EPOCH FROM (expires_at - created_at)) / 60 AS minutos_de_vigencia
FROM password_resets
ORDER BY created_at DESC
LIMIT 20;

\echo '=== Caso D3: ningún usuario con rol 4 (BACKOFFICE) más allá de lo esperado ==='
-- BACKOFFICE (4) no tiene capacidades activas en este núcleo (reservado para la
-- publicación futura de gestión de pedidos). Verificar cuántos hay, si alguno.
SELECT id, name, mail, is_active FROM users WHERE rol_id = 4 ORDER BY id;

\echo '=== Fin de la verificación de solo lectura ==='
