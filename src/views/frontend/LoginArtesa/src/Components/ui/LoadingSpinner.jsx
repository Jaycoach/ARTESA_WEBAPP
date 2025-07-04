import React from 'react';
import { FaSpinner } from 'react-icons/fa';

const LoadingSpinner = ({ size = 'medium', message = 'Cargando...', className = '' }) => {
  const sizeClasses = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl'
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      <FaSpinner className={`animate-spin text-blue-500 ${sizeClasses[size]}`} />
      {message && (
        <span className="text-gray-600 text-sm font-medium">{message}</span>
      )}
    </div>
  );
};

export default LoadingSpinner;