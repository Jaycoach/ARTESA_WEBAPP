const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createContextLogger } = require('../config/logger');
const Roles = require('../models/Roles');
const { TokenRevocation } = require('../middleware/tokenRevocation');

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
      
          // Registrar token activo en la base de datos
          await TokenRevocation.registerActiveToken(token, user.id, expiresAt);
      
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
                logger.warn('Cuenta bloqueada por múltiples intentos', {
                    mail,
                    remainingTime: error.remainingTime
                });
                return res.status(429).json({
                    success: false,
                    message: error.message,
                    remainingTime: error.remainingTime
                });
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
                    r.nombre as role_name
                FROM users u
                JOIN roles r ON u.rol_id = r.id
                WHERE u.mail = $1 AND u.is_active = true
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
                const token = await this.generateToken(user);
                this.loginAttempts.delete(mail); // Resetear intentos

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
            const { name, mail, password } = req.body;
            logger.debug('Iniciando proceso de registro', { mail });

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

            // 4. Insertar nuevo usuario
            const result = await pool.query(
                `INSERT INTO users 
                (name, mail, password, rol_id, is_active) 
                VALUES ($1, $2, $3, $4, true)
                RETURNING id, name, mail, rol_id`,
                [name, mail, hashedPassword, userRoleId]
            );

            const newUser = result.rows[0];

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
    loginLimiter
};