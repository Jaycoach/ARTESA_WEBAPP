-- D12: correo NUNCA distingue mayúsculas. Índices únicos case-insensitive para
-- users.mail y client_branches.email_branch, SIN eliminar ningún índice existente
-- (uk_users_mail, idx_users_mail, la UNIQUE(email_branch) exacta e
-- idx_client_branches_email_branch de client_branches se conservan tal cual).
--
-- PRECONDICIÓN OBLIGATORIA — cero duplicados por LOWER(). Verificar ANTES de aplicar:
--   SELECT LOWER(mail), COUNT(*) FROM users GROUP BY LOWER(mail) HAVING COUNT(*) > 1;
--   SELECT LOWER(email_branch), COUNT(*) FROM client_branches
--     GROUP BY LOWER(email_branch) HAVING COUNT(*) > 1;
-- Ambas consultas deben devolver 0 filas antes de continuar. Si la primera devuelve
-- alguna fila en Producción, es el caso ya conocido de ALIANZA JIMENEZ SAS (ids 48/1505):
-- debe resolverse con el script de fusión D13 ANTES de esta migración.
--
-- Orden obligatorio en Producción:
--   1. Migración del núcleo (2026-09-23_backoffice-core.sql) — ya VALIDADO EN STAGING.
--   2. Script de fusión D13 (id 1505 -> 48).
--   3. Verificación de cero duplicados (consultas de arriba).
--   4. ESTA migración.
--   5. Despliegue del código con LOWER() en las comparaciones de correo (D12).
--
-- En Staging (artesadb_dev), confirmado sin duplicados en users: se puede aplicar
-- directamente, sin paso de fusión previo.

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_mail_lower ON users (LOWER(mail));
CREATE UNIQUE INDEX IF NOT EXISTS uk_client_branches_email_lower ON client_branches (LOWER(email_branch));
