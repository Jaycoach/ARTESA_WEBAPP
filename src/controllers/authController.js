// src/controllers/authController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const DatabaseUtils = require('../utils/dbUtils');
const AuthValidators = require('../validators/authValidators');
const rateLimit = require('express-rate-limit');

// Cache para intentos de login fallidos
const loginAttempts = new Map();

// Rate limiter para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: 'Demasiados intentos de login. Por favor, intenta más tarde.'
});

const loginUser = async (req, res) => {
    try {
        // Validar email
        const emailValidation = AuthValidators.validateEmail(req.body.mail);
        if (!emailValidation.isValid) {
            return res.status(400).json({ message: emailValidation.error });
        }

        // Validar password
        const passwordValidation = AuthValidators.validatePassword(req.body.password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ message: passwordValidation.error });
        }

        const mail = emailValidation.sanitizedValue;
        const password = req.body.password;

        // Verificar intentos de login
        const userAttempts = loginAttempts.get(mail) || { count: 0, timestamp: Date.now() };
        const attemptsValidation = AuthValidators.validateLoginAttempts(userAttempts.count);
        if (!attemptsValidation.isValid) {
            return res.status(429).json({ message: attemptsValidation.error });
        }

        // Buscar usuario usando parametrización segura
        const result = await DatabaseUtils.query(
            'SELECT * FROM users WHERE mail = $1',
            [mail]
        );

        const user = result.rows[0];

        // Verificar si el usuario existe (usar mensaje genérico por seguridad)
        if (!user) {
            incrementLoginAttempts(mail);
            return res.status(401).json({ 
                message: 'Credenciales inválidas' 
            });
        }

        let isValidPassword = false;

        // Verificar contraseña
        if (user.password.startsWith('$2b$')) {
            isValidPassword = await bcrypt.compare(password, user.password);
        } else {
            // Migración automática a bcrypt
            isValidPassword = password === user.password;
            if (isValidPassword) {
                const hashedPassword = await bcrypt.hash(password, 12);
                await DatabaseUtils.query(
                    'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE mail = $2',
                    [hashedPassword, mail]
                );
            }
        }

        if (!isValidPassword) {
            incrementLoginAttempts(mail);
            return res.status(401).json({ 
                message: 'Credenciales inválidas' 
            });
        }

        // Reset intentos de login al tener éxito
        loginAttempts.delete(mail);

        // Generar token JWT con payload mínimo
        const token = jwt.sign(
            { 
                sub: user.id,
                role: user.rol_id
            },
            process.env.JWT_SECRET,
            { 
                expiresIn: '1h',
                algorithm: 'HS256'
            }
        );

        // Registrar login exitoso
        await DatabaseUtils.query(
            'INSERT INTO login_history (user_id, login_timestamp, ip_address) VALUES ($1, CURRENT_TIMESTAMP, $2)',
            [user.id, req.ip]
        );

        // Enviar respuesta con información mínima necesaria
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.rol_id
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const registerUser = async (req, res) => {
    try {
        // Validar todos los campos
        const emailValidation = AuthValidators.validateEmail(req.body.mail);
        const passwordValidation = AuthValidators.validatePassword(req.body.password);
        const nameValidation = AuthValidators.validateName(req.body.name);

        // Recolectar todos los errores
        const errors = {};
        if (!emailValidation.isValid) errors.mail = emailValidation.error;
        if (!passwordValidation.isValid) errors.password = passwordValidation.error;
        if (!nameValidation.isValid) errors.name = nameValidation.error;

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        // Usar valores sanitizados
        const mail = emailValidation.sanitizedValue;
        const name = nameValidation.sanitizedValue;
        const password = req.body.password;

        // Verificar usuario existente de forma segura
        const existingUser = await DatabaseUtils.query(
            'SELECT 1 FROM users WHERE mail = $1',
            [mail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ 
                message: 'El correo electrónico ya está registrado' 
            });
        }

        // Hashear contraseña con salt fuerte
        const hashedPassword = await bcrypt.hash(password, 12);

        // Usar transacción para el registro
        const newUser = await DatabaseUtils.executeTransaction(async (client) => {
            // Insertar usuario
            const result = await client.query(
                `INSERT INTO users (name, mail, password, rol_id, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
                 RETURNING id, name, rol_id`,
                [name, mail, hashedPassword, 2]
            );

            // Registrar la creación en el historial
            await client.query(
                `INSERT INTO user_history (user_id, action, ip_address, timestamp)
                 VALUES ($1, 'REGISTER', $2, CURRENT_TIMESTAMP)`,
                [result.rows[0].id, req.ip]
            );

            return result.rows[0];
        });

        // Generar token JWT con payload mínimo
        const token = jwt.sign(
            { 
                sub: newUser.id,
                role: newUser.rol_id
            },
            process.env.JWT_SECRET,
            { 
                expiresIn: '1h',
                algorithm: 'HS256'
            }
        );

        // Enviar respuesta con información mínima necesaria
        res.status(201).json({
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                role: newUser.rol_id
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// Función auxiliar para incrementar intentos de login
function incrementLoginAttempts(mail) {
    const attempts = loginAttempts.get(mail) || { count: 0, timestamp: Date.now() };
    attempts.count++;
    attempts.timestamp = Date.now();
    loginAttempts.set(mail, attempts);
}

module.exports = {
    loginUser,
    registerUser,
    loginLimiter
};