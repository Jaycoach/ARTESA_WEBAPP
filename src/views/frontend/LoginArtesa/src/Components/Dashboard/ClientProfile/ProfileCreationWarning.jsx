import React from 'react';
import { FaExclamationTriangle, FaCheck, FaTimes } from 'react-icons/fa';
import './ProfileCreationWarning.css';

const ProfileCreationWarning = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="profile-warning-overlay">
      <div className="profile-warning-modal">
        <div className="profile-warning-header">
          <div className="warning-icon">
            <FaExclamationTriangle />
          </div>
          <h3>Confirmación de Creación de Perfil</h3>
        </div>
        
        <div className="profile-warning-body">
          <p>
            <strong>IMPORTANTE:</strong> Una vez que creates tu perfil de cliente, 
            la información no podrá ser modificada posteriormente.
          </p>
          <p>
            Por favor, asegúrate de que todos los datos estén correctos antes de continuar.
          </p>
          <ul>
            <li>Información de contacto y empresa</li>
            <li>Datos fiscales (NIT, razón social)</li>
            <li>Documentos adjuntos</li>
            <li>Información bancaria</li>
          </ul>
          <p>
            ¿Estás seguro de que deseas crear el perfil con la información proporcionada?
          </p>
        </div>
        
        <div className="profile-warning-footer">
          <button 
            className="warning-btn cancel-btn"
            onClick={onCancel}
          >
            <FaTimes className="mr-2" />
            Revisar Información
          </button>
          <button 
            className="warning-btn confirm-btn"
            onClick={onConfirm}
          >
            <FaCheck className="mr-2" />
            Confirmar y Crear Perfil
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCreationWarning;