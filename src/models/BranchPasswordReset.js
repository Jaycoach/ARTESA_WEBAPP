const pool = require('../config/db');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('BranchPasswordReset');

class BranchPasswordReset {
    /**
     * Crear token de reset para sucursal
     * @param {number} branchId - ID de la sucursal
     * @param {string} token - Token de reset
     * @param {Date} expiresAt - Fecha de expiración
     * @returns {Promise<object>} Resultado de la operación
     */
    static async createToken(branchId, token, expiresAt) {
        try {
            // Eliminar tokens previos para esta sucursal
            await pool.query(
                'DELETE FROM branch_password_resets WHERE branch_id = $1',
                [branchId]
            );

            // Crear nuevo token
            const { rows } = await pool.query(
                `INSERT INTO branch_password_resets (branch_id, token, expires_at, created_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 RETURNING id, branch_id, created_at`,
                [branchId, token, expiresAt]
            );

            logger.info('Token de reset creado para sucursal', {
                branchId,
                tokenId: rows[0].id
            });

            return rows[0];
        } catch (error) {
            logger.error('Error creando token de reset para sucursal', {
                error: error.message,
                branchId
            });
            throw error;
        }
    }

    /**
     * Buscar token válido para sucursal
     * @param {string} token - Token a buscar
     * @returns {Promise<object|null>} Datos del token o null
     */
    static async findValidToken(token) {
        try {
            const { rows } = await pool.query(
                `SELECT bpr.*, cb.email_branch, cb.branch_name, cb.client_id
                 FROM branch_password_resets bpr
                 JOIN client_branches cb ON bpr.branch_id = cb.branch_id
                 WHERE bpr.token = $1 
                   AND bpr.expires_at > CURRENT_TIMESTAMP 
                   AND bpr.used_at IS NULL`,
                [token]
            );

            return rows[0] || null;
        } catch (error) {
            logger.error('Error buscando token de reset para sucursal', {
                error: error.message,
                token: token.substring(0, 8) + '...'
            });
            throw error;
        }
    }

    /**
     * Marcar token como usado
     * @param {string} token - Token a marcar como usado
     * @returns {Promise<boolean>} True si se marcó correctamente
     */
    static async markTokenAsUsed(token) {
        try {
            const { rowCount } = await pool.query(
                'UPDATE branch_password_resets SET used_at = CURRENT_TIMESTAMP WHERE token = $1',
                [token]
            );

            return rowCount > 0;
        } catch (error) {
            logger.error('Error marcando token como usado', {
                error: error.message,
                token: token.substring(0, 8) + '...'
            });
            throw error;
        }
    }

    /**
     * Limpiar tokens expirados
     * @returns {Promise<number>} Número de tokens eliminados
     */
    static async cleanExpiredTokens() {
        try {
            const { rowCount } = await pool.query(
                'DELETE FROM branch_password_resets WHERE expires_at < CURRENT_TIMESTAMP'
            );

            if (rowCount > 0) {
                logger.info('Tokens expirados limpiados para sucursales', { count: rowCount });
            }

            return rowCount;
        } catch (error) {
            logger.error('Error limpiando tokens expirados para sucursales', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obtener estadísticas de tokens
     * @returns {Promise<object>} Estadísticas de tokens
     */
    static async getTokenStats() {
        try {
            const { rows } = await pool.query(`
                SELECT 
                    COUNT(*) as total_tokens,
                    COUNT(*) FILTER (WHERE used_at IS NOT NULL) as used_tokens,
                    COUNT(*) FILTER (WHERE expires_at < CURRENT_TIMESTAMP AND used_at IS NULL) as expired_tokens,
                    COUNT(*) FILTER (WHERE expires_at > CURRENT_TIMESTAMP AND used_at IS NULL) as active_tokens
                FROM branch_password_resets
            `);

            return rows[0];
        } catch (error) {
            logger.error('Error obteniendo estadísticas de tokens', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = BranchPasswordReset;