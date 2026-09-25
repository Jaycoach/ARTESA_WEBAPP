-- db/scripts/merge-duplicate-users-staging-synthetic-test.sql
-- D13 — Prueba end-to-end del script de fusión en Staging (artesadb_dev), SIN tocar
-- datos reales y SIN dejar rastro: todo corre en una única transacción que termina
-- en ROLLBACK. DDL es transaccional en PostgreSQL, así que el DROP INDEX temporal
-- nunca se aplica de verdad fuera de esta transacción.
--
-- Por qué hace falta el DROP temporal: uk_users_mail_lower (D12, ya VALIDADO EN
-- STAGING) impide crear un par sintético con el mismo correo en distinta
-- capitalización directamente. Se baja el índice, se crea el par, se corre la
-- fusión completa (los mismos pasos de merge-duplicate-users.sql, inline), se
-- verifica, y se ROLLBACK — el índice nunca deja de existir para nadie más
-- porque el DROP jamás se confirma.
--
-- Uso: psql -f merge-duplicate-users-staging-synthetic-test.sql
-- (sin -v: los ids se generan dentro del propio script con nextval)

\set ON_ERROR_STOP on

BEGIN;

DROP INDEX uk_users_mail_lower;

-- Crear el par sintético (mismo correo, distinta capitalización). rol_id=2 (USER),
-- password de prueba generada en runtime con md5(random()) (nunca literal, no
-- requiere la extensión pgcrypto — ver regla de credenciales del proyecto).
INSERT INTO users (name, mail, password, rol_id, is_active, email_verified)
VALUES ('Sintético Merge Test A', 'sintetico.merge.test.d13@example.com',
        md5(random()::text || clock_timestamp()::text), 2, true, true)
RETURNING id \gset canonical_

INSERT INTO users (name, mail, password, rol_id, is_active, email_verified)
VALUES ('Sintético Merge Test B', 'Sintetico.Merge.Test.D13@example.com',
        md5(random()::text || clock_timestamp()::text), 2, true, true)
RETURNING id \gset absorbed_

\echo 'Par sintético creado: canonical=' :canonical_id ' absorbed=' :absorbed_id

-- ---- A partir de aquí, los mismos pasos de merge-duplicate-users.sql ----
-- (canonical_id y absorbed_id ya quedaron definidos por los \gset de arriba)
\set admin_id 1

CREATE TEMP TABLE merge_previous_state AS
SELECT
  (SELECT mail FROM users WHERE id = :canonical_id)     AS canonical_mail_before,
  (SELECT password FROM users WHERE id = :canonical_id) AS canonical_password_before,
  (SELECT mail FROM users WHERE id = :absorbed_id)       AS absorbed_mail_before,
  (SELECT password FROM users WHERE id = :absorbed_id)   AS absorbed_password_before,
  (SELECT is_active FROM users WHERE id = :absorbed_id)  AS absorbed_is_active_before;

UPDATE users
SET password = (SELECT absorbed_password_before FROM merge_previous_state)
WHERE id = :canonical_id;

UPDATE users
SET
  mail = 'fusionado-en-' || :canonical_id || '.' ||
         split_part((SELECT absorbed_mail_before FROM merge_previous_state), '@', 1) ||
         '@invalid.local',
  is_active = false,
  deactivated_manually = true,
  deactivated_at = now(),
  deactivated_by = :admin_id,
  deactivation_reason = 'PRUEBA D13 — fusionado en id ' || :canonical_id
WHERE id = :absorbed_id;

INSERT INTO backoffice_actions (admin_user_id, action_type, target_type, target_id, details)
VALUES
  (:admin_id, 'merge_user_accounts', 'user', :absorbed_id,
   jsonb_build_object('merged_into', :canonical_id, 'test', true)),
  (:admin_id, 'password_replaced_by_merge', 'user', :canonical_id,
   jsonb_build_object('source_user_id', :absorbed_id, 'test', true));

-- Recrear el índice DESPUÉS de la fusión (ya renombrado el correo de la cuenta
-- absorbida arriba): el escenario real de D13 es exactamente este — un duplicado
-- ya existente ANTES de que el índice único de D12 exista, que la fusión resuelve
-- justo antes de que la migración de D12 pueda aplicarse. Recrearlo antes de la
-- fusión (como hacía una versión anterior de este script) siempre falla, porque
-- en ese punto los dos correos sintéticos todavía son duplicados por LOWER() —
-- error real encontrado al correr esta prueba en Staging: "could not create
-- unique index... Key (lower(mail::text))=(...) is duplicated."
CREATE UNIQUE INDEX uk_users_mail_lower ON users (LOWER(mail));

-- Verificación: login con AMBAS capitalizaciones debe resolver a la cuenta canónica.
SELECT id, mail FROM users WHERE LOWER(mail) = LOWER('sintetico.merge.test.d13@example.com');
SELECT id, mail FROM users WHERE LOWER(mail) = LOWER('SINTETICO.MERGE.TEST.D13@EXAMPLE.COM');

-- Verificación: 0 duplicados por LOWER(mail).
SELECT COUNT(*) AS duplicados_restantes FROM (
  SELECT LOWER(mail) FROM users GROUP BY LOWER(mail) HAVING COUNT(*) > 1
) dups;

\echo 'Si ambas consultas de arriba devuelven la cuenta canónica y duplicados_restantes=0, la prueba fue exitosa.'
\echo 'Este ROLLBACK deshace TODO (par sintético, auditoría de prueba, y el DROP/CREATE del índice nunca se aplicó de verdad).'

ROLLBACK;
