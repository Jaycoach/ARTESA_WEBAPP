const rateLimit = require('express-rate-limit');
const { createContextLogger } = require('../config/logger');
const logger = createContextLogger('EnhancedSecurity');

// Configuración base para rate limiters
const rateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    standardHeaders: true,
    legacyHeaders: false,
    // Detectar ambiente de desarrollo
    max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Mucho más permisivo en desarrollo
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
    max: process.env.NODE_ENV === 'development' ? 500 : 50, // Más permisivo en desarrollo
    message: 'Límite de solicitudes excedido para operaciones sensibles'
});

// Rate limiter para APIs estándar
const standardApiLimiter = rateLimit({
    ...rateLimitConfig,
    max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Más permisivo en desarrollo
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
        // No registrar health checks como actividad sospechosa
        if (req.path === '/api/health' || req.path === '/api/health/simple' || req.path === '/health') {
            return next();
        }
        // No registrar uploads como actividad sospechosa
        if (req.path.startsWith('/api/upload') || req.path.startsWith('/api/client-profiles')) {
            return next();
        }

        const suspiciousPatterns = [
            req.headers['user-agent'] === undefined,
            req.headers['accept-language'] === undefined,
            req.method === 'OPTIONS' && !req.headers['access-control-request-method'],
            req.originalUrl.includes('.php'),
            req.originalUrl.includes('geoip'),
            req.originalUrl.includes('systembc'),
            req.originalUrl.includes('wp-admin'),
            req.originalUrl.includes('xmlrpc'),
            /\/[A-Z]{2,}\//.test(req.originalUrl), // Detecta URLs con códigos de país
            req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('bot'),
            req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('scanner'),
            req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('curl') && !req.path.startsWith('/api/upload'),
            !req.headers['accept-language'] && req.method === 'GET'
        ];

        if (suspiciousPatterns.some(pattern => pattern)) {
            const logLevel = req.path.includes('/health') ? 'debug' : 'warn';
            logger[logLevel]('Actividad sospechosa detectada', {
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

const sendVerificationEmail = async (userEmail, verificationToken, verificationUrl) => {
    try {
      logger.info('Intentando enviar correo de verificación', {
        to: userEmail,
        verificationUrl: verificationUrl
      });
  
      const mailOptions = {
        from: {
          name: 'La Artesa',
          address: process.env.SMTP_FROM
        },
        to: userEmail,
        subject: 'Verificación de Correo Electrónico - La Artesa',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Verificación de Correo Electrónico</h1>
            <p>Gracias por registrarte en La Artesa. Por favor, verifica tu dirección de correo electrónico para activar tu cuenta.</p>
            <p>Utiliza el siguiente token para verificar tu correo:</p>
            <div style="background-color: #f5f5f5; padding: 10px; margin: 20px 0; word-break: break-all;">
              <code>${verificationToken}</code>
            </div>
            <p>O haz clic en el siguiente enlace:</p>
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 10px 20px; 
                      background-color: #007bff; color: white; 
                      text-decoration: none; border-radius: 5px;">
              Verificar Correo Electrónico
            </a>
            <p>Este enlace expirará en 24 horas.</p>
            <p>Si no solicitaste este registro, puedes ignorar este correo.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
          </div>
        `
      };
  
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Correo de verificación enviado exitosamente', {
        messageId: info.messageId,
        response: info.response
      });
  
      return info;
    } catch (error) {
      logger.error('Error al enviar correo de verificación:', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Error al enviar el correo de verificación: ${error.message}`);
    }
  }

  const registrationLimiter = rateLimit({
    ...rateLimitConfig,
    max: process.env.NODE_ENV === 'development' ? 100 : 10, // Más restrictivo para registros
    message: 'Demasiadas solicitudes de registro. Por favor, intente más tarde.'
});

module.exports = {
    sensitiveApiLimiter,
    standardApiLimiter,
    registrationLimiter,
    enhancedSecurityHeaders,
    suspiciousActivityTracker
};