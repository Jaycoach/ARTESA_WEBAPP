// src/validators/authValidators.js
const validator = require('validator');
const passwordValidator = require('password-validator');

// Esquema de validación para la contraseña
const passwordSchema = {
  minLength: 8,
  maxLength: 100,
  requireSpecialChar: false,
  requireNumber: false,
  requireUppercase: false,
  requireLowercase: false
};

const createPasswordSchema = () => {
  const schema = new passwordValidator();
  return schema
    .is().min(passwordSchema.minLength)
    .is().max(passwordSchema.maxLength)
    .has().uppercase()
    .has().lowercase()
    .has().digits(passwordSchema.minDigits)
    .has().not().spaces()
    .is().not().oneOf(['Password123', 'Password1', '12345678']);
};

const PASSWORD_ERROR_MESSAGES = {
  min: `La contraseña debe tener al menos ${passwordSchema.minLength} caracteres`,
  max: `La contraseña no puede tener más de ${passwordSchema.maxLength} caracteres`,
  uppercase: 'La contraseña debe tener al menos una mayúscula',
  lowercase: 'La contraseña debe tener al menos una minúscula',
  digits: 'La contraseña debe tener al menos un número',
  spaces: 'La contraseña no puede contener espacios',
  oneOf: 'La contraseña es demasiado común'
};

class AuthValidators {
  static #passwordSchema = createPasswordSchema();

  static validateEmail(req, res, next) {
    const { mail } = req.body;

    if (!mail) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico es requerido'
      });
    }

    if (!validator.isEmail(mail)) {
      return res.status(400).json({
        success: false,
        message: 'El formato del correo electrónico no es válido'
      });
    }

    req.body.mail = validator.normalizeEmail(mail.toLowerCase());
    next();
  }

  // Función para validar la contraseña
  static validatePassword = (req, res, next) => {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña es requerida'
      });
    }

    if (password.length < passwordSchema.minLength || password.length > passwordSchema.maxLength) {
      return res.status(400).json({
        success: false,
        message: `La contraseña debe tener entre ${passwordSchema.minLength} y ${passwordSchema.maxLength} caracteres`
      });
    }

    next();
  };

  static validateName(req, res, next) {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'El nombre es requerido'
      });
    }

    if (!validator.isLength(name, { min: 2, max: 50 })) {
      return res.status(400).json({
        status: 'error',
        message: 'El nombre debe tener entre 2 y 50 caracteres'
      });
    }

    req.body.name = validator.escape(name.trim());
    next();
  }

  // Función para validar los datos de login
  static validateLoginData = (req, res, next) => {
    const { mail, password } = req.body;

    // Validar que se proporcionaron ambos campos
    if (!mail || !password) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico y la contraseña son requeridos'
      });
    }

    // Si todo está bien, continuar
    next();
  };

  static validateLoginAttempts(req, res, next) {
    const loginAttempts = req.loginAttempts || { count: 0, timestamp: Date.now() };
    const maxAttempts = 5;
    const windowMs = 15 * 60 * 1000; // 15 minutos

    if (loginAttempts.count >= maxAttempts) {
      const timeLeft = Math.ceil((windowMs - (Date.now() - loginAttempts.timestamp)) / 1000);
      if (timeLeft > 0) {
        return res.status(429).json({
          status: 'error',
          message: `Demasiados intentos fallidos. Por favor, espere ${timeLeft} segundos.`
        });
      }
      // Reset attempts if window has passed
      req.loginAttempts = { count: 0, timestamp: Date.now() };
    }

    next();
  }

  static validatePasswordResetToken(req, res, next) {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'El token es requerido'
      });
    }

    if (!validator.isHexadecimal(token) || token.length !== 64) {
      return res.status(400).json({
        status: 'error',
        message: 'Token inválido'
      });
    }

    next();
  }
}

module.exports = AuthValidators;