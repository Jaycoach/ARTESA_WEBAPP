import React from 'react';
import PropTypes from 'prop-types';

/**
 * Componente para mostrar una tarjeta de configuración
 * 
 * @param {Object} props - Propiedades del componente
 * @param {ReactNode} props.icon - Icono para mostrar en la tarjeta
 * @param {string} props.title - Título de la tarjeta
 * @param {string} props.description - Descripción de la tarjeta
 * @param {ReactNode} props.children - Contenido de la tarjeta
 * @param {string} props.className - Clases adicionales
 */
const SettingsCard = ({ icon, title, description, children, className = '' }) => {
  return (
    <div className={`settings-card ${className}`}>
      <div className="card-header">
        {icon && <span className="icon">{icon}</span>}
        <h2 className="title">{title}</h2>
      </div>
      
      {description && (
        <p className="card-description text-gray-600 mb-4">
          {description}
        </p>
      )}
      
      <div className="card-body">
        {children}
      </div>
    </div>
  );
};

SettingsCard.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default SettingsCard;