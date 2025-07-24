import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { sapSyncService } from '../services/sapSyncService';
import API from '../api/config';

export const useUserActivation = () => {
  const { user } = useAuth();
  const [userStatus, setUserStatus] = useState({
    isActive: false,
    hasClientProfile: false,
    isPendingSync: false,
    syncInProgress: false,
    canCreateOrders: false,
    statusMessage: '',
    loading: true,
    lastChecked: null
  });

  const [error, setError] = useState(null);

  // Función para verificar el estado completo del usuario
  const checkUserActivationStatus = useCallback(async () => {
    if (!user?.id) {
      setUserStatus(prev => ({
        ...prev,
        loading: false,
        statusMessage: 'Usuario no autenticado'
      }));
      return;
    }

    try {
      setUserStatus(prev => ({ ...prev, loading: true }));
      
      // 1. CORREGIDO: Verificar estado del usuario usando el endpoint correcto
      const userResponse = await API.get(`/users/${user.id}`);
      const userData = userResponse.data.data || userResponse.data;
      
      console.log('Datos del usuario obtenidos:', userData); // Para debugging
      
      // CORREGIDO: Obtener isActive directamente del usuario
      const isUserActive = userData.isActive !== undefined ? userData.isActive : userData.is_active;
      
      // 2. Verificar si el usuario tiene perfil de cliente
      let hasProfile = false;
      let profileData = null;
      try {
        const profileResponse = await API.get(`/client-profiles/user/${user.id}`);
        profileData = profileResponse.data.data || profileResponse.data;
        hasProfile = !!(profileData && (profileData.nit_number || profileData.nit));
        console.log('Perfil de cliente:', { hasProfile, profileData }); // Para debugging
      } catch (profileError) {
        console.log('Usuario sin perfil de cliente:', profileError.response?.status);
        hasProfile = false;
      }

      // 3. Verificar si está pendiente de sincronización SAP
      let isPending = false;
      try {
        isPending = await sapSyncService.isUserPendingSync(user.id);
        console.log('Estado de sincronización SAP:', { isPending }); // Para debugging
      } catch (syncError) {
        console.warn('Error verificando estado de sincronización SAP:', syncError);
        isPending = false;
      }

      // 4. Determinar estado general
      const newStatus = {
        isActive: Boolean(isUserActive),
        hasClientProfile: hasProfile,
        isPendingSync: isPending,
        syncInProgress: isPending,
        canCreateOrders: Boolean(isUserActive) && hasProfile, // Solo requiere usuario activo y perfil
        loading: false,
        lastChecked: new Date().toISOString(),
        statusMessage: getStatusMessage(Boolean(isUserActive), hasProfile, isPending)
      };

      setUserStatus(newStatus);
      setError(null);

      console.log('Estado de activación actualizado:', {
        userId: user.id,
        isActive: isUserActive,
        hasProfile: hasProfile,
        isPending: isPending,
        canCreateOrders: newStatus.canCreateOrders,
        originalUserData: userData // Para debugging
      });

    } catch (error) {
      console.error('Error checking user activation status:', error);
      setError(error.response?.data?.message || error.message || 'Error al verificar estado del usuario');
      setUserStatus(prev => ({
        ...prev,
        loading: false,
        statusMessage: 'Error al verificar estado del usuario'
      }));
    }
  }, [user?.id]);

  // Función para obtener mensaje de estado
  const getStatusMessage = (isActive, hasProfile, isPending) => {
    if (!hasProfile) {
      return 'Debes completar tu perfil de cliente para poder crear pedidos';
    }
    if (!isActive) {
      return 'Tu cuenta no está activa. Contacta con el administrador para activar tu cuenta.';
    }
    if (hasProfile && isActive && !isPending) {
      return 'Tu cuenta está activa y puedes crear pedidos';
    }
    if (hasProfile && isActive && isPending) {
      return 'Tu cuenta está activa y puedes crear pedidos. Tu perfil está siendo sincronizado en segundo plano.';
    }
    return 'Tu cuenta está configurada correctamente';
  };

  // Función para activar usuario manualmente (para administradores)
  const activateUser = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Usuario no identificado' };

    try {
      const result = await sapSyncService.activateClient(user.id);
      if (result.success) {
        setTimeout(() => checkUserActivationStatus(), 2000);
      }
      return result;
    } catch (error) {
      console.error('Error activating user:', error);
      return { success: false, error: 'Error al activar usuario' };
    }
  }, [user?.id, checkUserActivationStatus]);

  // Función para iniciar sincronización manual
  const triggerSync = useCallback(async () => {
    try {
      const result = await sapSyncService.triggerFullSync();
      if (result.success) {
        setTimeout(() => checkUserActivationStatus(), 3000);
      }
      return result;
    } catch (error) {
      console.error('Error triggering sync:', error);
      setError('Error al iniciar sincronización');
      return { success: false, error: 'Error al iniciar sincronización' };
    }
  }, [checkUserActivationStatus]);

  // NUEVO: Función para obtener estado actual del usuario directamente
  const getCurrentUserStatus = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const response = await API.get(`/users/${user.id}`);
      const userData = response.data.data || response.data;
      return {
        isActive: userData.isActive !== undefined ? userData.isActive : userData.is_active,
        userData: userData
      };
    } catch (error) {
      console.error('Error getting current user status:', error);
      return null;
    }
  }, [user?.id]);

  // Verificar estado al cargar
  useEffect(() => {
    checkUserActivationStatus();
  }, [checkUserActivationStatus]);

  // Auto-refresh si está pendiente de sincronización
  useEffect(() => {
    let interval;
    if (userStatus.isPendingSync && !userStatus.loading) {
      interval = setInterval(() => {
        checkUserActivationStatus();
      }, 30000); // Verificar cada 30 segundos
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [userStatus.isPendingSync, userStatus.loading, checkUserActivationStatus]);

  return {
    userStatus,
    error,
    checkStatus: checkUserActivationStatus,
    triggerSync,
    activateUser,
    refresh: checkUserActivationStatus,
    getCurrentUserStatus // NUEVO: Función adicional para obtener estado directo
  };
};