import React from 'react';

const FormErrorMessage = ({ message, className = "" }) => {
  if (!message) return null;
  return (
    <p className={`text-red-500 text-xs mt-1 flex items-center ${className}`}>
      <span className="mr-1">⚠️</span>
      {message}
    </p>
  );
};

export default FormErrorMessage;