import React, { createContext, useContext, useState } from 'react';

const ErrorContext = createContext();

export const useError = () => useContext(ErrorContext);

export const ErrorProvider = ({ children }) => {
  const [errors, setErrors] = useState({});
  
  const setFieldError = (fieldName, message) => {
    setErrors(prev => ({ ...prev, [fieldName]: message }));
  };
  
  const clearFieldError = (fieldName) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };
  
  const clearAllErrors = () => setErrors({});

  return (
    <ErrorContext.Provider value={{ errors, setFieldError, clearFieldError, clearAllErrors }}>
      {children}
    </ErrorContext.Provider>
  );
};