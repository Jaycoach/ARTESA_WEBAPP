const { createContextLogger } = require('../config/logger');
const validator = require('validator');
const logger = createContextLogger('PaymentSanitization');

class PaymentSanitization {
    // Sanitizar datos de entrada
    static sanitizeInput = (input) => {
        if (typeof input === 'string') {
            return validator.escape(input.trim());
        }
        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        return input;
    }

    // Middleware para sanitizar request
    static sanitizeRequest = (req, res, next) => {
        try {
            // Sanitizar body
            if (req.body) {
                req.body = this.sanitizeInput(req.body);
            }

            // Sanitizar query params
            if (req.query) {
                req.query = this.sanitizeInput(req.query);
            }

            // Sanitizar params
            if (req.params) {
                req.params = this.sanitizeInput(req.params);
            }

            next();
        } catch (error) {
            logger.error('Error en sanitización de request', {
                error: error.message,
                stack: error.stack
            });
            
            res.status(400).json({
                status: 'error',
                message: 'Error en procesamiento de datos'
            });
        }
    }

    // Sanitizar datos sensibles antes de logging
    static sanitizeForLogging = (data) => {
        const sensitiveFields = [
            'card_number',
            'cvv',
            'password',
            'token',
            'secret'
        ];

        const sanitized = { ...data };
        
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    // Middleware para sanitizar respuesta
    static sanitizeResponse = (req, res, next) => {
        const originalSend = res.send;

        res.send = function (data) {
            // Solo sanitizar respuestas JSON
            if (res.get('Content-Type')?.includes('application/json')) {
                try {
                    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                    const sanitizedData = PaymentSanitization.sanitizeInput(parsedData);
                    
                    arguments[0] = JSON.stringify(sanitizedData);
                } catch (error) {
                    logger.error('Error sanitizando respuesta', {
                        error: error.message
                    });
                }
            }
            
            originalSend.apply(res, arguments);
        };

        next();
    }

    // Validar y sanitizar headers específicos de pago
    static validateHeaders = (req, res, next) => {
        const requiredHeaders = ['x-transaction-id', 'x-client-id'];
        const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);

        if (missingHeaders.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Headers requeridos faltantes: ${missingHeaders.join(', ')}`
            });
        }

        // Sanitizar headers personalizados
        requiredHeaders.forEach(header => {
            req.headers[header] = validator.escape(req.headers[header]);
        });

        next();
    }
}

module.exports = PaymentSanitization;