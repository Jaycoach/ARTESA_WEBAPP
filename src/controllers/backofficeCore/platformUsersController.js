const pool = require('../../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { createContextLogger } = require('../../config/logger');
const ROLES = require('../../constants/roles');
const { INVITATION_EXPIRY_HOURS } = require('../../constants/backofficeCore');
const PasswordReset = require('../../models/PasswordReset');
const BackofficeAction = require('../../models/BackofficeAction');
const EmailService = require('../../services/EmailService');
const userStatusService = require('../../services/backofficeCore/userStatusService');
const { UserStatusError } = userStatusService;

const logger = createContextLogger('PlatformUsersController');

// mismo redondeo que authController.js:116 (PASSWORD_HASH_ROUNDS) — mantener en sync
const PASSWORD_HASH_ROUNDS = 10;

// Límites reales de users.name / users.mail (information_schema, Staging y Producción, 2026-09-23)
const NAME_MAX_LENGTH = 100;
const MAIL_MAX_LENGTH = 255;

const PLATFORM_USER_SCOPE_ROLES = [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN, ROLES.BACKOFFICE];
const INVITABLE_ROLES = [ROLES.ADMIN, ROLES.FUNCTIONAL_ADMIN];
const ROLE_LABELS = { [ROLES.ADMIN]: 'Administrador', [ROLES.FUNCTIONAL_ADMIN]: 'Administrador funcional' };

function handleUserStatusError(res, error, actionLabel) {
  if (error instanceof UserStatusError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  logger.error(`Error al ${actionLabel}`, { error: error.message, stack: error.stack });
  return res.status(500).json({ success: false, message: 'Error interno del servidor' });
}

/**
 * GET /api/backoffice/platform-users
 */
const listPlatformUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.mail, u.rol_id, r.nombre AS role_name, u.is_active,
              u.deactivated_manually, u.deactivated_at, u.deactivation_reason,
              u.created_at, u.updated_at
       FROM users u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.rol_id = ANY($1::int[])
       ORDER BY u.created_at DESC`,
      [PLATFORM_USER_SCOPE_ROLES]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error al listar usuarios de plataforma', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al listar usuarios de plataforma' });
  }
};

/**
 * POST /api/backoffice/platform-users
 * body: { name, mail, rolId }
 * Requiere AuthValidators.validateEmail montado ANTES en la ruta (archivo 7) — normaliza
 * y valida el formato de req.body.mail exactamente igual que register. La verificación
 * defensiva de abajo cubre solo el caso de que la ruta se monte mal.
 */
const createPlatformUser = async (req, res) => {
  try {
    const { name, mail, rolId } = req.body;
    if (!mail || !String(mail).trim()) {
      return res.status(400).json({ success: false, message: 'El correo es obligatorio' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    }
    const roleIdNum = Number(rolId);
    if (!INVITABLE_ROLES.includes(roleIdNum)) {
      return res.status(400).json({ success: false, message: 'Rol inválido; solo se permite ADMIN o FUNCTIONAL_ADMIN' });
    }

    const cleanName = String(name).trim();
    // req.body.mail ya viene normalizado a minúsculas por AuthValidators.validateEmail
    const normalizedMail = String(mail).trim().toLowerCase();

    if (cleanName.length > NAME_MAX_LENGTH) {
      return res.status(400).json({ success: false, message: `El nombre no puede superar ${NAME_MAX_LENGTH} caracteres` });
    }
    if (normalizedMail.length > MAIL_MAX_LENGTH) {
      return res.status(400).json({ success: false, message: `El correo no puede superar ${MAIL_MAX_LENGTH} caracteres` });
    }

    const client = await pool.connect();
    let newUser, tokenRow;
    try {
      await client.query('BEGIN');

      const { rows: existing } = await client.query(
        `SELECT id FROM users WHERE LOWER(mail) = LOWER($1)`,
        [normalizedMail]
      );
      if (existing.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese correo' });
      }

      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, PASSWORD_HASH_ROUNDS);

      const insertResult = await client.query(
        `INSERT INTO users (name, mail, password, rol_id, is_active, email_verified)
         VALUES ($1, $2, $3, $4, true, true)
         RETURNING id, name, mail, rol_id, created_at`,
        [cleanName, normalizedMail, hashedPassword, roleIdNum]
      );
      newUser = insertResult.rows[0];

      const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
      tokenRow = await PasswordReset.createTokenWithClient(client, newUser.id, expiresAt);

      await BackofficeAction.log({
        adminUserId: req.user.id,
        actionType: 'create_platform_user',
        targetType: 'user',
        targetId: newUser.id,
        details: { rol_id: roleIdNum }
      }, client);

      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
      if (error.code === '23505' || error.code === '22001') {
        return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese correo' });
      }
      throw error;
    } finally {
      client.release();
    }

    let invitationSent = true;
    try {
      await EmailService.sendPlatformUserInvitationEmail(
        newUser.mail, newUser.name, tokenRow.token, ROLE_LABELS[roleIdNum], INVITATION_EXPIRY_HOURS
      );
    } catch (emailError) {
      logger.error('Error al enviar invitación de usuario de plataforma', {
        error: emailError.message, userId: newUser.id
      });
      invitationSent = false;
    }

    return res.status(201).json({
      success: true,
      message: invitationSent ? 'Usuario creado; se envió la invitación' : 'Usuario creado; la invitación no pudo enviarse',
      data: { id: newUser.id, name: newUser.name, mail: newUser.mail, rol_id: newUser.rol_id },
      invitationSent
    });
  } catch (error) {
    logger.error('Error al crear usuario de plataforma', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al crear usuario de plataforma' });
  }
};

/**
 * POST /api/backoffice/platform-users/:id/resend-invitation
 * Solo ADMIN (via requirePermission en la ruta), solo rol_id IN (1,3).
 */
const resendInvitation = async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const { rows } = await pool.query(
      `SELECT id, name, mail, rol_id, is_active FROM users WHERE id = $1 AND rol_id = ANY($2::int[])`,
      [targetId, INVITABLE_ROLES]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const target = rows[0];
    if (!target.is_active) return res.status(409).json({ success: false, message: 'El usuario está inactivo' });

    const client = await pool.connect();
    let tokenRow;
    try {
      await client.query('BEGIN');
      const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
      tokenRow = await PasswordReset.createTokenWithClient(client, target.id, expiresAt);
      await BackofficeAction.log({
        adminUserId: req.user.id,
        actionType: 'resend_platform_user_invitation',
        targetType: 'user',
        targetId: target.id,
        details: { rol_id: target.rol_id }
      }, client);
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
      throw error;
    } finally {
      client.release();
    }

    let invitationSent = true;
    try {
      await EmailService.sendPlatformUserInvitationEmail(
        target.mail, target.name, tokenRow.token, ROLE_LABELS[target.rol_id], INVITATION_EXPIRY_HOURS
      );
    } catch (emailError) {
      logger.error('Error al reenviar invitación', { error: emailError.message, userId: target.id });
      invitationSent = false;
    }

    return res.status(200).json({ success: true, invitationSent });
  } catch (error) {
    logger.error('Error al reenviar invitación', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al reenviar invitación' });
  }
};

const activatePlatformUser = async (req, res) => {
  try {
    const result = await userStatusService.activateUser({
      actorId: req.user.id,
      targetId: req.params.id,
      scopeRoles: PLATFORM_USER_SCOPE_ROLES,
      scopeLabel: 'platform_user'
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleUserStatusError(res, error, 'activar usuario de plataforma');
  }
};

const deactivatePlatformUser = async (req, res) => {
  try {
    const result = await userStatusService.deactivateUser({
      actorId: req.user.id,
      targetId: req.params.id,
      reason: req.body.reason,
      scopeRoles: PLATFORM_USER_SCOPE_ROLES,
      scopeLabel: 'platform_user'
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleUserStatusError(res, error, 'inactivar usuario de plataforma');
  }
};

const changePlatformUserRole = async (req, res) => {
  try {
    const result = await userStatusService.changeRole({
      actorId: req.user.id,
      targetId: req.params.id,
      newRoleId: req.body.newRoleId
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleUserStatusError(res, error, 'cambiar el rol del usuario');
  }
};

module.exports = {
  listPlatformUsers,
  createPlatformUser,
  resendInvitation,
  activatePlatformUser,
  deactivatePlatformUser,
  changePlatformUserRole
};
