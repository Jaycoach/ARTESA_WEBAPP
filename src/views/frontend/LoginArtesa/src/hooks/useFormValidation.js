import { useState } from 'react';
import { VALIDATION_MESSAGES } from './validationMessages';

export const useFormValidation = (initialState) => {
  const [values, setValues] = useState(initialState);
  const [errors, setErrors] = useState({});
  
  const validators = {
    required: (value, fieldName) =>
      value.trim() ? "" : VALIDATION_MESSAGES.required[fieldName],
    
    email: (value) =>
      /\S+@\S+\.\S+/.test(value) ? "" : VALIDATION_MESSAGES.format.email,
    
    // Extensible: más validadores pueden agregarse aquí
  };
  
  const validateField = (name, value, rules = ['required']) => {
    for (const rule of rules) {
      const validator = typeof rule === 'function' ? rule : validators[rule];
      if (validator) {
        const errorMessage = validator(value, name);
        if (errorMessage) return errorMessage;
      }
    }
    return "";
  };

  return { values, setValues, errors, setErrors, validateField };
};