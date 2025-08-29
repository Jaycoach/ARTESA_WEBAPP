import React, { useState, useRef } from 'react';
import { FiUpload, FiImage, FiX, FiCheck } from 'react-icons/fi';
import Button from '../../../../../Components/ui/Button';

const ImageUploadModal = ({ product, onUpload, onCancel }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido (PNG, JPG, GIF)');
      return;
    }

    // Validar tamaño (max 5MB)
    const maxSize = (import.meta.env.VITE_MAX_IMAGE_SIZE_MB || 5) * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`El archivo es demasiado grande. Tamaño máximo: ${maxSize / 1024 / 1024}MB`);
      return;
    }

    console.log('📷 Archivo seleccionado:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified)
    });

    setSelectedFile(file);

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.onerror = () => {
      setError('Error al leer el archivo');
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('No hay archivo seleccionado');
      return;
    }

    setUploading(true);
    setError(null);
    
    try {
      console.log(`🖼️ Iniciando upload para producto ${product?.product_id}`);
      
      const formData = new FormData();
      formData.append('image', selectedFile);
      
      const response = await API.post(`/products/${product.product_id}/images/main`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      
      if (response.data.success) {
        console.log('✅ Upload completado exitosamente');
        await onUpload(response.data.data);
        resetFileSelection();
      } else {
        throw new Error(response.data.message || 'Error desconocido');
      }
      
    } catch (error) {
      console.error('❌ Error en upload:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al subir la imagen';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileSelect(fakeEvent);
    }
  };

  const resetFileSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Información del producto */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900">{product?.name}</h3>
        <p className="text-sm text-gray-600">
          Código: {product?.sap_code || product?.product_id}
        </p>
        {product?.image_url && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-2">Imagen actual:</p>
            <img 
              src={product.image_url} 
              alt={product.name}
              className="h-16 w-16 rounded-md object-cover border border-gray-200"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Mostrar errores */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center">
            <FiX className="w-4 h-4 text-red-600 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Área de subida */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          preview ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-indigo-400'
        }`}
      >
        {preview ? (
          <div className="space-y-4">
            <img 
              src={preview} 
              alt="Preview"
              className="max-h-64 mx-auto rounded-lg shadow-md"
            />
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFileSelection}
                disabled={uploading}
              >
                <FiX className="mr-1 w-3 h-3" />
                Cambiar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FiImage size={48} className="mx-auto text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900">
                Selecciona una imagen
              </p>
              <p className="text-sm text-gray-600">
                Arrastra y suelta aquí, o haz clic para seleccionar
              </p>
              <p className="text-xs text-gray-500 mt-2">
                PNG, JPG, GIF hasta {import.meta.env.VITE_MAX_IMAGE_SIZE_MB || 5}MB
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <FiUpload className="mr-2" />
              Seleccionar Archivo
            </Button>
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Información del archivo seleccionado */}
      {selectedFile && (
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-blue-700">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type}
              </p>
            </div>
            <FiCheck className="text-blue-600" />
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={uploading}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Subiendo...
            </>
          ) : (
            <>
              <FiUpload className="mr-2" />
              Subir Imagen
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ImageUploadModal;