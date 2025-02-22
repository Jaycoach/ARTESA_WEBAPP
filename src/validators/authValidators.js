const validator = require('validator');
const passwordValidator = require('password-validator');

const passwordSchema = new passwordValidator();
passwordSchema
  .is().min(8)
  .is().max(100)
  .has().uppercase()
  .has().lowercase() 
  .has().digits(1)
  .has().not().spaces()
  .is().not().oneOf(['Password123', 'Password1', '12345678']);

class AuthValidators {
  static validateEmail(email) {
    if (!email) {
      return { isValid: false, error: 'El correo electrónico es requerido' };
    }

    if (!validator.isEmail(email)) {
      return { isValid: false, error: 'El correo electrónico no es válido' };
    }

    const sanitizedEmail = validator.normalizeEmail(email.toLowerCase());
    return { isValid: true, sanitizedValue: sanitizedEmail };
  }

  static validatePassword(password) {
    if (!password) {
      return { isValid: false, error: 'La contraseña es requerida' };
    }

    const validationResult = passwordSchema.validate(password, { list: true });
    if (validationResult.length > 0) {
      const errorMessages = {
        min: 'La contraseña debe tener al menos 8 caracteres',
        max: 'La contraseña no puede tener más de 100 caracteres',
        uppercase: 'La contraseña debe tener al menos una mayúscula',
        lowercase: 'La contraseña debe tener al menos una minúscula',
        digits: 'La contraseña debe tener al menos un número',
        spaces: 'La contraseña no puede contener espacios',
        oneOf: 'La contraseña es demasiado común'
      };

      return { 
        isValid: false, 
        error: validationResult.map(err => errorMessages[err]).join(', ')
      };
    }

    return { isValid: true };
  }

  static validateName(name) {
    if (!name) {
      return { isValid: false, error: 'El nombre es requerido' };
    }

    if (!validator.isLength(name, { min: 2, max: 50 })) {
      return { 
        isValid: false, 
        error: 'El nombre debe tener entre 2 y 50 caracteres' 
      };
    }

    const sanitizedName = validator.escape(name.trim());
    return { isValid: true, sanitizedValue: sanitizedName };
  }

  static validatePasswordResetToken(token) {
    if (!token) {
      return { isValid: false, error: 'El token es requerido' };
    }

    if (!validator.isHexadecimal(token) || token.length !== 64) {
      return { isValid: false, error: 'Token inválido' };
    }

    return { isValid: true, sanitizedValue: token };
  }

  static validateLoginAttempts(attempts, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    if (attempts >= maxAttempts) {
      const timeLeft = Math.ceil((windowMs - (Date.now() - attempts.timestamp)) / 1000);
      return {
        isValid: false,
        error: `Demasiados intentos fallidos. Por favor, espera ${timeLeft} segundos.`
      };
    }
    return { isValid: true };
  }
}

module.exports = AuthValidators;