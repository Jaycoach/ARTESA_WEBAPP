import React, { useRef, useState } from 'react';
import { FaUpload, FaSpinner, FaDownload, FaTrash, FaCheckCircle, FaFile } from 'react-icons/fa';

const FileUploadField = ({
  name,
  label,
  currentFile,
  selectedFile,
  onFileChange,
  onFileUpload,
  isUploading = false,
  disabled = false,
  accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx',
  maxSize = 3 * 1024 * 1024 // 3MB
}) => {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  // Validar archivo
  const validateFile = (file) => {
    if (!file) return null;

    // Validar tamaño
    if (file.size > maxSize) {
      return `El archivo no debe superar ${Math.round(maxSize / 1024 / 1024)}MB`;
    }

    // Validar tipo
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.type)) {
      return 'Formato de archivo no permitido. Use PDF, JPG, PNG o DOCX';
    }

    return null;
  };

  // Manejar selección de archivo
  const handleFileSelect = (file) => {
    setError('');
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    onFileChange(file);
  };

  // Manejar click en input
  const handleInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Manejar drag & drop
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Abrir selector de archivos
  const openFileSelector = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  // Limpiar archivo seleccionado
  const clearSelectedFile = () => {
    onFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('');
  };

  // Subir archivo
  const handleUpload = () => {
    if (selectedFile && onFileUpload) {
      onFileUpload(selectedFile);
    }
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      {/* Área de upload */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-4 transition-all duration-200
          ${dragOver && !disabled ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileSelector}
      >
        {/* Input file oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        {/* Contenido del área de upload */}
        <div className="text-center">
          {isUploading ? (
            <div className="flex flex-col items-center space-y-2">
              <FaSpinner className="animate-spin text-blue-500 text-2xl" />
              <span className="text-sm text-gray-600">Subiendo archivo...</span>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center space-y-2">
              <FaFile className="text-blue-500 text-2xl" />
              <div className="text-sm text-gray-700">
                <p className="font-medium truncate max-w-40">{selectedFile.name}</p>
                <p className="text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              {!disabled && (
                <div className="flex space-x-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload();
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                  >
                    <FaUpload className="inline mr-1" />
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelectedFile();
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    <FaTrash className="inline mr-1" />
                    Quitar
                  </button>
                </div>
              )}
            </div>
          ) : currentFile ? (
            <div className="flex flex-col items-center space-y-2">
              <FaCheckCircle className="text-green-500 text-2xl" />
              <div className="text-sm text-gray-700">
                <p className="font-medium">Archivo cargado</p>
                <a
                  href={currentFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FaDownload className="mr-1" />
                  Descargar
                </a>
              </div>
              {!disabled && (
                <p className="text-xs text-gray-500 mt-2">
                  Haz clic para reemplazar el archivo
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <FaUpload className="text-gray-400 text-2xl" />
              <div className="text-sm text-gray-600">
                <p className="font-medium">Arrastra un archivo aquí</p>
                <p className="text-gray-500">o haz clic para seleccionar</p>
              </div>
              <p className="text-xs text-gray-400">
                PDF, JPG, PNG, DOCX (máx. {Math.round(maxSize / 1024 / 1024)}MB)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <FaFile className="mr-1" />
          {error}
        </p>
      )}
    </div>
  );
};

export default FileUploadField;