const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const PaymentValidators = require('../validators/paymentValidators');
const PaymentSanitization = require('../middleware/paymentSanitization');
const { sensitiveApiLimiter } = require('../middleware/enhancedSecurity');
const AuditMiddleware = require('../middleware/auditMiddleware');

// Aplicar middlewares de seguridad a todas las rutas de pago
router.use(sensitiveApiLimiter);
router.use(PaymentSanitization.sanitizeRequest);
router.use(PaymentSanitization.validateHeaders);
router.use(verifyToken);

// Middleware de auditoría a las rutas de pago
router.use(AuditMiddleware.auditSecurityEvent);

// Ruta para iniciar un pago
router.post('/process',
    PaymentValidators.validateOrderData,
    PaymentValidators.validatePaymentRequest,
    AuditMiddleware.auditPaymentActivity,
    async (req, res) => {
        try {
            // Aquí irá la lógica de procesamiento de pago
            // Por ahora solo devolvemos un mensaje de éxito
            res.status(200).json({
                status: 'success',
                message: 'Pago procesado correctamente',
                data: PaymentValidators.sanitizePaymentResponse(req.sanitizedPaymentData)
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Error procesando el pago'
            });
        }
    }
);

// Ruta para verificar estado de un pago
router.get('/status/:transactionId',
    AuditMiddleware.auditDataAccess,
    (req, res) => {
        // Implementar verificación de estado
    }
);

// Aplicar sanitización a todas las respuestas
router.use(PaymentSanitization.sanitizeResponse);

module.exports = router;