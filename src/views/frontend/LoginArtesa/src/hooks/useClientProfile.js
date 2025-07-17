import { useState, useEffect } from 'react';
import API from '../api/config';
import { useAuth } from './useAuth'; // Tu hook existente
import useClientProfileStore from '../stores/clientProfileStore';

const useClientProfile = () => {
  const { user, isAuthenticated, updateUserInfo } = useAuth(); // Usar tu hook existente
  
  const {
    profile,
    isLoading,
    isSubmitting,
    isEditable,
    hasProfile,
    error,
    setProfile,
    setLoading,
    setSubmitting,
    setEditable,
    setError,
    showConfirmationModal,
    setFileUploading
  } = useClientProfileStore();

  // Verificar si el usuario puede editar
  const canEdit = () => {
    if (!user) return false;
    const userRole = user.role?.id || user.role || user.rol;
    return userRole === 1 || userRole === '1' || userRole === 'ADMIN';
  };

  // Cargar perfil existente
  const loadProfile = async () => {
    if (!user?.id || !isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await API.get(`/client-profiles/user/${user.id}`);
      
      if (response.data.success && response.data.data) {
        const profileData = response.data.data;
        setProfile(profileData);
        
        // Determinar si es editable
        const isAdmin = canEdit();
        const hasExistingProfile = !!profileData.client_id;
        
        // Si no es admin y ya tiene perfil, bloquear edición
        setEditable(isAdmin || !hasExistingProfile);
        
        return profileData;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // No tiene perfil, es usuario nuevo
        setProfile(null);
        setEditable(true);
      } else {
        console.error('Error loading profile:', error);
        setError('Error al cargar el perfil');
      }
    } finally {
      setLoading(false);
    }
  };

  // Crear nuevo perfil
  const createProfile = async (formData) => {
    setSubmitting(true);
    setError(null);
    
    try {
      // Preparar FormData
      const submitData = new FormData();
      
      // Añadir userId
      submitData.append('userId', user.id);
      
      // Campos de texto
      Object.keys(formData).forEach(key => {
        if (key !== 'files' && formData[key] !== undefined && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });
      
      // Archivos
      if (formData.files) {
        Object.keys(formData.files).forEach(fileKey => {
          if (formData.files[fileKey]) {
            submitData.append(fileKey, formData.files[fileKey]);
          }
        });
      }
      
      const response = await API.post('/client-profiles', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        const newProfile = response.data.data;
        setProfile(newProfile);
        
        // Actualizar contexto de usuario
        updateUserInfo({
          nombre: newProfile.contact_name || newProfile.nombre,
          email: newProfile.contact_email || newProfile.email
        });
        
        // Determinar editabilidad después de crear
        const isAdmin = canEdit();
        setEditable(isAdmin);
        
        showConfirmationModal(
          'Se ha guardado su perfil correctamente, espere a que se realice toda su sincronización',
          'success'
        );
        
        return newProfile;
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      const errorMessage = error.response?.data?.message || 'Error al crear el perfil';
      setError(errorMessage);
      showConfirmationModal(errorMessage, 'error');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  // Actualizar perfil existente
  const updateProfile = async (formData) => {
    if (!profile?.user_id) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const submitData = new FormData();
      
      // Campos de texto
      Object.keys(formData).forEach(key => {
        if (key !== 'files' && formData[key] !== undefined && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });
      
      // Archivos
      if (formData.files) {
        Object.keys(formData.files).forEach(fileKey => {
          if (formData.files[fileKey]) {
            submitData.append(fileKey, formData.files[fileKey]);
          }
        });
      }
      
      const response = await API.put(`/client-profiles/user/${profile.user_id}`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        const updatedProfile = response.data.data;
        setProfile(updatedProfile);
        
        showConfirmationModal(
          'Perfil actualizado correctamente',
          'success'
        );
        
        return updatedProfile;
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar el perfil';
      setError(errorMessage);
      showConfirmationModal(errorMessage, 'error');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  // Subir archivo individual
  const uploadFile = async (file, fileType) => {
    if (!profile?.user_id) return;
    
    setFileUploading(fileType, true);
    
    try {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await API.post(
        `/client-profiles/${profile.user_id}/documents/${fileType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      if (response.data.success) {
        // Recargar perfil para obtener URL actualizada
        await loadProfile();
        showConfirmationModal(`Documento ${fileType} subido correctamente`, 'success');
      }
    } catch (error) {
      console.error(`Error uploading ${fileType}:`, error);
      const errorMessage = error.response?.data?.message || `Error al subir ${fileType}`;
      showConfirmationModal(errorMessage, 'error');
    } finally {
      setFileUploading(fileType, false);
    }
  };

  // Cargar perfil al montar el hook
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadProfile();
    }
  }, [isAuthenticated, user?.id]);

  return {
    // Estado
    profile,
    isLoading,
    isSubmitting,
    isEditable,
    hasProfile,
    error,
    canEdit: canEdit(),
    
    // Acciones
    loadProfile,
    createProfile,
    updateProfile,
    uploadFile
  };
};

export default useClientProfile;