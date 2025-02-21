// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const loginUser = async (req, res) => {
    try {
        const { mail, password } = req.body;  // Cambiado de email a mail

        // Validar que se proporcionaron mail y password
        if (!mail || !password) {
            return res.status(400).json({ message: 'Correo y contraseña son requeridos' });
        }

        // Buscar el usuario en la base de datos
        const result = await pool.query(
            'SELECT * FROM users WHERE mail = $1',
            [mail]
        );

        const user = result.rows[0];

        // Verificar si el usuario existe
        if (!user) {
            return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
        }

        let isValidPassword = false;

        // Verificar si la contraseña está hasheada
        if (user.password.startsWith('$2b$')) {
            // Contraseña hasheada - usar bcrypt.compare
            isValidPassword = await bcrypt.compare(password, user.password);
        } else {
            // Contraseña sin hashear - comparación directa
            isValidPassword = password === user.password;
            
            // Opcional: Hashear la contraseña automáticamente para futuras validaciones
            if (isValidPassword) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await pool.query(
                    'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE mail = $2',
                    [hashedPassword, mail]
                );
            }
        }

        if (!isValidPassword) {
            return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                mail: user.mail,
                name: user.name,
                role: user.rol_id 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Enviar respuesta exitosa
        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                mail: user.mail,
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
        const { name, mail, password } = req.body;  // Cambiado para coincidir con el swagger

        // Validaciones básicas
        if (!mail || !password || !name) {
            return res.status(400).json({ 
                message: 'Todos los campos son requeridos',
                details: {
                    mail: !mail ? 'El correo es requerido' : null,
                    password: !password ? 'La contraseña es requerida' : null,
                    name: !name ? 'El nombre es requerido' : null
                }
            });
        }

        // Validar longitud mínima de contraseña
        if (password.length < 6) {
            return res.status(400).json({ 
                message: 'La contraseña debe tener al menos 6 caracteres' 
            });
        }

        // Verificar si el usuario ya existe
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE mail = $1',
            [mail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }

        // Hashear la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar nuevo usuario con rol_id por defecto (2)
        const result = await pool.query(
            'INSERT INTO users (name, mail, password, rol_id, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            [name, mail, hashedPassword, 2]  // rol_id = 2 por defecto
        );

        const newUser = result.rows[0];

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: newUser.id, 
                mail: newUser.mail,
                name: newUser.name,
                role: newUser.rol_id 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Enviar respuesta exitosa
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            token,
            user: {
                id: newUser.id,
                mail: newUser.mail,
                name: newUser.name,
                role: newUser.rol_id
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

module.exports = {
    loginUser,
    registerUser
};