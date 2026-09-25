-- db/scripts/merge-duplicate-users.sql
-- D13 — Fusión de cuentas duplicadas por correo con distinta capitalización.
-- NUNCA borra filas: la cuenta absorbida se inactiva y se le libera el correo.
--
-- Parametrizado con variables psql. Uso:
--   psql -v canonical_id=48 -v absorbed_id=1505 -v admin_id=1 -f merge-duplicate-users.sql
--
-- Para Producción (caso ya conocido, ALIANZA JIMENEZ SAS):
--   psql -v canonical_id=48 -v absorbed_id=1505 -v admin_id=1 -f merge-duplicate-users.sql
--
-- MODO ENSAYO (nunca toca datos, se revierte siempre): ejecutar la misma invocación
-- pero reemplazando el COMMIT final por ROLLBACK, sin editar el archivo:
--   sed 's/^COMMIT;$/ROLLBACK;/' db/scripts/merge-duplicate-users.sql | \
--     psql -v canonical_id=48 -v absorbed_id=1505 -v admin_id=1
-- Revisar los RAISE NOTICE / SELECT de verificación antes de confiar en el resultado;
-- si algo se ve mal, no se necesita deshacer nada porque nunca se aplicó ROLLBACK real.
--
-- MODO REAL: la misma invocación, tal cual el archivo (termina en COMMIT).
--
-- Columna de contraseña validada contra information_schema.columns: 'password'
-- (users.password, character varying). Confirmar de nuevo si el esquema cambiara.

\set ON_ERROR_STOP on

BEGIN;

-- 0) Validar que ambos ids existen y capturar su estado previo (para la auditoría y
--    para el SQL inverso). Aborta si alguno no existe.
--    psql NO interpola variables :nombre dentro de bloques DO $$ ... $$ (igual que no
--    interpola dentro de comillas simples) — se fijan como parámetros de sesión con
--    set_config() y se leen dentro del bloque con current_setting()::int. Fuera de los
--    DO $$ ... $$ (todo el resto del script, SQL plano) la interpolación :nombre normal
--    de psql sí funciona y no se toca.
SELECT set_config('app.canonical_id', :'canonical_id', true);
SELECT set_config('app.absorbed_id', :'absorbed_id', true);

DO $$
DECLARE
  v_canonical_id integer := current_setting('app.canonical_id')::int;
  v_absorbed_id integer := current_setting('app.absorbed_id')::int;
  v_canonical_exists boolean;
  v_absorbed_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM users WHERE id = v_canonical_id) INTO v_canonical_exists;
  SELECT EXISTS(SELECT 1 FROM users WHERE id = v_absorbed_id) INTO v_absorbed_exists;

  IF NOT v_canonical_exists THEN
    RAISE EXCEPTION 'Cuenta canónica % no existe', v_canonical_id;
  END IF;
  IF NOT v_absorbed_exists THEN
    RAISE EXCEPTION 'Cuenta absorbida % no existe', v_absorbed_id;
  END IF;
  IF v_canonical_id = v_absorbed_id THEN
    RAISE EXCEPTION 'canonical_id y absorbed_id no pueden ser el mismo (%)', v_canonical_id;
  END IF;
END $$;

-- 1) Capturar estado previo en una tabla temporal (solo dentro de esta transacción),
--    para poder auditar y para documentar el SQL inverso con valores reales.
CREATE TEMP TABLE merge_previous_state AS
SELECT
  (SELECT mail FROM users WHERE id = :canonical_id)     AS canonical_mail_before,
  (SELECT password FROM users WHERE id = :canonical_id) AS canonical_password_before,
  (SELECT mail FROM users WHERE id = :absorbed_id)       AS absorbed_mail_before,
  (SELECT password FROM users WHERE id = :absorbed_id)   AS absorbed_password_before,
  (SELECT is_active FROM users WHERE id = :absorbed_id)  AS absorbed_is_active_before;

-- 2) Copiar el hash de la contraseña de la cuenta absorbida a la canónica (el cliente
--    la definió el 23-sep-2026 en la absorbida y es la que recuerda).
UPDATE users
SET password = (SELECT absorbed_password_before FROM merge_previous_state)
WHERE id = :canonical_id;

-- 3) Cuenta absorbida: libera el correo (sin borrar la fila), inactiva manualmente.
--    El nuevo mail usa el correo original en minúsculas como parte local, para que
--    sea legible y trazable, y nunca colisiona con uk_users_mail_lower porque el
--    dominio @invalid.local no puede repetirse con un correo real.
UPDATE users
SET
  mail = 'fusionado-en-' || :canonical_id || '.' ||
         split_part((SELECT absorbed_mail_before FROM merge_previous_state), '@', 1) ||
         '@invalid.local',
  is_active = false,
  deactivated_manually = true,
  deactivated_at = now(),
  deactivated_by = :admin_id,
  deactivation_reason = 'Cuenta fusionada en id ' || :canonical_id ||
    ' (mismo cliente; correo con distinta capitalización). Correo original: ' ||
    (SELECT absorbed_mail_before FROM merge_previous_state)
WHERE id = :absorbed_id;

-- 4) Revocar tokens vigentes de AMBAS cuentas (la 48 porque su contraseña cambió; la
--    1505 porque queda inactiva). Mismo esquema que TokenRevocation.revokeAllUserTokens
--    (middleware/tokenRevocation.js): un registro "all_tokens_*" por usuario.
INSERT INTO revoked_tokens (token_hash, user_id, revoked_at, expires_at, revocation_reason, revoke_all_before)
VALUES
  ('all_tokens_' || :canonical_id || '_' || extract(epoch FROM now())::bigint || '_merge',
   :canonical_id, now(), now() + INTERVAL '30 days', 'password_replaced_by_merge', now()),
  ('all_tokens_' || :absorbed_id || '_' || extract(epoch FROM now())::bigint || '_merge',
   :absorbed_id, now(), now() + INTERVAL '30 days', 'merge_user_accounts', now());

-- 5) Auditoría en backoffice_actions (nunca contraseñas en texto plano — solo el hash
--    previo de la canónica, ya hasheado con bcrypt, se guarda como referencia técnica
--    del rollback, igual que cualquier otro hash almacenado en users.password).
INSERT INTO backoffice_actions (admin_user_id, action_type, target_type, target_id, details)
VALUES
  (:admin_id, 'merge_user_accounts', 'user', :absorbed_id,
   jsonb_build_object(
     'merged_into', :canonical_id,
     'original_mail', (SELECT absorbed_mail_before FROM merge_previous_state),
     'password_source', :absorbed_id
   )),
  (:admin_id, 'password_replaced_by_merge', 'user', :canonical_id,
   jsonb_build_object(
     'source_user_id', :absorbed_id,
     'previous_password_hash', (SELECT canonical_password_before FROM merge_previous_state)
   ));

-- 6) Verificación final: cero duplicados por LOWER(mail) después de la fusión.
DO $$
DECLARE
  v_dup_count integer;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT LOWER(mail) FROM users GROUP BY LOWER(mail) HAVING COUNT(*) > 1
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Verificación final falló: quedan % grupo(s) de mail duplicados por LOWER()', v_dup_count;
  END IF;

  RAISE NOTICE 'Verificación final OK: 0 duplicados por LOWER(mail) tras la fusión.';
END $$;

-- 7) Resumen legible para revisar antes de confiar en el COMMIT.
SELECT
  :canonical_id AS canonical_id,
  (SELECT mail FROM users WHERE id = :canonical_id) AS canonical_mail_after,
  :absorbed_id AS absorbed_id,
  (SELECT mail FROM users WHERE id = :absorbed_id) AS absorbed_mail_after,
  (SELECT is_active FROM users WHERE id = :absorbed_id) AS absorbed_is_active_after,
  (SELECT deactivated_manually FROM users WHERE id = :absorbed_id) AS absorbed_deactivated_manually_after;

-- MODO REAL: esta línea aplica los cambios. Para ensayo, reemplazarla por ROLLBACK
-- con el comando sed documentado arriba, SIN editar este archivo.
COMMIT;

-- =========================================================================
-- SQL INVERSO (documentado, no se ejecuta automáticamente). Requiere los valores
-- reales de merge_previous_state, que solo existen dentro de la transacción de
-- arriba — por eso este bloque usa marcadores <...> a rellenar a mano con lo que
-- muestre el SELECT de resumen y con el previous_password_hash guardado en
-- backoffice_actions.details (acción password_replaced_by_merge, target = canonical_id).
-- =========================================================================
-- BEGIN;
-- UPDATE users SET password = '<canonical_password_before, desde backoffice_actions.details>'
--   WHERE id = <canonical_id>;
-- UPDATE users SET
--   mail = '<absorbed_mail_before, desde backoffice_actions.details.original_mail>',
--   is_active = '<absorbed_is_active_before>',
--   deactivated_manually = false,
--   deactivated_at = NULL,
--   deactivated_by = NULL,
--   deactivation_reason = NULL
-- WHERE id = <absorbed_id>;
-- INSERT INTO backoffice_actions (admin_user_id, action_type, target_type, target_id, details)
-- VALUES (<admin_id>, 'merge_user_accounts_reverted', 'user', <absorbed_id>,
--   jsonb_build_object('reverted_merge_with', <canonical_id>));
-- COMMIT;
