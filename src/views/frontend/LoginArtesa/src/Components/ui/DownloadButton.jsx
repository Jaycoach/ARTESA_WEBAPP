import React from 'react';
import { FaSpinner, FaDownload, FaExclamationTriangle } from 'react-icons/fa';

const DownloadButton = ({ 
  client, 
  documentType, 
  documentName, 
  icon: Icon, 
  color, 
  label,
  downloadDocument,
  isDownloading,
  progress = 0
}) => {
  // Verificar disponibilidad usando el nuevo endpoint structure
  const documentAvailable = client.documentAvailability?.[documentType] || false;

  return (
    <div className="space-y-2">
      <button
        onClick={() => downloadDocument(client, documentType, documentName)}
        disabled={!documentAvailable || isDownloading}
        className={`px-4 py-2 rounded-lg flex items-center justify-center w-full transition-all duration-200 ${
          !documentAvailable || isDownloading
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : `bg-${color}-600 text-white hover:bg-${color}-700 hover:shadow-md`
        }`}
        title={!documentAvailable ? `${label} no disponible` : `Descargar ${label}`}
      >
        {isDownloading ? (
          <div className="flex items-center space-x-2">
            <FaSpinner className="animate-spin" />
            <span>Descargando...</span>
            {progress > 0 && <span className="text-xs">({progress}%)</span>}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Icon />
            <span>{documentAvailable ? 'Descargar' : 'No disponible'}</span>
          </div>
        )}
      </button>
      
      {/* Barra de progreso */}
      {isDownloading && progress > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`bg-${color}-600 h-2 rounded-full transition-all duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      {/* Indicador de estado */}
      {!documentAvailable && (
        <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded flex items-center">
          <FaExclamationTriangle className="mr-1" />
          Documento no disponible
        </div>
      )}
    </div>
  );
};

export default DownloadButton;