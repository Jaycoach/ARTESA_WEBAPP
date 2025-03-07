import React from 'react';
import { FaCheck, FaExclamationTriangle } from 'react-icons/fa';

// Componente de Modal de Confirmación
const ConfirmationModal = ({ isSuccess, message, onClose }) => {
  return (
    <div className="confirmation-modal-overlay">
      <div className="confirmation-modal">
        <div className={`confirmation-modal-header ${isSuccess ? 'success' : 'error'}`}>
          {isSuccess ? (
            <FaCheck className="confirmation-icon success" />
          ) : (
            <FaExclamationTriangle className="confirmation-icon error" />
          )}
          <h3>{isSuccess ? 'Operación Exitosa' : 'Error'}</h3>
        </div>
        
        <div className="confirmation-modal-body">
          <p>{message}</p>
        </div>
        
        <div className="confirmation-modal-footer">
          <button 
            onClick={onClose} 
            className={`confirmation-btn ${isSuccess ? 'success-btn' : 'error-btn'}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;