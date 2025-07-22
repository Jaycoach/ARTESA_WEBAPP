const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { createContextLogger } = require('../config/logger');
const AuditService = require('../services/AuditService');

const logger = createContextLogger('BranchRegistrationController');

class BranchRegistrationController {
    static async checkEmail(req, res) {
        const { email } = req.body;

        try {
            logger.info('Verificando email de sucursal para registro', { email, ip: req.ip });

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'El email es requerido'
                });
            }

            // Buscar sucursal por email
            const { rows } = await pool.query(
                `SELECT 
                    branch_id, 
                    branch_name, 
                    email_branch, 
                    password,
                    manager_name,
                    is_login_enabled
                 FROM client_branches 
                 WHERE email_branch = $1`,
                [email]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró una sucursal con este email'
                });
            }

            const branch = rows[0];

            // Verificar si ya tiene contraseña configurada
            if (branch.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta sucursal ya tiene credenciales configuradas. Use el login normal.',
                    hasPassword: true
                });
            }

            // Email válido y sin contraseña - puede proceder al registro
            res.status(200).json({
                success: true,
                message: 'Email válido. Puede proceder con el registro.',
                data: {
                    branch_id: branch.branch_id,
                    branch_name: branch.branch_name,
                    email_branch: branch.email_branch,
                    hasPassword: false,
                    needsRegistration: true
                }
            });

        } catch (error) {
            logger.error('Error verificando email de sucursal', {
                error: error.message,
                stack: error.stack,
                email
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    static async register(req, res) {
        const { email, password, manager_name } = req.body;

        try {
            logger.info('Iniciando registro de sucursal', { email, manager_name, ip: req.ip });

            // Validaciones
            if (!email || !password || !manager_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Email, contraseña y nombre del encargado son requeridos'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'La contraseña debe tener al menos 6 caracteres'
                });
            }

            // Buscar sucursal por email
            const { rows: branchRows } = await pool.query(
                'SELECT branch_id, email_branch, password, branch_name FROM client_branches WHERE email_branch = $1',
                [email]
            );

            if (branchRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró una sucursal con este email'
                });
            }

            const branch = branchRows[0];

            // Verificar que no tenga contraseña ya configurada
            if (branch.password) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta sucursal ya tiene credenciales configuradas'
                });
            }

            // Hashear contraseña
            const hashedPassword = await bcrypt.hash(password, 10);

            // Actualizar sucursal con credenciales
            const updateQuery = `
                UPDATE client_branches 
                SET 
                    password = $1,
                    manager_name = $2,
                    is_login_enabled = true,
                    created_at_auth = CURRENT_TIMESTAMP,
                    updated_at_auth = CURRENT_TIMESTAMP
                WHERE branch_id = $3
                RETURNING branch_id, branch_name, email_branch, manager_name, is_login_enabled
            `;

            const { rows: updatedRows } = await pool.query(updateQuery, [
                hashedPassword,
                manager_name,
                branch.branch_id
            ]);

            // Registrar en auditoría
            await AuditService.logAuditEvent(
                AuditService.AUDIT_EVENTS.SECURITY_EVENT,
                {
                    details: {
                        action: 'BRANCH_SELF_REGISTRATION',
                        branchId: branch.branch_id,
                        email: email,
                        manager: manager_name
                    },
                    ipAddress: req.ip
                }
            );

            logger.info('Registro de sucursal completado exitosamente', {
                branchId: branch.branch_id,
                email: email,
                manager: manager_name
            });

            res.status(200).json({
                success: true,
                message: 'Registro completado exitosamente. Ya puede iniciar sesión.',
                data: {
                    branch: updatedRows[0]
                }
            });

        } catch (error) {
            logger.error('Error en registro de sucursal', {
                error: error.message,
                stack: error.stack,
                email,
                manager_name
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = {
    checkEmail: BranchRegistrationController.checkEmail.bind(BranchRegistrationController),
    register: BranchRegistrationController.register.bind(BranchRegistrationController)
};