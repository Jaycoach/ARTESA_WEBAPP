const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createContextLogger } = require('../config/logger');
const Roles = require('../models/Roles');
const { TokenRevocation } = require('../middleware/tokenRevocation');
const { validateRecaptcha } = require('../utils/recaptchaValidator');
const crypto = require('crypto');
const EmailService = require('../services/EmailService');

// Crear una instancia del logger con contexto
const logger = createContextLogger('AuthController');

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - mail
 *         - password
 *       properties:
 *         mail:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *         password:
 *           type: string
 *           format: password
 *           description: Contraseña del usuario
 *       example:
 *         mail: usuario@example.com
 *         password: contraseña123
 *     
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Login exitoso
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: John Doe
 *                 mail:
 *                   type: string
 *                   example: john@example.com
 *                 is_active:
 *                   type: boolean
 *                   example: true
 *                 role:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 2
 *                     name:
 *                       type: string
 *                       example: USER
 *     
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - mail
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           description: Nombre completo del usuario
 *           example: John Doe
 *         mail:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *           example: john@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: Contraseña del usuario
 *           example: Contraseña123
 */

// Configuración del rate limiter
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5,
    message: 'Demasiados intentos de login. Por favor, intenta más tarde.',
    standardHeaders: true,
    legacyHeaders: false
});

class AuthController {
    // Mapa para rastreo de intentos de login
    static loginAttempts = new Map();
    
    // Constantes de clase usando getters
    static get MAX_LOGIN_ATTEMPTS() { return 5; }
    static get LOCKOUT_TIME() { return 15 * 60 * 1000; } // 15 minutos
    static get PASSWORD_HASH_ROUNDS() { return 10; }

    // Método para registrar intentos de login
    static async logLoginAttempt(userId, ipAddress, status = 'success', details = null, req = null) {
        try {
            const logEntry = {
                user_id: userId,
                ip_address: ipAddress,
                status: status,
                attempt_details: details,
                user_agent: req?.headers?.['user-agent'] || null,
                timestamp: new Date()
            };
    
            // Si no hay userId, solo loguea pero no guarda en la base de datos
            if (!userId) {
                logger.warn('Intento de login sin usuario identificado', {
                    ip: ipAddress,
                    status,
                    details
                });
                return;
            }
    
            await pool.query(
                `INSERT INTO login_history 
                (user_id, ip_address, status, attempt_details, user_agent) 
                VALUES ($1, $2, $3, $4, $5)`,
                [userId, ipAddress, status, details, logEntry.user_agent]
            );

            if (status === 'success') {
                logger.info('Inicio de sesión exitoso', logEntry);
            } else {
                logger.warn('Intento de inicio de sesión fallido', logEntry);
            }
        } catch (error) {
            logger.error('Error al registrar intento de login', {
                error: error.message,
                stack: error.stack,
                userId
            });
        }
    }

    // Método mejorado para incrementar intentos de login
static incrementLoginAttempts(mail) {
    const currentAttempts = this.loginAttempts.get(mail) || { 
        count: 0, 
        timestamp: Date.now() 
    };

    // Incrementar el contador
    currentAttempts.count++;
    currentAttempts.timestamp = Date.now();
    this.loginAttempts.set(mail, currentAttempts);

    logger.warn('Incremento de intentos de login', { 
        mail,
        attemptCount: currentAttempts.count,
        timestamp: new Date(currentAttempts.timestamp)
    });

    return currentAttempts;
}

    // Método para generar token JWT
    static async generateToken(user) {
        try {
          // Obtener el nombre del rol
          const roles = await Roles.getRoles();
          const roleName = Object.keys(roles).find(key => roles[key] === user.rol_id) || 'UNKNOWN';
      
          // Crear payload del token
          const payload = {
            id: user.id,
            mail: user.mail,
            name: user.name,
            rol_id: user.rol_id,
            role: roleName
          };
      
          // Calcular tiempo de expiración
          const expiresIn = '24h';
          const expiresInSeconds = 24 * 60 * 60; // 24 horas en segundos
          const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      
          // Generar el token
          const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn }
          );
      
          logger.info('Token generado exitosamente', { 
            userId: user.id,
            mail: user.mail,
            role: roleName,
            expiresAt
          });
      
          // Revocar todos los tokens anteriores del usuario para seguridad
          logger.debug('Revocando tokens anteriores del usuario', { userId: user.id });
          // Registrar token activo en la base de datos        
          await TokenRevocation.revokeAllUserTokens(user.id, 'new_login', token);
      
          return token;
        } catch (error) {
          logger.error('Error al generar token', {
            error: error.message,
            stack: error.stack,
            userId: user.id
          });
          throw new Error('Error al generar token de autenticación');
        }
      }     

    /**
     * @swagger
     * /api/auth/login:
     *   post:
     *     summary: Inicio de sesión de usuario
     *     description: Autentica a un usuario y devuelve un token JWT
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LoginRequest'
     *     responses:
     *       200:
     *         description: Login exitoso
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/LoginResponse'
     *       400:
     *         description: Credenciales incompletas
     *       401:
     *         description: Credenciales inválidas
     *       429:
     *         description: Demasiados intentos de login
     *       500:
     *         description: Error interno del servidor
     */
    static async login(req, res) {
        try {
            const { mail, password } = req.body;
            logger.debug('Iniciando proceso de login', { mail });

            // Validar reCAPTCHA solo si está configurado
            if (process.env.RECAPTCHA_ENABLED === 'true' && process.env.NODE_ENV !== 'development') {
                const recaptchaResponse = req.body.recaptchaToken || req.body['g-recaptcha-response'] || req.body.captchaToken;
                
                if (!recaptchaResponse) {
                    logger.warn('Intento de login sin token reCAPTCHA', { mail, ip: req.ip });
                    return res.status(400).json({
                        success: false,
                        message: 'Por favor, complete la verificación de seguridad'
                    });
                }
                
                const recaptchaValid = await validateRecaptcha(recaptchaResponse, req);
                
                if (!recaptchaValid) {
                    logger.warn('Verificación reCAPTCHA fallida en login', {
                        mail,
                        ip: req.ip
                    });
                    
                    return res.status(400).json({
                        success: false,
                        message: 'Verificación de seguridad fallida. Por favor, intenta nuevamente.'
                    });
                }
            } else if (process.env.NODE_ENV === 'development') {
                logger.debug('Saltando verificación de reCAPTCHA en desarrollo', { mail });
            }
    
            // 1. Verificación inicial de credenciales
            if (!mail || !password) {
                logger.warn('Intento de login sin credenciales completas', {
                    mail: mail || 'No proporcionado',
                    hasPassword: !!password
                });
                return res.status(400).json({
                    success: false,
                    message: 'Credenciales incompletas'
                });
            }
    
            // 2. Verificar intentos de login ANTES de incrementar el contador
            try {
                // Obtener los intentos actuales sin incrementar
                const currentAttempts = this.loginAttempts.get(mail) || { 
                    count: 0, 
                    timestamp: Date.now() 
                };
    
                // Verificar si ya está bloqueado
                if (currentAttempts.count >= this.MAX_LOGIN_ATTEMPTS) {
                    const timeElapsed = Date.now() - currentAttempts.timestamp;
                    if (timeElapsed < this.LOCKOUT_TIME) {
                        const remainingTime = Math.ceil(
                            (this.LOCKOUT_TIME - timeElapsed) / 1000
                        );
                        logger.warn('Cuenta bloqueada por múltiples intentos', {
                            mail,
                            remainingTime
                        });
                        return res.status(429).json({
                            success: false,
                            message: `Demasiados intentos fallidos. Por favor, intente nuevamente en ${remainingTime} segundos.`,
                            remainingTime
                        });
                    }
                    // Si ha pasado el tiempo de bloqueo, resetear el contador
                    currentAttempts.count = 0;
                    this.loginAttempts.set(mail, currentAttempts);
                }
            } catch (error) {
                logger.error('Error al verificar intentos de login', {
                    error: error.message,
                    mail
                });
                // Continuamos con el proceso de login en caso de error
            }
    
            // 3. Buscar usuario y verificar estado
            const query = `
            SELECT 
                u.id,
                u.name,
                u.mail,
                u.password,
                u.rol_id,
                u.is_active,
                COALESCE(u.email_verified, true) as email_verified,
                r.nombre as role_name
            FROM users u
            JOIN roles r ON u.rol_id = r.id
            WHERE u.mail = $1
        `;
            
            const result = await pool.query(query, [mail]);
    
            if (result.rows.length === 0) {
                // IMPORTANTE: incrementar intentos solo en caso de fallo
                this.incrementLoginAttempts(mail);
                
                await this.logLoginAttempt(
                    null, 
                    req.ip, 
                    'failed', 
                    'Usuario no encontrado o inactivo', 
                    req
                );
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }
    
            const user = result.rows[0];

            // Verificar si el usuario está activo
            if (!user.is_active) {
                logger.warn('Intento de login con usuario inactivo', {
                    mail,
                    userId: user.id
                });
                
                await this.logLoginAttempt(
                    user.id, 
                    req.ip, 
                    'failed', 
                    'Usuario inactivo', 
                    req
                );
                
                return res.status(401).json({
                    success: false,
                    message: 'Tu cuenta está inactiva. Por favor contacta al administrador.',
                    accountInactive: true
                });
            }

            // Verificar si el correo está verificado (advertencia, no bloqueo)
            // Verificar si el correo está verificado (si existe el campo)
            if (user.hasOwnProperty('email_verified') && !user.email_verified) {
                logger.warn('Intento de login con correo no verificado', {
                mail,
                userId: user.id
                });
                
                await this.logLoginAttempt(
                    user.id, 
                    req.ip, 
                    'failed', 
                    'Correo no verificado', 
                    req
                );
                
                return res.status(401).json({
                success: false,
                message: 'Por favor verifica tu correo electrónico antes de iniciar sesión',
                needsVerification: true
                });
            }

            // 4. Verificación de contraseña
            try {
                if (!user.password) {
                    logger.error('Hash de contraseña no encontrado', { 
                        userId: user.id,
                        mail 
                    });
                    return res.status(500).json({
                        success: false,
                        message: 'Error en la verificación de credenciales'
                    });
                }
    
                const isValidPassword = await bcrypt.compare(password, user.password);
                logger.debug('Resultado de verificación de contraseña', {
                    userId: user.id,
                    isValid: isValidPassword
                });
    
                if (!isValidPassword) {
                    // IMPORTANTE: incrementar intentos solo en caso de fallo
                    this.incrementLoginAttempts(mail);
                    
                    await this.logLoginAttempt(
                        user.id, 
                        req.ip, 
                        'failed', 
                        'Contraseña incorrecta', 
                        req
                    );
                    return res.status(401).json({
                        success: false,
                        message: 'Credenciales inválidas'
                    });
                }
    
                // 5. Autenticación exitosa - RESETEAR el contador de intentos
                // Eliminar los intentos fallidos para este correo
                this.loginAttempts.delete(mail);
                logger.debug('Intentos de login reseteados tras autenticación exitosa', { mail });
                
                const token = await this.generateToken(user);
    
                await this.logLoginAttempt(
                    user.id,
                    req.ip,
                    'success',
                    null,
                    req
                );
    
                // Revocar tokens anteriores del usuario
                await TokenRevocation.revokeAllUserTokens(user.id, 'new_login');
    
                logger.info('Login exitoso', {
                    userId: user.id,
                    mail: user.mail,
                    role: user.role_name
                });
    
                const expiresInSeconds = 24 * 60 * 60; // 24 horas en segundos
    
                return res.status(200).json({
                    success: true,
                    message: 'Login exitoso',
                    data: {
                      token,
                      expiresIn: expiresInSeconds,
                      user: {
                        id: user.id,
                        name: user.name,
                        mail: user.mail,
                        is_active: user.is_active,
                        role: {
                          id: user.rol_id,
                          name: user.role_name
                        }
                      }
                    }
                  });
    
            } catch (compareError) {
                logger.error('Error en la comparación de contraseñas', {
                    error: compareError.message,
                    stack: compareError.stack,
                    userId: user.id
                });
                
                return res.status(500).json({
                    success: false,
                    message: 'Error en la verificación de credenciales'
                });
            }
    
        } catch (error) {
            logger.error('Error en el proceso de login', {
                error: error.message,
                stack: error.stack,
                mail
            });
            
            const errorMessage = process.env.NODE_ENV === 'development' 
                ? error.message 
                : 'Error interno del servidor';
            
            return res.status(500).json({
                success: false,
                message: errorMessage
            });
        }
    }

    /**
     * @swagger
     * /api/auth/register:
     *   post:
     *     summary: Registro de nuevo usuario
     *     description: Registra un nuevo usuario en el sistema y devuelve un token JWT
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/RegisterRequest'
     *     responses:
     *       201:
     *         description: Usuario registrado exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/LoginResponse'
     *       400:
     *         description: Datos inválidos o correo ya registrado
     *       500:
     *         description: Error interno del servidor
     */
    static async register(req, res) {
        try {
            const { name, mail, password, recaptchaToken } = req.body;
            logger.debug('Iniciando proceso de registro', { mail });

            // Validar reCAPTCHA solo si está configurado
            if (process.env.RECAPTCHA_ENABLED === 'true' && process.env.NODE_ENV !== 'development') {
                const recaptchaResponse = req.body.recaptchaToken || req.body['g-recaptcha-response'] || req.body.captchaToken;
                
                if (!recaptchaResponse) {
                    logger.warn('Intento de login sin token reCAPTCHA', { mail, ip: req.ip });
                    return res.status(400).json({
                        success: false,
                        message: 'Por favor, complete la verificación de seguridad'
                    });
                }
                
                const recaptchaValid = await validateRecaptcha(recaptchaResponse, req);
                
                if (!recaptchaValid) {
                    logger.warn('Verificación reCAPTCHA fallida en login', {
                        mail,
                        ip: req.ip
                    });
                    
                    return res.status(400).json({
                        success: false,
                        message: 'Verificación de seguridad fallida. Por favor, intenta nuevamente.'
                    });
                }
            } else if (process.env.NODE_ENV === 'development') {
                logger.debug('Saltando verificación de reCAPTCHA en desarrollo', { mail });
            }

            // 1. Verificar si el usuario ya existe
            const userExists = await pool.query(
                'SELECT id FROM users WHERE mail = $1',
                [mail]
            );

            if (userExists.rows.length > 0) {
                logger.warn('Intento de registro con correo existente', { mail });
                return res.status(400).json({
                    success: false,
                    message: 'El correo electrónico ya está registrado'
                });
            }

            // 2. Hash de la contraseña
            const hashedPassword = await bcrypt.hash(password, this.PASSWORD_HASH_ROUNDS);

            // 3. Obtener el rol de usuario por defecto
            const userRoleId = await Roles.getRoleId('USER');
            if (!userRoleId) {
                logger.error('No se pudo obtener el ID del rol de usuario');
                throw new Error('Error en la configuración de roles');
            }  

            // 4. Insertar nuevo usuario con campos de verificación
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

            const result = await pool.query(
                `INSERT INTO users 
                (name, mail, password, rol_id, is_active, email_verified, verification_token, verification_expires) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, name, mail, rol_id`,
                [name, mail, hashedPassword, userRoleId, true, false, verificationToken, verificationExpires]
            );
            
            const newUser = result.rows[0];
            const userId = newUser.id;

            // Enviar correo de verificación
            try {
            const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
            
            await EmailService.sendVerificationEmail(mail, verificationToken, verificationUrl);
            
            logger.info('Correo de verificación enviado', {
                userId,
                mail
            });
            } catch (emailError) {
            logger.error('Error al enviar correo de verificación', {
                error: emailError.message,
                userId,
                mail
            });
            // No hacemos rollback aquí, el usuario se ha creado correctamente
            }

            // 5. Obtener el nombre del rol
            const { rows: roleRows } = await pool.query(
                'SELECT nombre FROM roles WHERE id = $1',
                [userRoleId]
            );

            const userWithRole = {
                ...newUser,
                role: {
                    id: userRoleId,
                    name: roleRows[0]?.nombre
                }
            };

            const token = await this.generateToken(userWithRole);

            logger.info('Usuario registrado exitosamente', {
                userId: newUser.id,
                mail: mail,
                role: roleRows[0]?.nombre
            });

            return res.status(201).json({
                success: true,
                message: 'Usuario registrado exitosamente',
                data: {
                    token,
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        mail: newUser.mail,
                        role: {
                            id: userRoleId,
                            name: roleRows[0]?.nombre
                        }
                    }
                }
            });

        } catch (error) {
            logger.error('Error en el proceso de registro', {
                error: error.message,
                stack: error.stack,
                mail: req.body.mail
            });

            const errorMessage = process.env.NODE_ENV === 'development' 
                ? error.message 
                : 'Error interno del servidor';

            return res.status(500).json({
                success: false,
                message: errorMessage
            });
        }
    }

    /**
     * Verifica el correo electrónico de un usuario
     * @async
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    static async verifyEmail(req, res) {
        const { token } = req.params;
        
        try {
            logger.debug('Verificando token de correo electrónico', { token });
            
            // Buscar usuario por token de verificación
            const userQuery = await pool.query(
            `SELECT id, mail, name, is_active, email_verified, verification_expires 
            FROM users 
            WHERE verification_token = $1`,
            [token]
            );
            
            if (userQuery.rows.length === 0) {
            logger.warn('Token de verificación no encontrado', { token });
            return res.status(400).json({
                success: false,
                message: 'El token de verificación es inválido'
            });
            }
            
            const user = userQuery.rows[0];
            
            // Verificar si el token ha expirado
            if (user.verification_expires && new Date() > new Date(user.verification_expires)) {
            logger.warn('Token de verificación expirado', { 
                userId: user.id,
                expiredAt: user.verification_expires 
            });
            return res.status(400).json({
                success: false,
                message: 'El token de verificación ha expirado',
                expired: true
            });
            }
            
            // Si el usuario ya está verificado y activo
            if (user.email_verified && user.is_active) {
            logger.info('Usuario ya verificado previamente', {
                userId: user.id,
                mail: user.mail
            });
            
            return res.status(200).json({
                success: true,
                message: 'Correo electrónico ya verificado. Puedes iniciar sesión.',
                alreadyVerified: true
            });
            }
            
            // Activar y verificar el usuario
            await pool.query(
            `UPDATE users 
            SET email_verified = true, 
                is_active = true,
                verification_token = NULL, 
                verification_expires = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1`,
            [user.id]
            );
            
            logger.info('Usuario verificado y activado exitosamente', {
            userId: user.id,
            mail: user.mail
            });
            
            // Enviar correo de confirmación
            try {
            await EmailService.sendVerificationConfirmationEmail(user.mail, user.name);
            logger.info('Correo de confirmación enviado', {
                userId: user.id,
                mail: user.mail
            });
            } catch (emailError) {
            logger.error('Error al enviar correo de confirmación', {
                error: emailError.message,
                userId: user.id
            });
            // No detener el proceso si falla el envío del correo
            }
            
            return res.status(200).json({
            success: true,
            message: 'Correo electrónico verificado exitosamente. Tu cuenta está ahora activa.',
            verified: true
            });
            
        } catch (error) {
            logger.error('Error al verificar correo electrónico', {
            error: error.message,
            stack: error.stack,
            token
            });
            
            return res.status(500).json({
            success: false,
            message: 'Error interno al verificar correo electrónico'
            });
        }
    }

    /**
     * Reenvía el correo de verificación a un usuario
     * @async
     * @param {Object} req - Objeto de solicitud Express
     * @param {Object} res - Objeto de respuesta Express
     */
    static async resendVerification (req, res) {
        const { mail } = req.body;
        
        if (!mail) {
        return res.status(400).json({
            success: false,
            message: 'El correo electrónico es requerido'
        });
        }
        
        try {
        logger.debug('Reenviando correo de verificación', { mail });
        
        // Verificar si el usuario existe y necesita verificación
        const { rows } = await pool.query(
            'SELECT id, email_verified FROM users WHERE mail = $1',
            [mail]
        );
        
        if (rows.length === 0) {
            // Por seguridad, no indicamos si el correo existe o no
            return res.status(200).json({
            success: true,
            message: 'Si tu correo está registrado, recibirás un enlace de verificación'
            });
        }
        
        const userId = rows[0].id;
        
        // Si ya está verificado, informar sin revelar el estado
        if (rows[0].email_verified) {
            logger.info('Intento de reenvío a correo ya verificado', {
                userId,
                mail
            });
            
            return res.status(200).json({
                success: true,
                message: 'Si tu correo está registrado y no verificado, recibirás un enlace de verificación'
            });
        }
        
        // Generar nuevo token y fecha de expiración
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
        
        // Verificar si hay tokens previos
        const previousTokenQuery = await pool.query(
            'SELECT verification_token FROM users WHERE id = $1 AND verification_token IS NOT NULL',
            [userId]
        );
        
        // Si hay un token previo, lo invalidamos en la tabla de tokens
        if (previousTokenQuery.rows.length > 0 && previousTokenQuery.rows[0].verification_token) {
            const oldToken = previousTokenQuery.rows[0].verification_token;
            await pool.query(
            'DELETE FROM tokens WHERE token = $1',
            [oldToken]
            );
            logger.debug('Token de verificación previo invalidado', { userId, mail });
        }

        // Actualizar token en la base de datos
        await pool.query(
            'UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3',
            [verificationToken, verificationExpires, userId]
        );
        
        // Enviar correo de verificación
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        await EmailService.sendVerificationEmail(mail, verificationToken, verificationUrl);
        
        logger.info('Correo de verificación reenviado', {
            userId,
            mail
        });

        // Registrar el nuevo token en active_tokens
        await pool.query(
            `INSERT INTO active_tokens (token_hash, user_id, issued_at, expires_at, device_info, ip_address) 
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
            ON CONFLICT (token_hash) DO NOTHING`,
            [
                verificationToken, 
                userId, 
                verificationExpires, 
                req.headers['user-agent'] || null, 
                req.ip
            ]
        );
        
        logger.info('Token de verificación registrado como activo', { userId, mail });
        
        res.status(200).json({
            success: true,
            message: 'Si tu correo está registrado, recibirás un enlace de verificación'
        });
        } catch (error) {
        logger.error('Error al reenviar correo de verificación', {
            error: error.message,
            stack: error.stack,
            mail
        });
        
        res.status(500).json({
            success: false,
            message: 'Error al procesar la solicitud',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    };

    // Método para verificar token JWT
    static async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Verificar si el rol sigue siendo válido
            const roles = await Roles.getRoles();
            if (!Object.values(roles).includes(decoded.rol_id)) {
                throw new Error('Rol no válido');
            }

            return decoded;
        } catch (error) {
            logger.error('Error al verificar token', {
                error: error.message,
                tokenPrefix: token.substring(0, 10) + '...'
            });
            throw new Error('Token inválido o expirado');
        }
    }
    //Añadir método para manejo de tokens al reiniciar el servidor
    // Esta función se llamaría en el arranque de la aplicación
    static async handleServerRestart() {
        try {
        logger.info('Verificando tokens en reinicio del servidor');
        
        // Invalidar todos los tokens anteriores al reinicio
        const query = `
            INSERT INTO revoked_tokens (token_hash, user_id, revoked_at, expires_at, revocation_reason)
            VALUES ('server_restart', NULL, NOW(), NOW() + INTERVAL '30 days', 'server_restart')
        `;
        
        await pool.query(query);
        
        logger.info('Todos los tokens anteriores al reinicio del servidor han sido invalidados');
        
        // Limpiar tokens revocados expirados
        await TokenRevocation.cleanupExpiredTokens();
        
        return true;
        } catch (error) {
        logger.error('Error al manejar reinicio del servidor para tokens', {
            error: error.message,
            stack: error.stack
        });
        return false;
        }
    }
}

module.exports = {
    login: AuthController.login.bind(AuthController),
    register: AuthController.register.bind(AuthController),
    verifyToken: AuthController.verifyToken.bind(AuthController),
    handleServerRestart: AuthController.handleServerRestart.bind(AuthController),
    verifyEmail: AuthController.verifyEmail.bind(AuthController),
    resendVerification: AuthController.resendVerification.bind(AuthController),
    loginLimiter
};