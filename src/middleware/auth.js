// src/middleware/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Se requiere un token de acceso' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role
        };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expirado' });
        }
        return res.status(401).json({ message: 'Token inválido' });
    }
};

// Middleware para verificar roles
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Se requiere autenticación' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'No tiene permisos para realizar esta acción' 
            });
        }

        next();
    };
};

module.exports = {
    verifyToken,
    checkRole
};