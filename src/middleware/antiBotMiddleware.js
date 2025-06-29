const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('AntiBotMiddleware');

// Lista de patrones sospechosos comunes
const SUSPICIOUS_PATTERNS = [
    /\.php$/i,
    /geoip/i,
    /systembc/i,
    /wp-admin/i,
    /wp-login/i,
    /xmlrpc/i,
    /phpmyadmin/i,
    /admin\/config/i,
    /\.env$/i,
    /config\.json$/i,
    /backup/i,
    /sql/i,
    /db/i
];

// User agents sospechosos
const SUSPICIOUS_USER_AGENTS = [
    /bot/i,
    /spider/i,
    /crawler/i,
    /scanner/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /^$/
];

// Función para detectar actividad sospechosa
const detectSuspiciousActivity = (req) => {
    const suspiciousIndicators = [];
    
    // Verificar patrones en la URL
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(req.originalUrl)) {
            suspiciousIndicators.push(`Suspicious URL pattern: ${pattern.toString()}`);
        }
    }
    
    // Verificar User Agent
    const userAgent = req.headers['user-agent'] || '';
    for (const pattern of SUSPICIOUS_USER_AGENTS) {
        if (pattern.test(userAgent)) {
            suspiciousIndicators.push(`Suspicious User Agent: ${userAgent}`);
        }
    }
    
    // Verificar falta de headers comunes
    if (!req.headers['accept-language'] && req.method === 'GET') {
        suspiciousIndicators.push('Missing Accept-Language header');
    }
    
    if (!req.headers['accept'] && req.method === 'GET') {
        suspiciousIndicators.push('Missing Accept header');
    }
    
    return suspiciousIndicators;
};

// Middleware principal anti-bot
const antiBotMiddleware = (req, res, next) => {
    try {
        const suspiciousIndicators = detectSuspiciousActivity(req);
        
        if (suspiciousIndicators.length > 0) {
            logger.warn('Actividad bot/maliciosa detectada', {
                ip: req.ip,
                method: req.method,
                url: req.originalUrl,
                userAgent: req.headers['user-agent'] || 'No User Agent',
                indicators: suspiciousIndicators,
                headers: {
                    'accept': req.headers['accept'],
                    'accept-language': req.headers['accept-language'],
                    'referer': req.headers['referer']
                },
                timestamp: new Date().toISOString()
            });
            
            // Si hay muchos indicadores sospechosos, bloquear la solicitud
            if (suspiciousIndicators.length >= 2) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Acceso denegado',
                    code: 'SUSPICIOUS_ACTIVITY_DETECTED'
                });
            }
        }
        
        next();
    } catch (error) {
        logger.error('Error en antiBotMiddleware', {
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
};

module.exports = antiBotMiddleware;