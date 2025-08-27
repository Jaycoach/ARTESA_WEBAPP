const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createContextLogger } = require('../config/logger');
const BranchAuth = require('../models/BranchAuth');
const crypto = require('crypto');
const emailService = require('../services/EmailService');
const AuditService = require('../services/AuditService');

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
    /**
     * Genera un token JWT para una sucursal
     * @param {Object} branch - Datos de la sucursal
     * @returns {Promise<string>} Token JWT
     */
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

    /**
     * Inicia sesión de una sucursal
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     */
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

            // Verificar si el email está verificado
            if (!branch.email_verified) {
                await BranchAuth.logLoginAttempt(
                    branch.branch_id, 
                    req.ip, 
                    'failed', 
                    'Email no verificado',
                    req.headers['user-agent']
                );
                
                return res.status(403).json({
                    success: false,
                    message: 'Debe verificar su email antes de iniciar sesión. Revise su bandeja de entrada.',
                    emailNotVerified: true
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

    /**
     * Cierra sesión de una sucursal
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     */
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

    /**
     * Obtiene el perfil de una sucursal
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     */
    static async getProfile(req, res) {
        try {
            const branch = await BranchAuth.findById(req.branch.branch_id);
            
            if (!branch) {
                return res.status(404).json({
                    success: false,
                    message: 'Sucursal no encontrada'
                });
            }

            // Obtener el user_id del cliente principal asociado a esta sucursal
            const clientUserQuery = `
                SELECT 
                    cp.user_id,
                    u.name as user_name,
                    u.mail as user_email,
                    cp.cardcode_sap,
                    cp.cardtype_sap
                FROM client_profiles cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.client_id = $1
                LIMIT 1
            `;
            
            const { rows: userRows } = await pool.query(clientUserQuery, [branch.client_id]);
            
            // Remover datos sensibles
            const { password: _, ...branchData } = branch;

            // Preparar respuesta con user_id incluido
            const profileData = {
                ...branchData,
                type: 'branch'
            };

            // Agregar información del usuario principal si existe
            if (userRows.length > 0) {
                const userInfo = userRows[0];
                profileData.user_id = userInfo.user_id;
                profileData.user_name = userInfo.user_name;
                profileData.user_email = userInfo.user_email;
                profileData.user_cardcode_sap = userInfo.cardcode_sap;
                profileData.user_cardtype_sap = userInfo.cardtype_sap;
                
                logger.debug('Usuario principal encontrado para sucursal', {
                    branchId: req.branch.branch_id,
                    clientId: branch.client_id,
                    userId: userInfo.user_id,
                    cardTypeSap: userInfo.cardtype_sap
                });
            } else {
                logger.warn('No se encontró usuario principal para la sucursal', {
                    branchId: req.branch.branch_id,
                    clientId: branch.client_id
                });
            }

            res.status(200).json({
                success: true,
                data: profileData
            });

        } catch (error) {
            logger.error('Error obteniendo perfil de sucursal', {
                error: error.message,
                branchId: req.branch.branch_id,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    /**
     * Obtiene el código de lista de precios del cliente principal
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     */
    static async getClientPriceListCode(req, res) {
        try {
            const { client_id } = req.branch;
            
            // Obtener el price_list_code del cliente principal
            const query = `
                SELECT 
                    cp.price_list_code, 
                    cp.price_list, 
                    cp.company_name
                FROM client_profiles cp
                WHERE cp.client_id = $1
                LIMIT 1
            `;
            
            const { rows } = await pool.query(query, [client_id]);
            
            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente principal no encontrado'
                });
            }
            
            // Priorizar price_list, si no existe usar price_list_code, si no existe usar '1'
            const priceListCode = rows[0].price_list ? rows[0].price_list.toString() : 
                                (rows[0].price_list_code || '1');

            logger.debug('Price list code determinado para sucursal', {
                branchId: req.branch.branch_id,
                clientId: client_id,
                rawPriceList: rows[0].price_list,
                rawPriceListCode: rows[0].price_list_code,
                finalPriceListCode: priceListCode,
                source: rows[0].price_list ? 'price_list' : 
                    (rows[0].price_list_code ? 'price_list_code' : 'default')
            });
            
            res.status(200).json({
                success: true,
                data: {
                    price_list_code: priceListCode,
                    price_list_source: rows[0].price_list ? 'price_list' : 
                                    (rows[0].price_list_code ? 'price_list_code' : 'default'),
                    raw_values: {
                        price_list: rows[0].price_list,
                        price_list_code: rows[0].price_list_code
                    },
                    company_name: rows[0].company_name
                }
            });
            
        } catch (error) {
            logger.error('Error obteniendo price_list_code del cliente principal', {
                error: error.message,
                branchId: req.branch?.branch_id,
                clientId: req.branch?.client_id
            });
            
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    /**
     * Verifica el registro de una sucursal
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     */
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
                    is_login_enabled,
                    email_verified
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
                    is_login_enabled: branch.is_login_enabled,
                    email_verified: branch.email_verified,
                    needsEmailVerification: !branch.email_verified
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

    /**
     * Inicia el proceso de verificación de email para sucursal
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     */
    static async initiateEmailVerification(req, res) {
        const { email } = req.body;

        logger.debug('Endpoint initiateEmailVerification invocado', {
            method: req.method,
            path: req.path,
            originalUrl: req.originalUrl,
            body: { email: req.body.email ? 'presente' : 'ausente' },
            headers: {
                contentType: req.headers['content-type'],
                userAgent: req.headers['user-agent']
            }
        });

        try {
            logger.info('Iniciando verificación de email para sucursal', { email, ip: req.ip });

            logger.debug('Configuración de EmailService', {
                hasEmailService: !!emailService,
                emailServiceType: typeof emailService,
                emailServiceMethods: emailService ? Object.getOwnPropertyNames(Object.getPrototypeOf(emailService)) : []
            });

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'El email es requerido'
                });
            }

            // Verificar configuración del servicio de email
            if (!emailService) {
                logger.error('EmailService no está configurado correctamente');
                return res.status(500).json({
                    success: false,
                    message: 'Servicio de correo no disponible temporalmente'
                });
            }

            // Buscar sucursal por email
            const { rows } = await pool.query(
                `SELECT 
                    branch_id, 
                    branch_name, 
                    email_branch, 
                    password,
                    is_login_enabled,
                    email_verified,
                    verification_token,
                    verification_expires,
                    client_id
                 FROM client_branches 
                 WHERE email_branch = $1`,
                [email]
            );

            if (rows.length === 0) {
                // Por seguridad, no revelar si el email existe o no
                return res.status(200).json({
                    success: true,
                    message: 'Si tu correo de sucursal está registrado, recibirás un enlace de verificación'
                });
            }

            const branch = rows[0];

            // Si no tiene contraseña configurada, debe usar el flujo de registro primero
            if (!branch.password) {
                logger.info('Intento de verificación en sucursal sin contraseña', {
                    branchId: branch.branch_id,
                    email
                });
                return res.status(400).json({
                    success: false,
                    message: 'Esta sucursal debe completar su registro primero',
                    needsRegistration: true
                });
            }

            // Si ya está verificado, informar sin revelar detalles
            if (branch.email_verified) {
                logger.info('Intento de verificación en sucursal ya verificada', {
                    branchId: branch.branch_id,
                    email
                });
                return res.status(200).json({
                    success: true,
                    message: 'Si tu correo de sucursal está registrado y no verificado, recibirás un enlace de verificación'
                });
            }

            // Generar nuevo token de verificación
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

            // Actualizar token en la base de datos
            await pool.query(
                'UPDATE client_branches SET verification_token = $1, verification_expires = $2, updated_at_auth = CURRENT_TIMESTAMP WHERE branch_id = $3',
                [verificationToken, verificationExpires, branch.branch_id]
            );

            // Enviar correo de verificación
            try {
                await emailService.sendBranchVerificationEmail(
                    email, 
                    verificationToken,
                    branch.branch_name
                );

                logger.info('Correo de verificación enviado exitosamente para sucursal', {
                    branchId: branch.branch_id,
                    email
                });

                // Registrar en auditoría
                await AuditService.logAuditEvent(
                    AuditService.AUDIT_EVENTS.SECURITY_EVENT,
                    {
                        details: {
                            action: 'BRANCH_VERIFICATION_INITIATED',
                            branchId: branch.branch_id,
                            clientId: branch.client_id,
                            email: email
                        },
                        ipAddress: req.ip
                    },
                    null, // No hay user_id para branches
                    branch.branch_id
                );

            } catch (emailError) {
                logger.error('Error enviando correo de verificación para sucursal', {
                    error: emailError.message,
                    branchId: branch.branch_id,
                    email
                });

                return res.status(500).json({
                    success: false,
                    message: 'Error enviando correo de verificación'
                });
            }

            logger.info('Proceso de verificación completado exitosamente', {
                branchId: branch.branch_id,
                email,
                tokenGenerated: !!verificationToken,
                emailSent: true
            });

            return res.status(200).json({
                success: true,
                message: 'Si tu correo de sucursal está registrado, recibirás un enlace de verificación',
                verificationSent: true
            });

        } catch (error) {
            logger.error('Error iniciando verificación de email para sucursal', {
                error: error.message,
                stack: error.stack,
                email
            });

            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    
    /**
     * Verificar email de sucursal
     */
    static async verifyEmail(req, res) {
        const { token } = req.params;

        try {
            logger.info('Iniciando verificación de email para sucursal', {
                token: token ? token.substring(0, 8) + '...' : 'undefined',
                ip: req.ip
            });

            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token de verificación es requerido'
                });
            }

            // Buscar sucursal por token de verificación
            const { rows } = await pool.query(
                `SELECT branch_id, email_branch, branch_name, client_id, verification_token, 
                    verification_expires, email_verified
                FROM client_branches 
                WHERE verification_token = $1`,
                [token]
            );

            if (rows.length === 0) {
                logger.warn('Token de verificación no encontrado', {
                    token: token.substring(0, 8) + '...'
                });

                return res.status(400).json({
                    success: false,
                    message: 'Token de verificación inválido'
                });
            }

            const branch = rows[0];

            // Verificar si el token ha expirado
            if (branch.verification_expires && new Date() > new Date(branch.verification_expires)) {
                logger.warn('Token de verificación expirado', {
                    branchId: branch.branch_id,
                    expiredAt: branch.verification_expires
                });

                return res.status(400).json({
                    success: false,
                    message: 'El token de verificación ha expirado. Solicita un nuevo enlace de verificación.',
                    expired: true
                });
            }

            // Verificar si ya está verificado
            if (branch.email_verified) {
                logger.info('Email de sucursal ya verificado', {
                    branchId: branch.branch_id,
                    email: branch.email_branch
                });

                return res.status(200).json({
                    success: true,
                    message: 'El email ya está verificado. Puedes iniciar sesión.',
                    alreadyVerified: true
                });
            }

            // Verificar y activar la sucursal
            await pool.query(
                `UPDATE client_branches 
                 SET email_verified = true,
                     verification_token = NULL,
                     verification_expires = NULL,
                     updated_at_auth = CURRENT_TIMESTAMP
                 WHERE branch_id = $1`,
                [branch.branch_id]
            );

            logger.info('Email de sucursal verificado exitosamente', {
                branchId: branch.branch_id,
                email: branch.email_branch
            });

            // Registrar en auditoría
            await AuditService.logAuditEvent(
                AuditService.AUDIT_EVENTS.SECURITY_EVENT,
                {
                    details: {
                        action: 'BRANCH_EMAIL_VERIFIED',
                        branchId: branch.branch_id,
                        clientId: branch.client_id,
                        email: branch.email_branch
                    },
                    ipAddress: req.ip
                },
                null, // No hay user_id para branches
                branch.branch_id
            );

            return res.status(200).json({
                success: true,
                message: 'Email de sucursal verificado exitosamente. Ya puedes iniciar sesión.',
                verified: true
            });

        } catch (error) {
            logger.error('Error verificando email de sucursal', {
                error: error.message,
                stack: error.stack,
                token: token ? token.substring(0, 8) + '...' : 'undefined'
            });

            return res.status(500).json({
                success: false,
                message: 'Error interno al verificar email de sucursal'
            });
        }
    }

    /**
     * Reenviar verificación de email para sucursal
     */
    static async resendVerification(req, res) {
        const { email, recaptchaToken } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'El correo electrónico es requerido'
            });
        }

        try {
            logger.info('Reenviando verificación para sucursal', { email, ip: req.ip });

            // Verificar si la sucursal existe
            const { rows } = await pool.query(
                `SELECT branch_id, email_verified, is_login_enabled, branch_name, 
                    client_id, email_branch 
                FROM client_branches WHERE email_branch = $1`,
                [email]
            );

            if (rows.length === 0) {
                // Por seguridad, no indicamos si el correo existe o no
                return res.status(200).json({
                    success: true,
                    message: 'Si tu correo de sucursal está registrado, recibirás un enlace de verificación'
                });
            }

            const branch = rows[0];

            // Verificar que tenga login habilitado
            if (!branch.is_login_enabled) {
                logger.warn('Intento de reenvío en sucursal con login deshabilitado', {
                    branchId: branch.branch_id,
                    email
                });
                return res.status(200).json({
                    success: true,
                    message: 'Si tu correo de sucursal está registrado, recibirás un enlace de verificación'
                });
            }

            // Si ya está verificado, informar sin revelar el estado
            if (branch.email_verified) {
                logger.info('Intento de reenvío a sucursal ya verificada', {
                    branchId: branch.branch_id,
                    email
                });

                return res.status(200).json({
                    success: true,
                    message: 'Si tu correo de sucursal está registrado y no verificado, recibirás un enlace de verificación'
                });
            }

            // Generar nuevo token y fecha de expiración
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

            // Actualizar token en la base de datos
            await pool.query(
                'UPDATE client_branches SET verification_token = $1, verification_expires = $2 WHERE branch_id = $3',
                [verificationToken, verificationExpires, branch.branch_id]
            );

            // Enviar correo de verificación
            try {
                await emailService.sendBranchVerificationEmail(
                    email, 
                    verificationToken,
                    branch.branch_name
                );

                logger.info('Correo de verificación reenviado para sucursal', {
                branchId: branch.branch_id,
                email
                });
                // Registrar en auditoría
                await AuditService.logAuditEvent(
                    AuditService.AUDIT_EVENTS.SECURITY_EVENT,
                    {
                        details: {
                            action: 'BRANCH_VERIFICATION_RESENT',
                            branchId: branch.branch_id,
                            clientId: branch.client_id,
                            email: email
                        },
                        ipAddress: req.ip
                    },
                    null, // No hay user_id para branches
                    branch.branch_id
                );

            } catch (emailError) {
                logger.error('Error enviando correo de verificación para sucursal', {
                    error: emailError.message,
                    branchId: branch.branch_id,
                    email
                });

                return res.status(500).json({
                    success: false,
                    message: 'Error enviando correo de verificación'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Si tu correo de sucursal está registrado, recibirás un enlace de verificación'
            });

        } catch (error) {
            logger.error('Error reenviando verificación para sucursal', {
                error: error.message,
                stack: error.stack,
                email
            });

            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

// Exports con nombres más descriptivos y mejor organización
module.exports = {
    login: BranchAuthController.login.bind(BranchAuthController),
    logout: BranchAuthController.logout.bind(BranchAuthController),
    getProfile: BranchAuthController.getProfile.bind(BranchAuthController),
    checkRegistration: BranchAuthController.checkRegistration.bind(BranchAuthController),
    initiateEmailVerification: BranchAuthController.initiateEmailVerification.bind(BranchAuthController),
    getClientPriceListCode: BranchAuthController.getClientPriceListCode.bind(BranchAuthController),
    verifyEmail: BranchAuthController.verifyEmail.bind(BranchAuthController),
    resendVerification: BranchAuthController.resendVerification.bind(BranchAuthController),
    branchLoginLimiter
};