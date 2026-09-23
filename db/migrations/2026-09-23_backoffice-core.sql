-- Núcleo del BackOffice: roles 3 y 4, tabla de auditoría backoffice_actions,
-- y columnas de inactivación manual en users.
-- Ref. feature/backoffice-core (extraído de feature/backoffice-module, solo clase A).
-- Idempotente: Staging (artesadb_dev) ya tiene rol 4 y backoffice_actions aplicados
-- desde 2026-09-05_create-backoffice-module.sql; Producción (laartesa) se asume sin
-- ninguno de los dos. Esta migración debe poder correr sin error en ambos casos.
-- Sin BEGIN/COMMIT: la transacción la controla quien la aplique.
--
-- Objetos que crea o altera este archivo:
--   INSERT  roles (id=3, 'FUNCTIONAL_ADMIN')            -- ON CONFLICT (id) DO NOTHING
--   INSERT  roles (id=4, 'BACKOFFICE')                  -- ON CONFLICT (id) DO NOTHING
--   CREATE TABLE backoffice_actions (si no existe)      -- id, admin_user_id, action_type,
--                                                           target_type, target_id, details, created_at
--   CREATE INDEX idx_backoffice_actions_admin_user_id (si no existe)
--   CREATE INDEX idx_backoffice_actions_target (si no existe)
--   ALTER TABLE users ADD COLUMN deactivated_manually BOOLEAN NOT NULL DEFAULT false (si no existe)
--   ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMPTZ NULL (si no existe)
--   ALTER TABLE users ADD COLUMN deactivated_by INTEGER NULL REFERENCES users(id) (si no existe)
--   ALTER TABLE users ADD COLUMN deactivation_reason TEXT NULL (si no existe)

-- 1) Roles FUNCTIONAL_ADMIN (3) y BACKOFFICE (4).
--    FUNCTIONAL_ADMIN (3) ya existe en Staging (usado hoy por authorize([1,3]) en
--    adminRoutes.js) pero nunca quedó registrado en una migración versionada — se
--    declara aquí para que un ambiente limpio (Producción) también lo tenga.
--    BACKOFFICE (4) se crea sin ninguna capacidad asignada en el núcleo (matriz de
--    permisos Fase 0): su alcance se define cuando se publique la gestión de pedidos.
INSERT INTO roles (id, nombre, description)
VALUES (3, 'FUNCTIONAL_ADMIN', 'Administración funcional: configuración y funciones administrativas existentes, sin gestión de usuarios ni sincronizaciones SAP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, nombre, description)
VALUES (4, 'BACKOFFICE', 'Reservado para gestión de pedidos a nombre de clientes (pendiente de autorización de Gerencia). Sin capacidades asignadas en el núcleo del BackOffice.')
ON CONFLICT (id) DO NOTHING;

-- 2) Auditoría obligatoria de toda acción sensible del BackOffice.
--    Esquema IDÉNTICO al de feature/backoffice-module (2026-09-05_create-backoffice-module.sql)
--    para que el rebase de esa rama en la Fase 7 no la duplique ni la altere.
CREATE TABLE IF NOT EXISTS backoffice_actions (
  id              SERIAL        PRIMARY KEY,
  admin_user_id   INTEGER       NOT NULL REFERENCES users(id),
  action_type     VARCHAR(40)   NOT NULL, -- 'activate_client' | 'deactivate_client' | 'reset_branch_password' | 'create_order' | 'create_platform_user' | 'activate_platform_user' | 'deactivate_platform_user' | 'update_admin_settings' | 'trigger_sap_sync'
  target_type     VARCHAR(30)   NOT NULL, -- 'client_profile' | 'client_branch' | 'order' | 'user' | 'admin_settings' | 'sap_sync'
  target_id       INTEGER       NOT NULL,
  details         JSONB,                  -- ej. {"order_id": 123, "client_id": 588, "branch_id": 2600} — nunca contraseñas en texto plano
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backoffice_actions_admin_user_id ON backoffice_actions (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_backoffice_actions_target ON backoffice_actions (target_type, target_id);

COMMENT ON TABLE backoffice_actions IS 'Auditoría de toda acción sensible ejecutada desde el módulo BackOffice.';
COMMENT ON COLUMN backoffice_actions.details IS 'Metadata de la acción en JSON. Nunca debe contener contraseñas ni tokens en texto plano.';

-- 3) Inactivación manual de usuarios de plataforma (Decisión 5).
--    deactivated_manually distingue esta inactivación de la que ya hace el cron SAP
--    (SapClientService.js) al detectar CardType = Lead; el cron debe respetar esta
--    columna y no reactivar a quien fue inactivado manualmente (Fase 3).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivated_manually BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deactivated_by INTEGER NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NULL;

COMMENT ON COLUMN users.deactivated_manually IS 'true si fue inactivado desde el BackOffice (motivo obligatorio); el cron de sincronización SAP no debe reactivar a estos usuarios.';
COMMENT ON COLUMN users.deactivated_at IS 'Fecha/hora de la inactivación manual más reciente.';
COMMENT ON COLUMN users.deactivated_by IS 'users.id del administrador que ejecutó la inactivación manual.';
COMMENT ON COLUMN users.deactivation_reason IS 'Motivo obligatorio de la inactivación manual, capturado en el formulario del BackOffice.';
