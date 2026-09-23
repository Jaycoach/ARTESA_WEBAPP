const pool = require('../../config/db');
const ROLES = require('../../constants/roles');
const { TokenRevocation } = require('../../middleware/tokenRevocation');
const BackofficeAction = require('../../models/BackofficeAction');

class UserStatusError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = 'UserStatusError';
    this.status = status;
    this.code = code;
  }
}

function assertValidActorAndTarget(actorId, targetId) {
  const actor = Number(actorId);
  const target = Number(targetId);
  if (!Number.isInteger(actor) || actor <= 0) {
    throw new UserStatusError(400, 'actorId inválido');
  }
  if (!Number.isInteger(target) || target <= 0) {
    throw new UserStatusError(400, 'targetId inválido');
  }
  return { actor, target };
}

function assertValidScopeRoles(scopeRoles) {
  if (!Array.isArray(scopeRoles) || scopeRoles.length === 0 ||
      !scopeRoles.every((r) => Number.isInteger(r))) {
    // Error de programación del llamador (controller mal configurado), no un 4xx de usuario.
    throw new Error('userStatusService: scopeRoles debe ser un arreglo no vacío de enteros');
  }
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
    if (error instanceof UserStatusError) throw error;
    if (error.code === '40P01' || error.code === '55P03') {
      throw new UserStatusError(409, 'Operación concurrente, reintente', error.code);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Bloquea PRIMERO el conjunto completo de ADMIN activos (si el alcance puede incluir
 * ADMIN), en el mismo orden en toda operación, para que dos transacciones concurrentes
 * nunca puedan cruzar el orden de locks entre "el conjunto de admins" y "la fila objetivo".
 * @returns {Array|null} Filas de ADMIN activos ya bloqueadas, o null si el alcance no incluye ADMIN.
 */
async function lockActiveAdminSetIfInScope(client, scopeRoles) {
  if (!scopeRoles.includes(ROLES.ADMIN)) return null;
  const { rows } = await client.query(
    `SELECT id FROM users WHERE rol_id = $1 AND is_active = true ORDER BY id FOR NO KEY UPDATE`,
    [ROLES.ADMIN]
  );
  return rows;
}

/**
 * Inactiva un usuario dentro del alcance de rol dado. Motivo obligatorio.
 * Admite inactivar a alguien que ya estaba inactivo pero no manualmente (p.ej. un
 * cliente pendiente): marca deactivated_manually sin tocar is_active ni revocar tokens.
 * @param {object} params
 * @param {number} params.actorId
 * @param {number} params.targetId
 * @param {string} params.reason - obligatorio, no vacío tras trim()
 * @param {number[]} params.scopeRoles - rol_id permitidos en este endpoint (p.ej. [1,3,4] o [2])
 * @param {string} params.scopeLabel - 'platform_user' | 'client', para la auditoría
 * @param {object} [params.extraDetails] - se fusiona en backoffice_actions.details (no puede
 *   sobrescribir los campos propios del servicio: scope, reason, previous_rol_id, previous_state)
 */
async function deactivateUser({ actorId, targetId, reason, scopeRoles, scopeLabel, extraDetails = {} }) {
  const { actor, target: targetIdNum } = assertValidActorAndTarget(actorId, targetId);
  assertValidScopeRoles(scopeRoles);
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw new UserStatusError(400, 'El motivo de inactivación es obligatorio');
  }
  if (actor === targetIdNum) {
    throw new UserStatusError(400, 'No puede inactivarse a sí mismo');
  }

  return withTransaction(async (client) => {
    // Orden de locks fijo: primero el conjunto de ADMIN activos, después la fila objetivo.
    const activeAdminRows = await lockActiveAdminSetIfInScope(client, scopeRoles);

    const { rows } = await client.query(
      `SELECT id, rol_id, is_active, deactivated_manually
       FROM users
       WHERE id = $1 AND rol_id = ANY($2::int[])
       FOR NO KEY UPDATE`,
      [targetIdNum, scopeRoles]
    );
    if (rows.length === 0) throw new UserStatusError(404, 'Usuario no encontrado');
    const target = rows[0];

    if (!target.is_active && target.deactivated_manually) {
      throw new UserStatusError(409, 'El usuario ya está inactivado');
    }

    if (target.is_active && target.rol_id === ROLES.ADMIN) {
      if (activeAdminRows.length <= 1) {
        throw new UserStatusError(409, 'No se puede dejar al sistema sin ningún ADMIN activo');
      }
    }

    if (target.is_active) {
      await client.query(
        `UPDATE users
         SET is_active = false,
             deactivated_manually = true,
             deactivated_at = NOW(),
             deactivated_by = $2,
             deactivation_reason = $3
         WHERE id = $1`,
        [targetIdNum, actor, cleanReason]
      );
      await TokenRevocation.revokeAllUserTokens(targetIdNum, 'backoffice_deactivation', client);
    } else {
      // is_active ya era false y deactivated_manually era false (p.ej. cliente pendiente):
      // solo marcamos el flag manual, sin tocar is_active ni revocar tokens (no hay sesión válida).
      await client.query(
        `UPDATE users
         SET deactivated_manually = true,
             deactivated_at = NOW(),
             deactivated_by = $2,
             deactivation_reason = $3
         WHERE id = $1`,
        [targetIdNum, actor, cleanReason]
      );
    }

    await BackofficeAction.log({
      adminUserId: actor,
      actionType: 'deactivate_user',
      targetType: 'user',
      targetId: targetIdNum,
      details: {
        ...extraDetails,
        scope: scopeLabel,
        reason: cleanReason,
        previous_rol_id: target.rol_id,
        previous_state: target.is_active ? 'active' : 'inactive_not_manual'
      }
    }, client);

    return { id: targetIdNum, is_active: false, deactivated_manually: true };
  });
}

/**
 * Reactiva un usuario. Solo deshace inactivaciones MANUALES (deactivated_manually = true);
 * si el usuario está inactivo por el flujo habitual (p.ej. cliente pendiente sin activar
 * manualmente todavía), no interviene aquí.
 */
async function activateUser({ actorId, targetId, scopeRoles, scopeLabel }) {
  const { actor, target: targetIdNum } = assertValidActorAndTarget(actorId, targetId);
  assertValidScopeRoles(scopeRoles);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, is_active, deactivated_manually
       FROM users WHERE id = $1 AND rol_id = ANY($2::int[]) FOR NO KEY UPDATE`,
      [targetIdNum, scopeRoles]
    );
    if (rows.length === 0) throw new UserStatusError(404, 'Usuario no encontrado');
    const target = rows[0];

    if (target.is_active) {
      throw new UserStatusError(409, 'El usuario ya está activo');
    }
    if (!target.deactivated_manually) {
      throw new UserStatusError(409, 'Este usuario no fue inactivado manualmente; su activación sigue el flujo habitual');
    }

    const { rowCount } = await client.query(
      `UPDATE users
       SET is_active = true,
           deactivated_manually = false,
           deactivated_at = NULL,
           deactivated_by = NULL,
           deactivation_reason = NULL
       WHERE id = $1 AND deactivated_manually = true`,
      [targetIdNum]
    );
    if (rowCount === 0) {
      // Defensa en profundidad: el FOR NO KEY UPDATE ya lo impide, pero si algo cambiara
      // entre el SELECT y el UPDATE, no dejamos pasar una reactivación silenciosa.
      throw new UserStatusError(409, 'Operación concurrente, reintente');
    }

    await BackofficeAction.log({
      adminUserId: actor,
      actionType: 'activate_user',
      targetType: 'user',
      targetId: targetIdNum,
      details: { scope: scopeLabel }
    }, client);

    return { id: targetIdNum, is_active: true, deactivated_manually: false };
  });
}

/**
 * Cambia el rol de un usuario de plataforma, solo entre ADMIN(1) y FUNCTIONAL_ADMIN(3).
 */
async function changeRole({ actorId, targetId, newRoleId }) {
  const { actor, target: targetIdNum } = assertValidActorAndTarget(actorId, targetId);
  const newRole = Number(newRoleId);
  if (![ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN].includes(newRole)) {
    throw new UserStatusError(400, 'Rol inválido; solo se permite ADMIN o FUNCTIONAL_ADMIN');
  }
  if (actor === targetIdNum) {
    throw new UserStatusError(400, 'No puede cambiar su propio rol');
  }

  const scopeRoles = [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN];

  return withTransaction(async (client) => {
    // Mismo orden de locks que deactivateUser: primero el conjunto de ADMIN activos.
    const activeAdminRows = await lockActiveAdminSetIfInScope(client, scopeRoles);

    const { rows } = await client.query(
      `SELECT id, rol_id, is_active
       FROM users
       WHERE id = $1 AND rol_id = ANY($2::int[])
       FOR NO KEY UPDATE`,
      [targetIdNum, scopeRoles]
    );
    if (rows.length === 0) throw new UserStatusError(404, 'Usuario no encontrado');
    const target = rows[0];
    if (target.rol_id === newRole) throw new UserStatusError(409, 'El usuario ya tiene ese rol');

    if (target.rol_id === ROLES.ADMIN && target.is_active) {
      if (activeAdminRows.length <= 1) {
        throw new UserStatusError(409, 'No se puede quitar el rol ADMIN al último administrador activo');
      }
    }

    await client.query(`UPDATE users SET rol_id = $2 WHERE id = $1`, [targetIdNum, newRole]);
    // Incondicional: inofensivo si el usuario estaba inactivo (sin tokens vigentes) y
    // defensivo si los tuviera, dado que verifyToken no revisa is_active por request.
    await TokenRevocation.revokeAllUserTokens(targetIdNum, 'role_changed', client);

    await BackofficeAction.log({
      adminUserId: actor,
      actionType: 'change_user_role',
      targetType: 'user',
      targetId: targetIdNum,
      details: { previous_rol_id: target.rol_id, new_rol_id: newRole }
    }, client);

    return { id: targetIdNum, rol_id: newRole };
  });
}

module.exports = { UserStatusError, deactivateUser, activateUser, changeRole };
