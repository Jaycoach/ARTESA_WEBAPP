const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Configuración de logging con Winston
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/auth.log',
            level: 'debug'
        }),
        new winston.transports.File({ 
            filename: 'logs/errors.log', 
            level: 'error' 
        })
    ]
});

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
                stack: error.stack
            });
        }
    }

    // Método para incrementar y verificar intentos de login
    static incrementLoginAttempts(mail) {
        const currentAttempts = this.loginAttempts.get(mail) || { 
            count: 0, 
            timestamp: Date.now() 
        };

        if (currentAttempts.count >= this.MAX_LOGIN_ATTEMPTS) {
            const timeElapsed = Date.now() - currentAttempts.timestamp;
            if (timeElapsed < this.LOCKOUT_TIME) {
                const remainingTime = Math.ceil((this.LOCKOUT_TIME - timeElapsed) / 1000);
                throw new Error(`Cuenta bloqueada. Intente nuevamente en ${remainingTime} segundos`);
            }
            currentAttempts.count = 0;
        }

        currentAttempts.count++;
        currentAttempts.timestamp = Date.now();
        this.loginAttempts.set(mail, currentAttempts);

        logger.warn('Incremento de intentos de login', { 
            mail,
            attemptCount: currentAttempts.count 
        });

        return currentAttempts;
    }

    // Método para generar token JWT
    static generateToken(user) {
        try {
            const token = jwt.sign(
                {
                    id: user.id,
                    mail: user.mail,
                    name: user.name,
                    rol_id: user.rol_id
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            logger.info('Token generado exitosamente', { 
                userId: user.id,
                mail: user.mail 
            });

            return token;
        } catch (error) {
            logger.error('Error al generar token', {
                error: error.message,
                userId: user.id
            });
            throw new Error('Error al generar token de autenticación');
        }
    }

    // Método principal de login
    static async login(req, res) {
        try {
            const { mail, password } = req.body;

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

            // 2. Verificar intentos de login
            try {
                const attempts = this.incrementLoginAttempts(mail);
                if (attempts.count >= this.MAX_LOGIN_ATTEMPTS) {
                    const error = new Error('Demasiados intentos fallidos');
                    error.remainingTime = Math.ceil(
                        (this.LOCKOUT_TIME - (Date.now() - attempts.timestamp)) / 1000
                    );
                    throw error;
                }
            } catch (error) {
                return res.status(429).json({
                    success: false,
                    message: error.message,
                    remainingTime: error.remainingTime
                });
            }

            // 3. Buscar usuario y verificar estado
            const query = `
                SELECT 
                    id,
                    name,
                    mail,
                    password,
                    rol_id,
                    is_active
                FROM users 
                WHERE mail = $1 AND is_active = true
            `;
            
            const result = await pool.query(query, [mail]);

            if (result.rows.length === 0) {
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

            // 4. Verificación de contraseña
            try {
                if (!user.password) {
                    logger.error(`Hash de contraseña no encontrado para usuario: ${mail}`);
                    return res.status(500).json({
                        success: false,
                        message: 'Error en la verificación de credenciales'
                    });
                }

                const isValidPassword = await bcrypt.compare(password, user.password);
                logger.debug(`Resultado de comparación de contraseña para ${mail}: ${isValidPassword}`);

                if (!isValidPassword) {
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

                // 5. Autenticación exitosa
                const token = this.generateToken(user);
                this.loginAttempts.delete(mail); // Resetear intentos

                await this.logLoginAttempt(
                    user.id,
                    req.ip,
                    'success',
                    null,
                    req
                );

                return res.status(200).json({
                    success: true,
                    message: 'Login exitoso',
                    data: {
                        token,
                        user: {
                            id: user.id,
                            name: user.name,
                            mail: user.mail,
                            rol_id: user.rol_id
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
                stack: error.stack
            });
            
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Método de registro
    static async register(req, res) {
        try {
            const { name, mail, password } = req.body;

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

            // 3. Insertar nuevo usuario
            const result = await pool.query(
                `INSERT INTO users 
                (name, mail, password, rol_id, is_active) 
                VALUES ($1, $2, $3, $4, true)
                RETURNING id, name, mail, rol_id`,
                [name, mail, hashedPassword, 2] // rol_id 2 = usuario normal
            );

            const newUser = result.rows[0];
            const token = this.generateToken(newUser);

            logger.info('Usuario registrado exitosamente', {
                mail: mail,
                userId: newUser.id
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
                        rol_id: newUser.rol_id
                    }
                }
            });

        } catch (error) {
            logger.error('Error en el proceso de registro', {
                error: error.message,
                stack: error.stack,
                mail: req.body.mail
            });

            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Método para verificar token JWT
    static async verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            logger.error('Error al verificar token', {
                error: error.message,
                token: token.substring(0, 10) + '...' // Log seguro del token
            });
            throw new Error('Token inválido o expirado');
        }
    }
}

module.exports = {
    login: AuthController.login.bind(AuthController),
    register: AuthController.register.bind(AuthController),
    verifyToken: AuthController.verifyToken.bind(AuthController),
    loginLimiter
};