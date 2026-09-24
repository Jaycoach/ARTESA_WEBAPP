const { createContextLogger } = require('../../config/logger');
const BackofficeAction = require('../../models/BackofficeAction');

const logger = createContextLogger('BackofficeAuditWrapper');

/**
 * Envuelve un handler Express EXISTENTE (sin modificarlo) para auditar su respuesta
 * en backoffice_actions — TODA respuesta, exitosa o fallida, nunca cambia el status
 * code ni el body que el cliente recibe. Es auditoría de mejor esfuerzo: corre fuera
 * de la transacción del handler original (si tiene una) y, si falla, solo se loguea.
 * @param {Function} handler - (req, res, next) => Promise<void>, el controller original
 * @param {object} opts
 * @param {string} opts.actionType
 * @param {string} opts.targetType
 * @param {(req) => Promise<object>} [opts.resolveBefore] - lectura de solo lectura ANTES
 *   de ejecutar el handler; su resultado se pasa a resolveTargetId/resolveDetails como `before`
 * @param {(req, body, before) => Promise<number>} opts.resolveTargetId
 * @param {(req, body, before) => object} [opts.resolveDetails] - SOLO campos elegidos
 *   explícitamente; nunca vuelca req.body ni body completos
 */
function withAudit(handler, { actionType, targetType, resolveBefore, resolveTargetId, resolveDetails }) {
  return async (req, res, next) => {
    let before;
    if (resolveBefore) {
      try {
        before = await resolveBefore(req);
      } catch (error) {
        logger.error('Error al leer estado previo para auditoría (before)', {
          error: error.message, actionType
        });
      }
    }

    // res.json() llama internamente a res.send() en Express: sin esta marca, cada
    // respuesta se auditaría dos veces.
    let audited = false;
    const auditResponse = (body) => {
      if (audited) return;
      audited = true;

      Promise.resolve()
        .then(async () => {
          const httpStatus = res.statusCode;
          const targetId = resolveTargetId ? await resolveTargetId(req, body, before) : 0;
          const details = {
            http_status: httpStatus,
            ok: httpStatus < 400,
            ...(resolveDetails ? resolveDetails(req, body, before) : {})
          };
          await BackofficeAction.log({
            adminUserId: req.user.id,
            actionType,
            targetType,
            targetId,
            details
          });
        })
        .catch((error) => {
          logger.error('Error al auditar acción del BackOffice (delegada, mejor esfuerzo)', {
            error: error.message, actionType, targetType
          });
        });
    };

    // Se intercepta json y send (los 9 handlers delegados de hoy solo usan .json(),
    // pero se cubre .send() también por si algo cambia). Ninguno usa .end() ni streaming.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      auditResponse(body);
      return originalJson(body);
    };
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      auditResponse(body);
      return originalSend(body);
    };

    return handler(req, res, next);
  };
}

module.exports = { withAudit };
