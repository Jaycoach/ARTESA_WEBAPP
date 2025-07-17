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

// User agents sospechosos (excluyendo los legítimos)
const SUSPICIOUS_USER_AGENTS = [
    /bot/i,
    /spider/i,
    /crawler/i,
    /scanner/i,
    /python-requests/i,
    /^$/
];

// User agents legítimos que deben ser permitidos
const LEGITIMATE_USER_AGENTS = [
    /curl/i,  // Para health checks
    /ELB-HealthChecker/i,  // AWS Load Balancer
    /Docker/i,  // Docker health checks
    /HealthCheck/i,  // Health check genérico
    /Mozilla/i,  // Navegadores reales
    /Chrome/i,
    /Firefox/i,
    /Safari/i,
    /Edge/i
];

// IPs internas que siempre deben ser permitidas
const INTERNAL_IPS = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost'
];

// Rutas que deben ser permitidas sin restricciones
const HEALTH_CHECK_PATHS = [
    '/api/health',
    '/api/health/simple',
    '/health'
];

// Función para verificar si es un user agent legítimo
const isLegitimateUserAgent = (userAgent) => {
    if (!userAgent) return false;
    return LEGITIMATE_USER_AGENTS.some(pattern => pattern.test(userAgent));
};

// Función para verificar si es una IP interna
const isInternalIP = (ip) => {
    return INTERNAL_IPS.includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.');
};

// Función para detectar actividad sospechosa
const detectSuspiciousActivity = (req) => {
    const suspiciousIndicators = [];
    const userAgent = req.headers['user-agent'] || '';
    
    // Si es un health check desde IP interna, no marcar como sospechoso
    if (HEALTH_CHECK_PATHS.includes(req.originalUrl) && isInternalIP(req.ip)) {
        return suspiciousIndicators;
    }
    
    // Si es un user agent legítimo, ser menos estricto
    if (isLegitimateUserAgent(userAgent)) {
        // Solo verificar patrones de URL sospechosos
        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(req.originalUrl)) {
                suspiciousIndicators.push(`Suspicious URL pattern: ${pattern.toString()}`);
            }
        }
    } else {
        // Para user agents no reconocidos, aplicar todas las verificaciones
        
        // Verificar patrones en la URL
        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(req.originalUrl)) {
                suspiciousIndicators.push(`Suspicious URL pattern: ${pattern.toString()}`);
            }
        }
        
        // Verificar User Agent sospechoso
        for (const pattern of SUSPICIOUS_USER_AGENTS) {
            if (pattern.test(userAgent)) {
                suspiciousIndicators.push(`Suspicious User Agent: ${userAgent}`);
            }
        }
        
        // Verificar falta de headers comunes (solo para requests no-health)
        if (!HEALTH_CHECK_PATHS.includes(req.originalUrl)) {
            if (!req.headers['accept-language'] && req.method === 'GET') {
                suspiciousIndicators.push('Missing Accept-Language header');
            }
            
            if (!req.headers['accept'] && req.method === 'GET') {
                suspiciousIndicators.push('Missing Accept header');
            }
        }
    }
    
    return suspiciousIndicators;
};

// Middleware principal anti-bot
const antiBotMiddleware = (req, res, next) => {
    try {
        // Permitir siempre health checks desde IPs internas
        if (HEALTH_CHECK_PATHS.includes(req.originalUrl) && isInternalIP(req.ip)) {
            return next();
        }
        
        // Permitir health checks con user agents de health checkers
        if (HEALTH_CHECK_PATHS.includes(req.originalUrl)) {
            const userAgent = req.headers['user-agent'] || '';
            if (userAgent.includes('ELB-HealthChecker') || 
                userAgent.includes('Docker') || 
                userAgent.includes('HealthCheck')) {
                return next();
            }
        }
        
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
            
            // Solo bloquear si hay muchos indicadores Y no es un health check
            if (suspiciousIndicators.length >= 2 && !HEALTH_CHECK_PATHS.includes(req.originalUrl)) {
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