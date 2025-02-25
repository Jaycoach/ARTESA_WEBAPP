const AuditService = require('../services/AuditService');
const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('AuditMiddleware');

class AuditMiddleware {
    static async auditPaymentActivity(req, res, next) {
        const originalEnd = res.end;
        const originalJson = res.json;
        
        try {
            // Registrar inicio de la transacción
            await AuditService.logAuditEvent(
                AuditService.AUDIT_EVENTS.PAYMENT_INITIATED,
                {
                    transactionId: req.body.transactionId,
                    details: {
                        amount: req.body.amount,
                        currency: req.body.currency,
                        method: req.body.payment_method
                    },
                    ipAddress: req.ip,
                    metadata: {
                        userAgent: req.headers['user-agent'],
                        referrer: req.headers['referer']
                    }
                },
                req.user.id
            );

            // Interceptar la respuesta
            res.json = async function(data) {
                try {
                    // Determinar el tipo de evento basado en la respuesta
                    const eventType = data.status === 'success' 
                        ? AuditService.AUDIT_EVENTS.PAYMENT_PROCESSED
                        : AuditService.AUDIT_EVENTS.PAYMENT_FAILED;

                    // Registrar el resultado
                    await AuditService.logAuditEvent(
                        eventType,
                        {
                            transactionId: req.body.transactionId,
                            details: {
                                status: data.status,
                                response: data
                            },
                            ipAddress: req.ip,
                            newStatus: data.status
                        },
                        req.user.id,
                        data.status === 'success' 
                            ? AuditService.SEVERITY_LEVELS.INFO
                            : AuditService.SEVERITY_LEVELS.WARNING
                    );

                    // Verificar anomalías
                    const anomalies = await AuditService.detectAnomalies({
                        userId: req.user.id,
                        transactionId: req.body.transactionId,
                        amount: req.body.amount
                    });

                    // Si hay anomalías, agregarlas a la respuesta para monitoreo
                    if (anomalies.length > 0) {
                        data._audit = {
                            anomalies,
                            requiresReview: anomalies.some(
                                a => a.severity === AuditService.SEVERITY_LEVELS.WARNING
                            )
                        };
                    }
                } catch (error) {
                    logger.error('Error en auditoría de respuesta', {
                        error: error.message,
                        transactionId: req.body.transactionId
                    });
                }

                return originalJson.call(this, data);
            };

            next();
        } catch (error) {
            logger.error('Error en middleware de auditoría', {
                error: error.message,
                stack: error.stack
            });
            next(error);
        }
    }

    // Middleware para auditar accesos a datos sensibles
    static async auditDataAccess(req, res, next) {
        try {
            await AuditService.logAuditEvent(
                AuditService.AUDIT_EVENTS.DATA_ACCESSED,
                {
                    details: {
                        method: req.method,
                        path: req.path,
                        query: req.query
                    },
                    ipAddress: req.ip
                },
                req.user.id
            );
            next();
        } catch (error) {
            logger.error('Error en auditoría de acceso a datos', {
                error: error.message
            });
            next(error);
        }
    }

    // Middleware para eventos de seguridad
    static async auditSecurityEvent(req, res, next) {
        try {
            const securityEvents = [];

            // Verificar patrones sospechosos
            if (req.headers['user-agent'] === undefined) {
                securityEvents.push('Missing User Agent');
            }

            if (req.method === 'POST' && !req.headers['content-type']) {
                securityEvents.push('Missing Content Type');
            }

            if (securityEvents.length > 0) {
                await AuditService.logAuditEvent(
                    AuditService.AUDIT_EVENTS.SECURITY_EVENT,
                    {
                        details: {
                            events: securityEvents,
                            headers: req.headers
                        },
                        ipAddress: req.ip,
                        severity: AuditService.SEVERITY_LEVELS.WARNING
                    },
                    req.user?.id
                );
            }

            next();
        } catch (error) {
            logger.error('Error en auditoría de seguridad', {
                error: error.message
            });
            next(error);
        }
    }
}

module.exports = AuditMiddleware;