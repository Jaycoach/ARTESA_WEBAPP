import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { adminService } from '../../../../services/adminService';
import { sapSyncService } from '../../../../services/sapSyncService';
import imageService from '../../../../services/imageService';
import { FaUpload, FaClock, FaImage, FaSave, FaExclamationTriangle, FaCheck, FaTimes, FaUsers, FaBoxes, FaBuilding, FaSync } from 'react-icons/fa';
import './AdminPage.scss';

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

  // Estados para sincronización SAP
  const [syncLoading, setSyncLoading] = useState({
    clients: false,
    products: false,
    branches: false
  });
  const [syncStatus, setSyncStatus] = useState({
    clients: null,
    products: null,
    branches: null
  });

  // Verificar si el usuario tiene permisos (rol 1 o 3)
  console.log("Usuario en AdminPage:", user);
  const userRole = user ? parseInt(user.role) : null;
  console.log("Rol del usuario:", userRole);
  const hasAdminPermission = userRole === 1 || userRole === 3;
  console.log("¿Tiene permisos de administración?", hasAdminPermission);

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

  // Funciones de sincronización SAP
  const handleSyncClients = async () => {
    setSyncLoading(prev => ({ ...prev, clients: true }));
    setSyncStatus(prev => ({ ...prev, clients: null }));
    
    try {
      const result = await sapSyncService.triggerSyncAll();
      
      if (result.success) {
        setSyncStatus(prev => ({ 
          ...prev, 
          clients: { 
            type: 'success', 
            message: result.data?.message || 'Sincronización de clientes completada exitosamente' 
          } 
        }));
      } else {
        setSyncStatus(prev => ({ 
          ...prev, 
          clients: { 
            type: 'error', 
            message: result.error || 'Error al sincronizar clientes' 
          } 
        }));
      }
    } catch (error) {
      setSyncStatus(prev => ({ 
        ...prev, 
        clients: { 
          type: 'error', 
          message: 'Error inesperado al sincronizar clientes' 
        } 
      }));
    } finally {
      setSyncLoading(prev => ({ ...prev, clients: false }));
    }
  };

  const handleSyncProducts = async () => {
    setSyncLoading(prev => ({ ...prev, products: true }));
    setSyncStatus(prev => ({ ...prev, products: null }));
    
    try {
      const result = await sapSyncService.syncProducts();
      
      if (result.success) {
        setSyncStatus(prev => ({ 
          ...prev, 
          products: { 
            type: 'success', 
            message: result.data?.message || 'Sincronización de productos completada exitosamente' 
          } 
        }));
      } else {
        setSyncStatus(prev => ({ 
          ...prev, 
          products: { 
            type: 'error', 
            message: result.error || 'Error al sincronizar productos' 
          } 
        }));
      }
    } catch (error) {
      setSyncStatus(prev => ({ 
        ...prev, 
        products: { 
          type: 'error', 
          message: 'Error inesperado al sincronizar productos' 
        } 
      }));
    } finally {
      setSyncLoading(prev => ({ ...prev, products: false }));
    }
  };

  const handleSyncBranches = async () => {
    setSyncLoading(prev => ({ ...prev, branches: true }));
    setSyncStatus(prev => ({ ...prev, branches: null }));
    
    try {
      const result = await sapSyncService.syncBranches();
      
      if (result.success) {
        setSyncStatus(prev => ({ 
          ...prev, 
          branches: { 
            type: 'success', 
            message: result.data?.message || 'Sincronización de sucursales completada exitosamente' 
          } 
        }));
      } else {
        setSyncStatus(prev => ({ 
          ...prev, 
          branches: { 
            type: 'error', 
            message: result.error || 'Error al sincronizar sucursales' 
          } 
        }));
      }
    } catch (error) {
      setSyncStatus(prev => ({ 
        ...prev, 
        branches: { 
          type: 'error', 
          message: 'Error inesperado al sincronizar sucursales' 
        } 
      }));
    } finally {
      setSyncLoading(prev => ({ ...prev, branches: false }));
    }
  };

  if (!hasAdminPermission) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="notification error">
          <p className="font-bold">Acceso denegado</p>
          <p>No tiene permisos para acceder a esta página. Rol requerido: 1 o 3. Su rol: {userRole || 'No definido'}</p>
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
        <>
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
          
          {/* Sección de Sincronización SAP - Solo para Admins (Rol 1) */}
          {userRole === 1 && (
            <>
              <h2 className="section-title text-2xl font-bold text-gray-800 mt-8 mb-6">
                Sincronización Manual SAP
              </h2>
              
              <div className="form-container">
                {/* Card Sincronización de Clientes */}
                <SettingsCard 
                  icon={<FaUsers />}
                  title="Sincronización de Clientes"
                  description="Ejecuta la sincronización completa de clientes desde SAP (mismo proceso del cron diario a las 3 AM)"
                >
                  <button
                    type="button"
                    onClick={handleSyncClients}
                    disabled={syncLoading.clients}
                    className={`mt-4 w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                      ${syncLoading.clients 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      }`}
                  >
                    {syncLoading.clients ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <FaSync className="mr-2" />
                        Sincronizar Clientes
                      </>
                    )}
                  </button>
                  
                  {syncStatus.clients && (
                    <div className={`mt-3 p-3 rounded-md ${
                      syncStatus.clients.type === 'success' 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <div className="flex items-center">
                        {syncStatus.clients.type === 'success' ? (
                          <FaCheck className="mr-2" />
                        ) : (
                          <FaExclamationTriangle className="mr-2" />
                        )}
                        <span className="text-sm">{syncStatus.clients.message}</span>
                      </div>
                    </div>
                  )}
                </SettingsCard>

                {/* Card Sincronización de Productos */}
                <SettingsCard 
                  icon={<FaBoxes />}
                  title="Sincronización de Productos"
                  description="Ejecuta la sincronización completa de productos desde SAP B1"
                >
                  <button
                    type="button"
                    onClick={handleSyncProducts}
                    disabled={syncLoading.products}
                    className={`mt-4 w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                      ${syncLoading.products 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                      }`}
                  >
                    {syncLoading.products ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <FaSync className="mr-2" />
                        Sincronizar Productos
                      </>
                    )}
                  </button>
                  
                  {syncStatus.products && (
                    <div className={`mt-3 p-3 rounded-md ${
                      syncStatus.products.type === 'success' 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <div className="flex items-center">
                        {syncStatus.products.type === 'success' ? (
                          <FaCheck className="mr-2" />
                        ) : (
                          <FaExclamationTriangle className="mr-2" />
                        )}
                        <span className="text-sm">{syncStatus.products.message}</span>
                      </div>
                    </div>
                  )}
                </SettingsCard>

                {/* Card Sincronización de Sucursales */}
                <SettingsCard 
                  icon={<FaBuilding />}
                  title="Sincronización de Sucursales"
                  description="Ejecuta la sincronización de sucursales de clientes institucionales desde SAP"
                >
                  <button
                    type="button"
                    onClick={handleSyncBranches}
                    disabled={syncLoading.branches}
                    className={`mt-4 w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                      ${syncLoading.branches 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
                      }`}
                  >
                    {syncLoading.branches ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <FaSync className="mr-2" />
                        Sincronizar Sucursales
                      </>
                    )}
                  </button>
                  
                  {syncStatus.branches && (
                    <div className={`mt-3 p-3 rounded-md ${
                      syncStatus.branches.type === 'success' 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <div className="flex items-center">
                        {syncStatus.branches.type === 'success' ? (
                          <FaCheck className="mr-2" />
                        ) : (
                          <FaExclamationTriangle className="mr-2" />
                        )}
                        <span className="text-sm">{syncStatus.branches.message}</span>
                      </div>
                    </div>
                  )}
                </SettingsCard>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPage;