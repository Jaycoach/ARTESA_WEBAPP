const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('BranchAuth');

class BranchAuth {
    static async findByEmail(email) {
        try {
            const { rows } = await pool.query(
                `SELECT b.*, cp.company_name, cp.nit_number, cp.verification_digit
                 FROM client_branches b 
                 LEFT JOIN client_profiles cp ON b.client_id = cp.client_id 
                 WHERE b.email_branch = $1 AND b.is_login_enabled = true`,
                [email]
            );
            return rows[0] || null;
        } catch (error) {
            logger.error('Error buscando sucursal por email', { error: error.message, email });
            throw error;
        }
    }

    static async findById(branchId) {
        try {
            const { rows } = await pool.query(
                `SELECT b.*, cp.company_name, cp.nit_number, cp.verification_digit
                 FROM client_branches b 
                 LEFT JOIN client_profiles cp ON b.client_id = cp.client_id 
                 WHERE b.branch_id = $1`,
                [branchId]
            );
            return rows[0] || null;
        } catch (error) {
            logger.error('Error buscando sucursal por ID', { error: error.message, branchId });
            throw error;
        }
    }

    static async updateLastLogin(branchId, ipAddress) {
        try {
            await pool.query(
                `UPDATE client_branches 
                 SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, locked_until = NULL 
                 WHERE branch_id = $1`,
                [branchId]
            );
        } catch (error) {
            logger.error('Error actualizando último login', { error: error.message, branchId });
            throw error;
        }
    }

    static async recordFailedAttempt(branchId) {
        try {
            const { rows } = await pool.query(
                `UPDATE client_branches 
                 SET failed_login_attempts = failed_login_attempts + 1,
                     locked_until = CASE 
                         WHEN failed_login_attempts + 1 >= 5 
                         THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                         ELSE locked_until
                     END
                 WHERE branch_id = $1 
                 RETURNING failed_login_attempts, locked_until`,
                [branchId]
            );
            return rows[0];
        } catch (error) {
            logger.error('Error registrando intento fallido', { error: error.message, branchId });
            throw error;
        }
    }

    static async isLocked(branchId) {
        try {
            const { rows } = await pool.query(
                `SELECT locked_until FROM client_branches 
                 WHERE branch_id = $1 AND locked_until > CURRENT_TIMESTAMP`,
                [branchId]
            );
            return rows.length > 0;
        } catch (error) {
            logger.error('Error verificando bloqueo', { error: error.message, branchId });
            throw error;
        }
    }

    static async logLoginAttempt(branchId, ipAddress, status, details = null, userAgent = null) {
        try {
            await pool.query(
                `INSERT INTO branch_login_history 
                 (branch_id, ip_address, status, attempt_details, user_agent) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [branchId, ipAddress, status, details, userAgent]
            );
        } catch (error) {
            logger.error('Error registrando intento de login', { error: error.message, branchId, status });
        }
    }

    static async storeActiveToken(tokenHash, branchId, expiresAt, deviceInfo, ipAddress) {
        try {
            await pool.query(
                `INSERT INTO active_branch_tokens 
                 (token_hash, branch_id, expires_at, device_info, ip_address) 
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (token_hash) DO NOTHING`,
                [tokenHash, branchId, expiresAt, deviceInfo, ipAddress]
            );
        } catch (error) {
            logger.error('Error almacenando token activo', { error: error.message, branchId });
            throw error;
        }
    }

    static async removeActiveToken(tokenHash) {
        try {
            await pool.query(
                'DELETE FROM active_branch_tokens WHERE token_hash = $1',
                [tokenHash]
            );
        } catch (error) {
            logger.error('Error removiendo token activo', { error: error.message });
        }
    }
}

module.exports = BranchAuth;