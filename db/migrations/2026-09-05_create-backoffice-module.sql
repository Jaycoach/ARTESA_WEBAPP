-- Módulo BackOffice: rol nuevo, columnas de trazabilidad en orders, y tabla de auditoría.
-- Ref. feature/backoffice-module. NO aplicar contra producción sin aprobación explícita.
--
-- IMPORTANTE antes de correr esto: confirmar por PGAdmin contra artesadb_dev (staging)
-- que id=4 en la tabla `roles` está libre:
--   SELECT id, nombre FROM roles ORDER BY id;
-- Si 4 ya existe, ajustar el valor de este INSERT antes de aplicar.

-- 1) Rol nuevo BACKOFFICE (mismo patrón que ADMIN/USER/FUNCTIONAL_ADMIN: fila en `roles`,
--    consumida dinámicamente por src/models/Roles.js; los checkRole()/authorize() de las
--    rutas nuevas de Fase 2 usarán el entero 4 explícitamente, igual que el resto del proyecto).
INSERT INTO roles (id, nombre, description)
VALUES (4, 'BACKOFFICE', 'Gestión de clientes/sucursales y creación de pedidos a nombre de un cliente, sin sucursales propias asociadas')
ON CONFLICT (id) DO NOTHING;

-- 2) Trazabilidad de "quién creó la orden" vs "de quién es la orden".
--    orders.user_id sigue siendo el cliente real (dueño de la orden, usado por
--    SapOrderService.js para resolver CardCode) — placed_by_user_id es el admin
--    BackOffice que la creó en su nombre. NULL = orden self-service (no tocada por BackOffice).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS placed_by_user_id INTEGER NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS order_origin VARCHAR(20) NOT NULL DEFAULT 'self_service';

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_order_origin CHECK (order_origin IN ('self_service', 'backoffice'));

CREATE INDEX IF NOT EXISTS idx_orders_placed_by_user_id ON orders (placed_by_user_id) WHERE placed_by_user_id IS NOT NULL;

COMMENT ON COLUMN orders.placed_by_user_id IS 'Admin BackOffice que creó la orden a nombre del cliente (users.id). NULL si la orden es self-service.';
COMMENT ON COLUMN orders.order_origin IS 'self_service (cliente/sucursal crea su propia orden) | backoffice (admin la crea a nombre de un cliente).';

-- 3) Auditoría obligatoria de toda acción sensible del módulo BackOffice.
--    target_type/target_id son polimórficos a propósito (client_profile, client_branch, order)
--    -- no hay una sola tabla destino posible, así que no se usa FK real, igual que otros
--    logs de auditoría del proyecto.
CREATE TABLE IF NOT EXISTS backoffice_actions (
  id              SERIAL        PRIMARY KEY,
  admin_user_id   INTEGER       NOT NULL REFERENCES users(id),
  action_type     VARCHAR(40)   NOT NULL, -- 'activate_client' | 'deactivate_client' | 'reset_branch_password' | 'create_order'
  target_type     VARCHAR(30)   NOT NULL, -- 'client_profile' | 'client_branch' | 'order'
  target_id       INTEGER       NOT NULL,
  details         JSONB,                  -- ej. {"order_id": 123, "client_id": 588, "branch_id": 2600} — nunca contraseñas en texto plano
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backoffice_actions_admin_user_id ON backoffice_actions (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_backoffice_actions_target ON backoffice_actions (target_type, target_id);

COMMENT ON TABLE backoffice_actions IS 'Auditoría de toda acción sensible ejecutada desde el módulo BackOffice (activar/inactivar cliente, reset de password, creación de orden a nombre de un cliente).';
COMMENT ON COLUMN backoffice_actions.details IS 'Metadata de la acción en JSON. Nunca debe contener contraseñas ni tokens en texto plano.';
