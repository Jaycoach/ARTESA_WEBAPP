const { createContextLogger } = require('../config/logger');
const pool = require('../config/db');
const logger = createContextLogger('AuditService');

class AuditService {
    // Tipos de eventos de auditoría
    static AUDIT_EVENTS = {
        PAYMENT_INITIATED: 'PAYMENT_INITIATED',
        PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
        PAYMENT_FAILED: 'PAYMENT_FAILED',
        PAYMENT_REVERSED: 'PAYMENT_REVERSED',
        DATA_ACCESSED: 'DATA_ACCESSED',
        SECURITY_EVENT: 'SECURITY_EVENT'
    };

    // Niveles de severidad
    static SEVERITY_LEVELS = {
        INFO: 'INFO',
        WARNING: 'WARNING',
        ERROR: 'ERROR',
        CRITICAL: 'CRITICAL'
    };

    // Registrar evento de auditoría
    static async logAuditEvent(eventType, data, userId, severity = 'INFO') {
        try {
            const query = `
                INSERT INTO transaction_audit_log (
                    transaction_id,
                    action_type,
                    user_id,
                    ip_address,
                    details,
                    severity,
                    old_status,
                    new_status,
                    metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING audit_id;
            `;

            const values = [
                data.transactionId || null,
                eventType,
                userId,
                data.ipAddress || null,
                JSON.stringify(this.sanitizeAuditData(data.details || {})),
                severity,
                data.oldStatus || null,
                data.newStatus || null,
                JSON.stringify(data.metadata || {})
            ];

            const result = await pool.query(query, values);
            
            logger.info('Evento de auditoría registrado', {
                auditId: result.rows[0].audit_id,
                eventType,
                severity
            });

            return result.rows[0].audit_id;
        } catch (error) {
            logger.error('Error registrando evento de auditoría', {
                error: error.message,
                eventType,
                stack: error.stack
            });
            throw error;
        }
    }

    // Sanitizar datos sensibles antes de auditar
    static sanitizeAuditData(data) {
        const sensitiveFields = [
            'card_number',
            'cvv',
            'password',
            'token',
            'secret'
        ];

        const sanitized = { ...data };
        
        sensitiveFields.forEach(field => {
            if (field in sanitized) {
                if (field === 'card_number' && typeof sanitized[field] === 'string') {
                    sanitized[field] = `****${sanitized[field].slice(-4)}`;
                } else {
                    sanitized[field] = '[REDACTED]';
                }
            }
        });

        return sanitized;
    }

    // Obtener historial de auditoría para una transacción
    static async getTransactionAuditTrail(transactionId) {
        try {
            const query = `
                SELECT 
                    tal.audit_id,
                    tal.action_type,
                    tal.action_timestamp,
                    u.name as user_name,
                    tal.ip_address,
                    tal.details,
                    tal.severity,
                    tal.old_status,
                    tal.new_status,
                    tal.metadata
                FROM transaction_audit_log tal
                LEFT JOIN users u ON tal.user_id = u.id
                WHERE tal.transaction_id = $1
                ORDER BY tal.action_timestamp DESC;
            `;

            const result = await pool.query(query, [transactionId]);
            return result.rows;
        } catch (error) {
            logger.error('Error obteniendo historial de auditoría', {
                error: error.message,
                transactionId
            });
            throw error;
        }
    }

    // Detectar y reportar anomalías
    static async detectAnomalies(transactionData) {
        const anomalies = [];
        const thresholds = {
            maxAmount: 50000,
            maxAttempts: 3,
            timeWindow: 300000 // 5 minutos
        };

        try {
            // Verificar monto inusual
            if (transactionData.amount > thresholds.maxAmount) {
                anomalies.push({
                    type: 'HIGH_AMOUNT',
                    severity: this.SEVERITY_LEVELS.WARNING,
                    details: `Monto superior a ${thresholds.maxAmount}`
                });
            }

            // Verificar intentos múltiples
            const recentAttempts = await this.getRecentAttempts(
                transactionData.userId,
                thresholds.timeWindow
            );

            if (recentAttempts >= thresholds.maxAttempts) {
                anomalies.push({
                    type: 'MULTIPLE_ATTEMPTS',
                    severity: this.SEVERITY_LEVELS.WARNING,
                    details: `Múltiples intentos en ${thresholds.timeWindow/1000} segundos`
                });
            }

            // Registrar anomalías encontradas
            if (anomalies.length > 0) {
                await this.logAuditEvent(
                    this.AUDIT_EVENTS.SECURITY_EVENT,
                    {
                        details: anomalies,
                        transactionId: transactionData.transactionId,
                        userId: transactionData.userId
                    },
                    transactionData.userId,
                    this.SEVERITY_LEVELS.WARNING
                );
            }

            return anomalies;
        } catch (error) {
            logger.error('Error en detección de anomalías', {
                error: error.message,
                transactionId: transactionData.transactionId
            });
            throw error;
        }
    }

    // Obtener intentos recientes de un usuario
    static async getRecentAttempts(userId, timeWindow) {
        const query = `
            SELECT COUNT(*) as attempts
            FROM transaction_audit_log
            WHERE user_id = $1
            AND action_timestamp > NOW() - INTERVAL '${timeWindow} milliseconds'
            AND action_type = $2;
        `;

        const result = await pool.query(query, [
            userId,
            this.AUDIT_EVENTS.PAYMENT_INITIATED
        ]);
        
        return parseInt(result.rows[0].attempts);
    }

    // Generar reporte de auditoría
    static async generateAuditReport(startDate, endDate, filters = {}) {
        try {
            let query = `
                SELECT 
                    tal.audit_id,
                    tal.transaction_id,
                    tal.action_type,
                    tal.action_timestamp,
                    u.name as user_name,
                    tal.ip_address,
                    tal.severity,
                    tal.details,
                    tal.old_status,
                    tal.new_status
                FROM transaction_audit_log tal
                LEFT JOIN users u ON tal.user_id = u.id
                WHERE tal.action_timestamp BETWEEN $1 AND $2
            `;

            const values = [startDate, endDate];
            let paramCount = 3;

            // Aplicar filtros adicionales
            if (filters.severity) {
                query += ` AND tal.severity = $${paramCount}`;
                values.push(filters.severity);
                paramCount++;
            }

            if (filters.actionType) {
                query += ` AND tal.action_type = $${paramCount}`;
                values.push(filters.actionType);
                paramCount++;
            }

            query += ' ORDER BY tal.action_timestamp DESC';

            const result = await pool.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error generando reporte de auditoría', {
                error: error.message,
                startDate,
                endDate,
                filters
            });
            throw error;
        }
    }
}

module.exports = AuditService;