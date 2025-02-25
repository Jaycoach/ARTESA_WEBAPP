const { createContextLogger } = require('../config/logger');
const validator = require('validator');
const logger = createContextLogger('PaymentValidation');

class PaymentValidators {
    // Constantes para validación
    static ALLOWED_CURRENCIES = ['USD', 'EUR', 'COP'];
    static ALLOWED_PAYMENT_METHODS = ['credit_card', 'debit_card', 'transfer'];
    static MIN_AMOUNT = 0.01;
    static MAX_AMOUNT = 999999.99;

    // Validar monto
    static validateAmount(amount) {
        if (typeof amount !== 'number') {
            throw new Error('El monto debe ser un número');
        }
        if (amount < this.MIN_AMOUNT || amount > this.MAX_AMOUNT) {
            throw new Error(`El monto debe estar entre ${this.MIN_AMOUNT} y ${this.MAX_AMOUNT}`);
        }
        // Validar que solo tenga 2 decimales
        if (!Number.isInteger(amount * 100)) {
            throw new Error('El monto no puede tener más de 2 decimales');
        }
        return true;
    }

    // Validar moneda
    static validateCurrency(currency) {
        if (!this.ALLOWED_CURRENCIES.includes(currency)) {
            throw new Error(`Moneda no válida. Permitidas: ${this.ALLOWED_CURRENCIES.join(', ')}`);
        }
        return true;
    }

    // Validar método de pago
    static validatePaymentMethod(method) {
        if (!this.ALLOWED_PAYMENT_METHODS.includes(method)) {
            throw new Error(`Método de pago no válido. Permitidos: ${this.ALLOWED_PAYMENT_METHODS.join(', ')}`);
        }
        return true;
    }

    // Validar número de tarjeta (si aplica)
    static validateCardNumber(number) {
        if (!number) return true; // Si no hay número de tarjeta, no validar
        
        // Eliminar espacios y guiones
        const cleanNumber = number.replace(/[\s-]/g, '');
        
        if (!validator.isCreditCard(cleanNumber)) {
            throw new Error('Número de tarjeta inválido');
        }
        return true;
    }

    // Validar CVV
    static validateCVV(cvv, cardType) {
        if (!cvv) return true;

        const cleanCVV = cvv.replace(/\s/g, '');
        const validLength = cardType === 'amex' ? 4 : 3;

        if (!/^\d+$/.test(cleanCVV) || cleanCVV.length !== validLength) {
            throw new Error('CVV inválido');
        }
        return true;
    }

    // Validar fecha de expiración
    static validateExpiryDate(month, year) {
        if (!month || !year) return true;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const expYear = parseInt(year);
        const expMonth = parseInt(month);

        if (expYear < currentYear || 
            (expYear === currentYear && expMonth < currentMonth) ||
            expYear > currentYear + 10) {
            throw new Error('Fecha de expiración inválida');
        }
        return true;
    }

    // Middleware principal de validación de pagos
    static validatePaymentRequest = (req, res, next) => {
        try {
            const {
                amount,
                currency,
                payment_method,
                card_number,
                cvv,
                expiry_month,
                expiry_year,
                description
            } = req.body;

            // Validaciones obligatorias
            this.validateAmount(amount);
            this.validateCurrency(currency);
            this.validatePaymentMethod(payment_method);

            // Validaciones condicionales para tarjetas
            if (payment_method.includes('card')) {
                this.validateCardNumber(card_number);
                this.validateCVV(cvv);
                this.validateExpiryDate(expiry_month, expiry_year);
            }

            // Sanitización de datos
            req.sanitizedPaymentData = {
                amount: parseFloat(amount.toFixed(2)),
                currency: currency.toUpperCase(),
                payment_method,
                description: description ? validator.escape(description) : null,
                // Nunca almacenar datos sensibles de tarjeta
                card_data: payment_method.includes('card') ? {
                    last_four: card_number.slice(-4),
                    expiry_month,
                    expiry_year
                } : null
            };

            logger.info('Validación de pago exitosa', {
                amount,
                currency,
                payment_method
            });

            next();
        } catch (error) {
            logger.error('Error en validación de pago', {
                error: error.message,
                body: req.body
            });

            res.status(400).json({
                status: 'error',
                message: error.message
            });
        }
    }

    // Validar datos de orden
    static validateOrderData = (req, res, next) => {
        try {
            const { order_id, items } = req.body;

            // Validar order_id
            if (!Number.isInteger(order_id) || order_id <= 0) {
                throw new Error('ID de orden inválido');
            }

            // Validar items
            if (!Array.isArray(items) || items.length === 0) {
                throw new Error('La orden debe contener al menos un ítem');
            }

            // Validar cada item
            items.forEach((item, index) => {
                if (!item.product_id || !item.quantity || !item.price) {
                    throw new Error(`Item ${index + 1} inválido`);
                }
                if (item.quantity <= 0 || item.price <= 0) {
                    throw new Error(`Cantidad o precio inválido en item ${index + 1}`);
                }
            });

            // Calcular total
            const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            req.orderTotal = parseFloat(total.toFixed(2));

            next();
        } catch (error) {
            logger.error('Error en validación de orden', {
                error: error.message,
                body: req.body
            });

            res.status(400).json({
                status: 'error',
                message: error.message
            });
        }
    }

    // Sanitizar datos de respuesta
    static sanitizePaymentResponse(paymentData) {
        return {
            transaction_id: paymentData.transaction_id,
            status: paymentData.status,
            amount: paymentData.amount,
            currency: paymentData.currency,
            payment_method: paymentData.payment_method,
            created_at: paymentData.created_at,
            // Nunca devolver datos sensibles
            card_info: paymentData.card_data ? {
                last_four: paymentData.card_data.last_four,
                brand: paymentData.card_data.brand
            } : null
        };
    }
}

module.exports = PaymentValidators;