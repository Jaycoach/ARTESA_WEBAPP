// Guardar este archivo como src/views/frontend/LoginArtesa/src/Components/ui/Notification.jsx

import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimesCircle } from 'react-icons/fa';

/**
 * Componente para mostrar notificaciones con mejor estilo y visibilidad
 */
const Notification = ({ 
  message, 
  type = 'success', 
  onClose, 
  duration = 5000,
  position = 'top-right'
}) => {
  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  // Determine icon and styles based on notification type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          background: 'bg-green-100',
          border: 'border-green-500',
          text: 'text-green-800',
          icon: <FaCheckCircle className="text-green-500" size={20} />
        };
      case 'error':
        return {
          background: 'bg-red-100',
          border: 'border-red-500',
          text: 'text-red-800',
          icon: <FaTimesCircle className="text-red-500" size={20} />
        };
      case 'warning':
        return {
          background: 'bg-yellow-100',
          border: 'border-yellow-500',
          text: 'text-yellow-800',
          icon: <FaExclamationTriangle className="text-yellow-500" size={20} />
        };
      case 'info':
      default:
        return {
          background: 'bg-blue-100',
          border: 'border-blue-500',
          text: 'text-blue-800',
          icon: <FaInfoCircle className="text-blue-500" size={20} />
        };
    }
  };

  // Get position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      case 'top-right':
      default:
        return 'top-4 right-4';
    }
  };

  const { background, border, text, icon } = getTypeStyles();
  const positionClasses = getPositionClasses();

  return (
    <div 
      className={`fixed z-50 ${positionClasses} max-w-md w-full shadow-lg rounded-lg overflow-hidden transition-all duration-300 transform translate-y-0 opacity-100`}
      role="alert"
    >
      <div className={`${background} ${text} p-4 flex items-start border-l-4 ${border}`}>
        <div className="flex-shrink-0 mr-3 mt-0.5">
          {icon}
        </div>
        <div className="flex-grow">
          <p className="font-medium leading-relaxed">{message}</p>
        </div>
        {onClose && (
          <button 
            type="button" 
            className="ml-4 text-gray-400 hover:text-gray-900 focus:outline-none"
            onClick={onClose}
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default Notification;