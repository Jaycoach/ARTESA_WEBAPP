// hooks/useUserActivation.js - VERSIÓN FINAL CORREGIDA
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { sapSyncService } from '../services/sapSyncService';
import API from '../api/config';
import { AUTH_TYPES } from '../constants/AuthTypes';

export const useUserActivation = () => {
  const { user, branch, authType, isAuthenticated } = useAuth();

  const [userStatus, setUserStatus] = useState({
    isActive: false,
    hasClientProfile: false,
    isPendingSync: false,
    syncInProgress: false,
    canCreateOrders: false,
    statusMessage: '',
    loading: true,
    lastChecked: null,
    userType: null,
    clientInfo: null,
    branchInfo: null
  });

  const [error, setError] = useState(null);

  // ✅ REFS PARA EVITAR POLLING INNECESARIO
  const isCheckingRef = useRef(false);
  const pollingCountRef = useRef(0);
  const MAX_POLLING_ATTEMPTS = 5; // Máximo 5 intentos
  const POLLING_INTERVAL = 60000; // 1 minuto en lugar de 30 segundos

  const checkUserActivationStatus = useCallback(async (forceCheck = false) => {
    if (isCheckingRef.current && !forceCheck) {
      console.log('🔒 useUserActivation: Check ya en progreso, saltando...');
      return;
    }

    if (!isAuthenticated) {
      setUserStatus(prev => ({
        ...prev,
        loading: false,
        userType: null,
        statusMessage: 'Usuario no autenticado'
      }));
      return;
    }

    try {
      isCheckingRef.current = true;
      setUserStatus(prev => ({ ...prev, loading: true }));

      if (authType === AUTH_TYPES.BRANCH && branch) {
        await validateBranchUser();
      } else if (authType === AUTH_TYPES.USER && user) {
        await validatePrincipalUser();
      } else {
        throw new Error('Tipo de usuario no identificado');
      }

    } catch (error) {
      console.error('❌ useUserActivation Error:', error);
      setError(error.response?.data?.message || error.message || 'Error al verificar estado del usuario');
      setUserStatus(prev => ({
        ...prev,
        loading: false,
        statusMessage: 'Error al verificar estado del usuario'
      }));
    } finally {
      isCheckingRef.current = false;
    }
  }, [authType, user, branch, isAuthenticated]);

  const validateBranchUser = async () => {
    console.log('🏢 Validando usuario BRANCH');
    
    const branchResponse = await API.get('/branch-auth/profile');

    if (branchResponse.data.success) {
      const branchData = branchResponse.data.data;
      const canCreate = !!(branchData.client_id && branchData.company_name);

      const newStatus = {
        isActive: true,
        hasClientProfile: true,
        isPendingSync: false, // ✅ BRANCH nunca está pendiente
        syncInProgress: false,
        canCreateOrders: canCreate,
        loading: false,
        lastChecked: new Date().toISOString(),
        userType: 'branch',
        clientInfo: {
          client_id: branchData.client_id,
          company_name: branchData.company_name,
          nit_number: branchData.nit_number,
          card_code: branchData.company_name
        },
        branchInfo: {
          branch_id: branchData.branch_id,
          branch_name: branchData.branch_name,
          manager_name: branchData.manager_name,
          email: branchData.email_branch,
          municipality_code: branchData.municipality_code
        },
        statusMessage: canCreate
          ? 'Tu sucursal está habilitada para crear pedidos'
          : 'Tu sucursal está en configuración'
      };

      setUserStatus(newStatus);
      setError(null);

      console.log('✅ Validación BRANCH completada:', {
        canCreate,
        isPendingSync: false // ✅ SIEMPRE FALSE para branch
      });
    } else {
      throw new Error('No se pudo obtener información de la sucursal');
    }
  };

  const validatePrincipalUser = async () => {
    const userId = user.id;
    console.log('👤 Validando usuario PRINCIPAL:', userId);

    try {
      // ✅ USAR SOLO EL ENDPOINT REAL COMO FUENTE DE VERDAD
      const canCreateResponse = await API.get(`/orders/can-create/${userId}`);

      if (canCreateResponse.data.success) {
        const endpointData = canCreateResponse.data.data;

        console.log('📊 Respuesta del endpoint /orders/can-create:', endpointData);

        // ✅ LÓGICA SIMPLE Y DIRECTA
        const canCreateOrders = endpointData.canCreate;
        
        // 🔥 REGLA FUNDAMENTAL: Si puede crear órdenes, NO está pendiente de sincronización
        const isPendingSync = !canCreateOrders && endpointData.hasProfile && !endpointData.hasCardCode;

        let statusMessage;
        if (canCreateOrders) {
          statusMessage = 'Tu cuenta está activa y puedes crear pedidos';
        } else if (!endpointData.hasProfile) {
          statusMessage = 'Debes completar tu perfil de cliente para poder crear pedidos';
        } else if (!endpointData.isActive) {
          statusMessage = 'Tu cuenta no está activa. Contacta con el administrador para activar tu cuenta.';
        } else if (!endpointData.hasCardCode) {
          statusMessage = 'Tu perfil está siendo sincronizado. Podrás crear pedidos una vez completado.';
        } else {
          statusMessage = 'No puedes crear pedidos en este momento';
        }

        const newStatus = {
          isActive: endpointData.isActive,
          hasClientProfile: endpointData.hasProfile,
          isPendingSync: isPendingSync, // ✅ LÓGICA CORREGIDA
          syncInProgress: isPendingSync,
          canCreateOrders: canCreateOrders,
          loading: false,
          lastChecked: new Date().toISOString(),
          userType: 'principal',
          clientInfo: null, // Se puede obtener por separado si es necesario
          branchInfo: null,
          statusMessage: statusMessage
        };

        setUserStatus(newStatus);
        setError(null);

        console.log('✅ Validación PRINCIPAL completada:', {
          canCreateOrders,
          isPendingSync,
          statusMessage,
          willPoll: isPendingSync && pollingCountRef.current < MAX_POLLING_ATTEMPTS
        });

        // ✅ Si ya puede crear órdenes, detener polling completamente
        if (canCreateOrders) {
          pollingCountRef.current = MAX_POLLING_ATTEMPTS; // Forzar detención
          console.log('🛑 Usuario ya puede crear órdenes, polling detenido');
        }

      } else {
        throw new Error('Respuesta inválida del endpoint');
      }

    } catch (error) {
      console.error('❌ Error validating principal user:', error);
      throw error;
    }
  };

  const activateUser = useCallback(async () => {
    if (authType === AUTH_TYPES.BRANCH) {
      return { success: false, error: 'Los usuarios branch no pueden activarse directamente' };
    }

    if (!user?.id) return { success: false, error: 'Usuario no identificado' };

    try {
      const result = await sapSyncService.activateClient(user.id);
      if (result.success) {
        // ✅ Resetear contador y forzar check
        pollingCountRef.current = 0;
        setTimeout(() => checkUserActivationStatus(true), 2000);
      }
      return result;
    } catch (error) {
      return { success: false, error: 'Error al activar usuario' };
    }
  }, [authType, user?.id, checkUserActivationStatus]);

  const triggerSync = useCallback(async () => {
    try {
      const result = await sapSyncService.triggerFullSync();
      if (result.success) {
        // ✅ Resetear contador y forzar check
        pollingCountRef.current = 0;
        setTimeout(() => checkUserActivationStatus(true), 3000);
      }
      return result;
    } catch (error) {
      setError('Error al iniciar sincronización');
      return { success: false, error: 'Error al iniciar sincronización' };
    }
  }, [checkUserActivationStatus]);

  // EFFECT INICIAL
  useEffect(() => {
    console.log('🚀 useUserActivation: Iniciando validación inicial');
    checkUserActivationStatus(true);
  }, [authType, user?.id, checkUserActivationStatus, branch?.branch_id]);

  // POLLING INTELIGENTE
  useEffect(() => {
    let interval;
    
    const shouldPoll = (
      userStatus.isPendingSync && 
      !userStatus.loading && 
      pollingCountRef.current < MAX_POLLING_ATTEMPTS
    );

    if (shouldPoll) {
      pollingCountRef.current += 1;
      
      console.log(`⏰ Iniciando polling limitado (${pollingCountRef.current}/${MAX_POLLING_ATTEMPTS})`);
      
      interval = setInterval(() => {
        if (pollingCountRef.current >= MAX_POLLING_ATTEMPTS) {
          console.log('🛑 Límite de polling alcanzado, deteniendo...');
          return;
        }
        
        console.log(`🔄 Polling check (${pollingCountRef.current}/${MAX_POLLING_ATTEMPTS})`);
        checkUserActivationStatus(false);
      }, POLLING_INTERVAL);
    }

    return () => {
      if (interval) {
        console.log('🛑 Limpiando interval de polling');
        clearInterval(interval);
      }
    };
  }, [userStatus.isPendingSync, userStatus.loading, checkUserActivationStatus]);

  // FUNCIÓN PARA RESETEAR DESDE COMPONENTES
  const resetPolling = useCallback(() => {
    pollingCountRef.current = 0;
    console.log('🔄 Polling counter reset');
  }, []);

  return {
    userStatus,
    error,
    checkStatus: () => checkUserActivationStatus(true),
    triggerSync,
    activateUser,
    refresh: () => {
      resetPolling();
      return checkUserActivationStatus(true);
    },
    resetPolling
  };
};