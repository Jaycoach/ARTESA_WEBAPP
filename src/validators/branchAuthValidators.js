const { body, validationResult } = require('express-validator');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('BranchAuthValidators');

class BranchAuthValidators {
    static validateBranchLoginData = [
        body('email')
            .isEmail()
            .withMessage('Debe proporcionar un email válido')
            .normalizeEmail()
            .isLength({ min: 1, max: 255 })
            .withMessage('El email debe tener entre 1 y 255 caracteres'),
        
        body('password')
            .isLength({ min: 1 })
            .withMessage('La contraseña es requerida')
            .isLength({ max: 255 })
            .withMessage('La contraseña no puede exceder 255 caracteres'),
        
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn('Validación fallida en login de sucursal', {
                    errors: errors.array(),
                    email: req.body.email,
                    ip: req.ip
                });
                
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: errors.array()
                });
            }
            next();
        }
    ];
}

module.exports = BranchAuthValidators;