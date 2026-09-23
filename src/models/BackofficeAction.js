const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('BackofficeActionModel');

/**
 * Auditoría de acciones sensibles del módulo BackOffice.
 * @class BackofficeAction
 */
class BackofficeAction {
  /**
   * Registra una acción de BackOffice. Nunca debe recibir contraseñas ni tokens en `details`.
   * @param {Object} params
   * @param {number} params.adminUserId - ID del admin que ejecuta la acción
   * @param {string} params.actionType - 'activate_client' | 'deactivate_client' | 'reset_branch_password' | 'create_order'
   * @param {string} params.targetType - 'client_profile' | 'client_branch' | 'order'
   * @param {number} params.targetId
   * @param {Object} [params.details]
   * @param {import('pg').Pool|import('pg').PoolClient} [client=pool] - Cliente de una
   *   transacción externa ya iniciada (BEGIN). Si se omite, usa el pool por defecto
   *   (comportamiento idéntico al existente para todos los llamadores actuales).
   * @returns {Promise<Object>} Fila insertada
   */
  static async log({ adminUserId, actionType, targetType, targetId, details = null }, client = pool) {
    try {
      const query = `
        INSERT INTO backoffice_actions (admin_user_id, action_type, target_type, target_id, details)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
      `;
      const { rows } = await client.query(query, [adminUserId, actionType, targetType, targetId, details]);

      logger.info('Acción de BackOffice registrada', {
        adminUserId, actionType, targetType, targetId
      });

      return rows[0];
    } catch (error) {
      logger.error('Error al registrar acción de BackOffice', {
        error: error.message,
        adminUserId, actionType, targetType, targetId
      });
      throw error;
    }
  }
}

module.exports = BackofficeAction;
