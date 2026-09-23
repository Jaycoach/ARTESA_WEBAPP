const pool = require('../../config/db');
const { createContextLogger } = require('../../config/logger');
const ROLES = require('../../constants/roles');
const Order = require('../../models/Order');
const clientProfileController = require('../clientProfileController');
const userStatusService = require('../../services/backofficeCore/userStatusService');
const { UserStatusError } = userStatusService;

const logger = createContextLogger('ClientsController');

const CLIENT_SCOPE_ROLES = [ROLES.USER];

function handleUserStatusError(res, error, actionLabel) {
  if (error instanceof UserStatusError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  logger.error(`Error al ${actionLabel}`, { error: error.message, stack: error.stack });
  return res.status(500).json({ success: false, message: 'Error interno del servidor' });
}

function parsePositiveIntId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * GET /api/backoffice/clients
 * Delegación pura: mismo controller/endpoint que alimenta ClientList.jsx.
 */
const listClients = clientProfileController.getAllProfiles;

/**
 * GET /api/backoffice/clients/without-profile
 * Usuarios rol 2 SIN client_profiles (getAll/getAllProfiles no los trae, por su JOIN).
 * Necesarios para poder inactivar/reactivar a cualquier cliente, tenga o no perfil.
 */
const listClientsWithoutProfile = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.mail, u.is_active, u.email_verified,
              u.deactivated_manually, u.deactivated_at, u.deactivation_reason, u.created_at
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.rol_id = $1 AND cp.client_id IS NULL
       ORDER BY u.created_at DESC`,
      [ROLES.USER]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error al listar clientes sin perfil', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al listar clientes sin perfil' });
  }
};

/**
 * Pedidos pendientes de un cliente, en dos conteos según status_id/sap_synced.
 * Reutiliza Order.FINAL_ORDER_STATES (Order.js) como única fuente de verdad.
 */
async function countPendingOrders(userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status_id != ALL($2::int[]))::int AS pending_orders,
       COUNT(*) FILTER (
         WHERE status_id != ALL($2::int[]) AND (sap_synced = false OR sap_synced IS NULL)
       )::int AS pending_orders_not_synced
     FROM orders
     WHERE user_id = $1`,
    [userId, Order.FINAL_ORDER_STATES]
  );
  return { pending_orders: rows[0].pending_orders, pending_orders_not_synced: rows[0].pending_orders_not_synced };
}

async function countBranches(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE cb.is_login_enabled = true)::int AS login_enabled
     FROM client_branches cb
     JOIN client_profiles cp ON cb.client_id = cp.client_id
     WHERE cp.user_id = $1`,
    [userId]
  );
  return { total: rows[0].total, login_enabled: rows[0].login_enabled };
}

/**
 * GET /api/backoffice/clients/:userId/deactivation-preview
 * Solo lectura. Funciona con o sin client_profiles (COUNT da 0, no falla).
 */
const getDeactivationPreview = async (req, res) => {
  try {
    const userId = parsePositiveIntId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const { rows: userRows } = await pool.query(`SELECT id, rol_id FROM users WHERE id = $1`, [userId]);
    if (userRows.length === 0 || userRows[0].rol_id !== ROLES.USER) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    const orders = await countPendingOrders(userId);
    const branches = await countBranches(userId);

    return res.status(200).json({
      success: true,
      data: {
        pending_orders: orders.pending_orders,
        pending_orders_not_synced: orders.pending_orders_not_synced,
        branches: branches.total,
        branches_login_enabled: branches.login_enabled
      }
    });
  } catch (error) {
    logger.error('Error al calcular vista previa de inactivación', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al calcular vista previa' });
  }
};

/**
 * POST /api/backoffice/clients/:userId/deactivate
 * body: { reason }
 */
const deactivateClient = async (req, res) => {
  try {
    const targetId = parsePositiveIntId(req.params.userId);
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    // Recalculado en el momento de la acción, no el de la vista previa (puede haber cambiado).
    const orders = await countPendingOrders(targetId);
    const branches = await countBranches(targetId);

    const result = await userStatusService.deactivateUser({
      actorId: req.user.id,
      targetId,
      reason: req.body.reason,
      scopeRoles: CLIENT_SCOPE_ROLES,
      scopeLabel: 'client',
      extraDetails: {
        pending_orders: orders.pending_orders,
        pending_orders_not_synced: orders.pending_orders_not_synced,
        branches: branches.total,
        branches_login_enabled: branches.login_enabled
      }
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleUserStatusError(res, error, 'inactivar cliente');
  }
};

/**
 * POST /api/backoffice/clients/:userId/activate
 * Solo deshace inactivaciones manuales (userStatusService.activateUser ya lo garantiza).
 */
const activateClient = async (req, res) => {
  try {
    const targetId = parsePositiveIntId(req.params.userId);
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const result = await userStatusService.activateUser({
      actorId: req.user.id,
      targetId,
      scopeRoles: CLIENT_SCOPE_ROLES,
      scopeLabel: 'client'
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleUserStatusError(res, error, 'reactivar cliente');
  }
};

module.exports = {
  listClients,
  listClientsWithoutProfile,
  getDeactivationPreview,
  deactivateClient,
  activateClient
};
