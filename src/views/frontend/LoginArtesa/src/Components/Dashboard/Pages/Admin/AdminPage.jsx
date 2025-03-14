import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { adminService } from '../../../../services/adminService';
import imageService from '../../../../services/imageService';
import { FaUpload, FaClock, FaImage, FaSave, FaExclamationTriangle, FaCheck, FaTimes } from 'react-icons/fa';
import SettingsCard from './SettingsCard';
import './AdminPage.scss';

const AdminPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({
    orderTimeLimit: '18:00',
    homeBannerImage: null
  });
  const [currentSettings, setCurrentSettings] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [imageError, setImageError] = useState('');

  // Verificar si el usuario tiene permisos (rol 1 o 3)
  const hasAdminPermission = adminService.hasAdminPermission(user);

  useEffect(() => {
    if (hasAdminPermission) {
      fetchSettings();
    }
    
    // Limpieza al desmontar el componente
    return () => {
      // Revocar las URLs de vista previa para evitar fugas de memoria
      if (previewImage && previewImage.startsWith('blob:')) {
        imageService.revokePreviewURL(previewImage);
      }
    };
  }, [hasAdminPermission]);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminService.getSettings();
      if (result && result.success) {
        const data = result.data || {};
        setCurrentSettings(data);
        setSettings({
          orderTimeLimit: data.orderTimeLimit || '18:00',
          homeBannerImage: null
        });
        
        // Si hay una URL de imagen, mostrarla en la vista previa
        if (data.homeBannerImageUrl) {
          setPreviewImage(data.homeBannerImageUrl);
        }
      }
    } catch (error) {
      console.error('Error al cargar la configuración:', error);
      setError('No se pudo cargar la configuración. Intente de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (e) => {
    setSettings({
      ...settings,
      orderTimeLimit: e.target.value
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    setImageError('');
    
    if (!file) return;
    
    // Validar que sea una imagen
    if (!imageService.isValidImage(file)) {
      setImageError('El archivo seleccionado no es una imagen válida. Use formatos como JPEG, PNG o GIF.');
      return;
    }
    
    // Validar tamaño (máximo 2MB)
    if (imageService.exceedsMaxSize(file, 2)) {
      setImageError('La imagen excede el tamaño máximo de 2MB.');
      return;
    }
    
    try {
      // Redimensionar imagen si es necesario (max 1200x400)
      const resizedImageBlob = await imageService.resizeImage(file, {
        maxWidth: 1200,
        maxHeight: 400,
        quality: 0.8
      });
      
      // Convertir el blob redimensionado a un archivo
      const resizedFile = imageService.blobToFile(
        resizedImageBlob,
        file.name,
        file.type
      );
      
      // Actualizar el estado
      setSettings({
        ...settings,
        homeBannerImage: resizedFile
      });
      
      // Crear URL para vista previa
      if (previewImage && previewImage.startsWith('blob:')) {
        imageService.revokePreviewURL(previewImage); // Limpiar URL anterior
      }
      
      const previewURL = imageService.createPreviewURL(resizedImageBlob);
      setPreviewImage(previewURL);
      
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
      setImageError('Error al procesar la imagen. Intente con otra imagen.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const formData = new FormData();
      formData.append('orderTimeLimit', settings.orderTimeLimit);
      
      if (settings.homeBannerImage) {
        formData.append('homeBannerImage', settings.homeBannerImage);
      }
      
      const result = await adminService.updateSettings(formData);
      
      if (result && result.success) {
        setSuccess('Configuración guardada exitosamente');
        // Actualizar los datos actuales
        fetchSettings();
      } else {
        throw new Error(result?.message || 'Error al guardar la configuración');
      }
    } catch (error) {
      console.error('Error al guardar la configuración:', error);
      setError(error.message || 'Error al guardar la configuración. Intente de nuevo más tarde.');
    } finally {
      setSaveLoading(false);
    }
  };
  
  const handleClearImage = () => {
    // Limpiar la imagen seleccionada
    if (previewImage && previewImage.startsWith('blob:')) {
      imageService.revokePreviewURL(previewImage);
    }
    
    setSettings({
      ...settings,
      homeBannerImage: null
    });
    
    // Mantener la URL de la imagen guardada anteriormente
    if (currentSettings?.homeBannerImageUrl) {
      setPreviewImage(currentSettings.homeBannerImageUrl);
    } else {
      setPreviewImage(null);
    }
  };

  if (!hasAdminPermission) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="notification error">
          <p className="font-bold">Acceso denegado</p>
          <p>No tiene permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page w-full max-w-4xl mx-auto p-6">
      <h1 className="section-title text-2xl font-bold text-gray-800 mb-6">Administración del Portal</h1>
      
      {loading ? (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Notificaciones */}
          {error && (
            <div className="notification error flex items-center">
              <FaExclamationTriangle className="mr-2" /> {error}
            </div>
          )}
          
          {success && (
            <div className="notification success flex items-center">
              <FaCheck className="mr-2" /> {success}
            </div>
          )}
          
          {/* Contenedor de tarjetas */}
          <div className="form-container">
            {/* Sección: Hora límite de pedidos */}
            <SettingsCard 
              icon={<FaClock />}
              title="Hora límite de pedidos"
              description="Establezca la hora límite para que los clientes realicen pedidos en el día."
            >
              <div className="flex items-center">
                <input
                  type="time"
                  id="orderTimeLimit"
                  name="orderTimeLimit"
                  value={settings.orderTimeLimit}
                  onChange={handleTimeChange}
                  className="mt-1 p-2 border border-gray-300 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <span className="ml-3 text-gray-500">horas</span>
              </div>
              
              <p className="mt-2 text-sm text-gray-500">
                Los pedidos realizados después de esta hora se procesarán al siguiente día hábil.
              </p>
            </SettingsCard>
            
            {/* Sección: Cambio de imagen para Landing Page */}
            <SettingsCard 
              icon={<FaImage />}
              title="Cambio Landing Page"
              description="Suba una imagen para mostrar en la página de inicio."
            >
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen para banner principal
                </label>
                
                <div className="file-upload flex items-center">
                  <label className="upload-btn cursor-pointer py-2 px-3 rounded-md text-sm flex items-center">
                    <FaUpload className="icon" />
                    <span>Seleccionar imagen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <span className="ml-3 text-sm text-gray-500">
                    {settings.homeBannerImage ? settings.homeBannerImage.name : 'Ningún archivo seleccionado'}
                  </span>
                  
                  {settings.homeBannerImage && (
                    <button 
                      type="button" 
                      onClick={handleClearImage}
                      className="ml-3 text-gray-500 hover:text-gray-700"
                      title="Limpiar selección"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
                
                {imageError && (
                  <p className="mt-2 text-sm text-red-600">
                    {imageError}
                  </p>
                )}
                
                {previewImage && (
                  <div className="image-preview mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Vista previa:</p>
                    <div className="rounded-lg overflow-hidden">
                      <img 
                        src={previewImage} 
                        alt="Vista previa del banner" 
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                )}
                
                <p className="mt-2 text-sm text-gray-500">
                  Tamaño recomendado: 1200x400 píxeles, máximo 2MB.
                </p>
              </div>
            </SettingsCard>
          </div>
          
          {/* Botones de acción */}
          <div className="action-buttons">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="cancel-btn"
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              disabled={saveLoading}
              className="save-btn"
            >
              {saveLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <FaSave className="icon" />
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminPage;