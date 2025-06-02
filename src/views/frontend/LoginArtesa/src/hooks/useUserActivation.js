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
      
      // 1. Verificar estado del usuario
      const userResponse = await API.get(`/users/${user.id}/status`);
      const userData = userResponse.data.data || userResponse.data;
      
      // 2. Verificar si el usuario tiene perfil de cliente
      let hasProfile = false;
      let profileData = null;
      try {
        const profileResponse = await API.get(`/client-profiles/user/${user.id}`);
        profileData = profileResponse.data.data || profileResponse.data;
        hasProfile = !!(profileData && (profileData.nit_number || profileData.nit));
      } catch (profileError) {
        console.log('Usuario sin perfil de cliente:', profileError.response?.status);
        hasProfile = false;
      }

      // 3. Verificar si está pendiente de sincronización SAP
      const isPending = await sapSyncService.isUserPendingSync(user.id);

      // 4. Determinar estado general
      const newStatus = {
        isActive: userData.is_active || false,
        hasClientProfile: hasProfile,
        isPendingSync: isPending,
        syncInProgress: isPending,
        canCreateOrders: userData.is_active && hasProfile && !isPending,
        loading: false,
        lastChecked: new Date().toISOString(),
        statusMessage: getStatusMessage(userData.is_active, hasProfile, isPending)
      };

      setUserStatus(newStatus);
      setError(null);

      console.log('Estado de activación actualizado:', {
        userId: user.id,
        isActive: userData.is_active,
        hasProfile: hasProfile,
        isPending: isPending,
        canCreateOrders: newStatus.canCreateOrders
      });

    } catch (error) {
      console.error('Error checking user activation status:', error);
      setError(error.message);
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
    if (hasProfile && isPending) {
      return 'Tu perfil está siendo sincronizado con SAP. Este proceso puede tomar algunos minutos.';
    }
    if (hasProfile && !isPending && !isActive) {
      return 'Tu perfil está completo pero tu cuenta aún no ha sido activada. Contacta al administrador.';
    }
    if (isActive && hasProfile && !isPending) {
      return 'Tu cuenta está activa y puedes crear pedidos';
    }
    return 'Verificando estado de tu cuenta...';
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
    refresh: checkUserActivationStatus
  };
};