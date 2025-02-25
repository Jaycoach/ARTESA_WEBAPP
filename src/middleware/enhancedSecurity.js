const rateLimit = require('express-rate-limit');
const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('EnhancedSecurity');

// Configuración base para rate limiters
const rateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Rate limit excedido', {
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        res.status(429).json({
            error: 'Demasiadas solicitudes. Por favor, intente más tarde.'
        });
    }
};

// Rate limiter específico para APIs sensibles
const sensitiveApiLimiter = rateLimit({
    ...rateLimitConfig,
    max: 50, // límite más estricto para APIs sensibles
    message: 'Límite de solicitudes excedido para operaciones sensibles'
});

// Rate limiter para APIs estándar
const standardApiLimiter = rateLimit({
    ...rateLimitConfig,
    max: 100, // límite para APIs estándar
});

// Headers de seguridad mejorados
const enhancedSecurityHeaders = (req, res, next) => {
    // Headers básicos de seguridad
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Política de seguridad de contenido estricta
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' https://cdnjs.cloudflare.com; " +
        "frame-ancestors 'none';"
    );

    // Strict Transport Security
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 
            'max-age=31536000; includeSubDomains; preload');
    }

    // Cache control para endpoints sensibles
    if (req.path.startsWith('/api/secure/') || req.path.startsWith('/api/auth/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    next();
};

// Middleware para trackear intentos de acceso sospechosos
const suspiciousActivityTracker = async (req, res, next) => {
    try {
        const suspiciousPatterns = [
            req.headers['user-agent'] === undefined,
            req.headers['accept-language'] === undefined,
            req.method === 'OPTIONS' && !req.headers['access-control-request-method'],
            req.headers['content-length'] === '0' && req.method === 'POST'
        ];

        if (suspiciousPatterns.some(pattern => pattern)) {
            logger.warn('Actividad sospechosa detectada', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                headers: req.headers,
                timestamp: new Date().toISOString()
            });
        }

        next();
    } catch (error) {
        logger.error('Error en suspiciousActivityTracker', {
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
};

module.exports = {
    sensitiveApiLimiter,
    standardApiLimiter,
    enhancedSecurityHeaders,
    suspiciousActivityTracker
};