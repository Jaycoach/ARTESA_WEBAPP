const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createContextLogger } = require('../config/logger');
const BranchAuth = require('../models/BranchAuth');

const logger = createContextLogger('BranchAuthController');

// Rate limiter específico para login de sucursales
const branchLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos por ventana de tiempo
    message: {
        success: false,
        message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
        remainingTime: Math.ceil((Date.now() + 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return `branch_login_${req.ip}_${req.body.email || 'unknown'}`;
    }
});

class BranchAuthController {
    static async generateToken(branch) {
        const payload = {
            branch_id: branch.branch_id,
            email_branch: branch.email_branch,
            manager_name: branch.manager_name,
            branch_name: branch.branch_name,
            client_id: branch.client_id,
            client_name: branch.client_name,
            type: 'branch', // Identificador del tipo de autenticación
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, process.env.JWT_SECRET, { 
            expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
        });
    }

    static async login(req, res) {
        const { email, password } = req.body;

        try {
            logger.info('Intento de login de sucursal', { email, ip: req.ip });

            // Buscar la sucursal por email
            const branch = await BranchAuth.findByEmail(email);
            
            if (!branch) {
                await BranchAuth.logLoginAttempt(
                    null, 
                    req.ip, 
                    'failed', 
                    'Email no encontrado',
                    req.headers['user-agent']
                );
                
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Verificar si la sucursal está bloqueada
            const isLocked = await BranchAuth.isLocked(branch.branch_id);
            if (isLocked) {
                await BranchAuth.logLoginAttempt(
                    branch.branch_id, 
                    req.ip, 
                    'failed', 
                    'Cuenta bloqueada por múltiples intentos fallidos',
                    req.headers['user-agent']
                );
                
                return res.status(423).json({
                    success: false,
                    message: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente nuevamente en 15 minutos.'
                });
            }

            // Verificar la contraseña
            const isValidPassword = await bcrypt.compare(password, branch.password);
            
            if (!isValidPassword) {
                await BranchAuth.recordFailedAttempt(branch.branch_id);
                await BranchAuth.logLoginAttempt(
                    branch.branch_id, 
                    req.ip, 
                    'failed', 
                    'Contraseña incorrecta',
                    req.headers['user-agent']
                );
                
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Login exitoso: generar token
            const token = await this.generateToken(branch);
            
            // Actualizar último login y resetear intentos fallidos
            await BranchAuth.updateLastLogin(branch.branch_id, req.ip);
            
            // Almacenar token activo
            const tokenHash = jwt.sign({ token_id: Date.now() }, process.env.JWT_SECRET);
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
            
            await BranchAuth.storeActiveToken(
                tokenHash,
                branch.branch_id,
                expiresAt,
                req.headers['user-agent'],
                req.ip
            );
            
            // Registrar login exitoso
            await BranchAuth.logLoginAttempt(
                branch.branch_id, 
                req.ip, 
                'success', 
                'Login exitoso',
                req.headers['user-agent']
            );

            logger.info('Login de sucursal exitoso', {
                branchId: branch.branch_id,
                email_branch: branch.email_branch,
                branchName: branch.branch_name,
                clientName: branch.client_name
            });

            // Preparar datos de respuesta (sin contraseña)
            const { password: _, ...branchData } = branch;

            res.status(200).json({
                success: true,
                message: 'Login exitoso',
                data: {
                    token,
                    branch: {
                        ...branchData,
                        type: 'branch'
                    }
                }
            });

        } catch (error) {
            logger.error('Error en login de sucursal', {
                error: error.message,
                stack: error.stack,
                email
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    static async logout(req, res) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            
            if (token) {
                const tokenHash = jwt.sign({ token_id: Date.now() }, process.env.JWT_SECRET);
                await BranchAuth.removeActiveToken(tokenHash);
            }

            logger.info('Logout de sucursal exitoso', {
                branchId: req.branch?.branch_id
            });

            res.status(200).json({
                success: true,
                message: 'Logout exitoso'
            });

        } catch (error) {
            logger.error('Error en logout de sucursal', {
                error: error.message,
                branchId: req.branch?.branch_id
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    static async getProfile(req, res) {
        try {
            const branch = await BranchAuth.findById(req.branch.branch_id);
            
            if (!branch) {
                return res.status(404).json({
                    success: false,
                    message: 'Sucursal no encontrada'
                });
            }

            // Remover datos sensibles
            const { password: _, ...branchData } = branch;

            res.status(200).json({
                success: true,
                data: {
                    ...branchData,
                    type: 'branch'
                }
            });

        } catch (error) {
            logger.error('Error obteniendo perfil de sucursal', {
                error: error.message,
                branchId: req.branch.branch_id
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    static async checkRegistration(req, res) {
        const { email } = req.body;

        try {
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

            res.status(200).json({
                success: true,
                data: {
                    branch_id: branch.branch_id,
                    branch_name: branch.branch_name,
                    email_branch: branch.email_branch,
                    hasPassword: !!branch.password,
                    needsRegistration: !branch.password,
                    is_login_enabled: branch.is_login_enabled
                }
            });

        } catch (error) {
            logger.error('Error verificando registro de sucursal', {
                error: error.message,
                email
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = {
    login: BranchAuthController.login.bind(BranchAuthController),
    logout: BranchAuthController.logout.bind(BranchAuthController),
    getProfile: BranchAuthController.getProfile.bind(BranchAuthController),
    checkRegistration: BranchAuthController.checkRegistration.bind(BranchAuthController),
    branchLoginLimiter
};