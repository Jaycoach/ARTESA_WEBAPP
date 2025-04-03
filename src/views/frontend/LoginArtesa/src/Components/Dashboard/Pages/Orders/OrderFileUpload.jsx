import React, { useState } from 'react';
import { FaUpload, FaFile, FaFileImage, FaFilePdf, FaTimes } from 'react-icons/fa';

/**
 * Componente para subir archivos (PDF, imágenes) relacionados con el pedido
 * @param {Object} props - Props del componente
 * @param {function} props.onChange - Función para manejar cambios
 * @param {File} props.value - Archivo seleccionado
 * @param {string} props.buttonLabel - Texto del botón (opcional)
 */
const OrderFileUpload = ({ onChange, value, buttonLabel = "Adjuntar archivo" }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Tipos de archivo permitidos
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  const maxSizeMB = 5; // Máximo 5MB
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setErrorMessage('');
    
    if (!file) return;
    
    // Validar tipo de archivo
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(`Tipo de archivo no permitido. Por favor sube una imagen (JPG, PNG, GIF) o PDF.`);
      return;
    }
    
    // Validar tamaño (5MB)
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrorMessage(`El archivo excede el tamaño máximo de ${maxSizeMB}MB.`);
      return;
    }
    
    // Si es una imagen, crear una vista previa
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      // Si es PDF, quitar la vista previa
      setPreviewUrl(null);
    }
    
    // Notificar el cambio
    onChange(file);
  };
  
  const clearFile = () => {
    onChange(null);
    setPreviewUrl(null);
    setErrorMessage('');
  };
  
  const getFileIcon = () => {
    if (!value) return <FaUpload className="mr-2" />;
    
    if (value.type.startsWith('image/')) {
      return <FaFileImage className="mr-2 text-blue-500" />;
    } else if (value.type === 'application/pdf') {
      return <FaFilePdf className="mr-2 text-red-500" />;
    } else {
      return <FaFile className="mr-2 text-gray-500" />;
    }
  };

  return (
    <div className="order-file-upload">
      <div className="mb-2">
        {!value ? (
          <div className="file-input-container">
            <label htmlFor="orderAttachment" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer">
              {getFileIcon()}
              {buttonLabel}
            </label>
            <input
              type="file"
              id="orderAttachment"
              accept="image/jpeg,image/png,image/gif,application/pdf"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>
        ) : (
          <div className="file-selected flex items-center p-2 border border-gray-200 rounded-md bg-gray-50">
            {getFileIcon()}
            <span className="flex-grow truncate">{value.name}</span>
            <button
              type="button"
              onClick={clearFile}
              className="ml-2 p-1 rounded-full hover:bg-gray-200 focus:outline-none"
              title="Eliminar archivo"
            >
              <FaTimes />
            </button>
          </div>
        )}
      </div>
      
      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
      
      {previewUrl && (
        <div className="mt-2 rounded-md overflow-hidden border border-gray-200">
          <img src={previewUrl} alt="Vista previa" className="max-h-48 max-w-full object-contain" />
        </div>
      )}
      
      <p className="mt-1 text-xs text-gray-500">
        Puedes adjuntar una imagen (JPG, PNG, GIF) o PDF, máximo {maxSizeMB}MB.
      </p>
    </div>
  );
};

export default OrderFileUpload;