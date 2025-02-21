// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar que se proporcionaron email y password
        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña son requeridos' });
        }

        // Buscar el usuario en la base de datos
        const result = await pool.query(
            'SELECT * FROM users WHERE mail = $1',
            [email]
        );

        const user = result.rows[0];

        // Verificar si el usuario existe
        if (!user) {
            return res.status(401).json({ message: 'Email o contraseña incorrectos' });
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
                    [hashedPassword, email]
                );
            }
        }

        if (!isValidPassword) {
            return res.status(401).json({ message: 'Email o contraseña incorrectos' });
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.mail,
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
                email: user.mail,
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
        const { email, password, name } = req.body;

        // Validaciones básicas
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        // Verificar si el usuario ya existe
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE mail = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }

        // Hashear la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar nuevo usuario
        const result = await pool.query(
            'INSERT INTO users (mail, password, name, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
            [email, hashedPassword, name]
        );

        const newUser = result.rows[0];

        // Generar token JWT
        const token = jwt.sign(
            { 
                userId: newUser.id, 
                email: newUser.mail,
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
                email: newUser.mail,
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