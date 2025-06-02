import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useUserActivation } from './useUserActivation';
import { useNavigate } from 'react-router-dom';

export const useOrderFormValidation = () => {
  const { user } = useAuth();
  const { userStatus, checkStatus } = useUserActivation();
  const navigate = useNavigate();
  
  const [validationState, setValidationState] = useState({
    isValidating: true,
    canAccessForm: false,
    validationResult: null,
    error: null,
    retryCount: 0
  });

  const validateAccess = () => {
    if (!user?.id) {
      setValidationState({
        isValidating: false,
        canAccessForm: false,
        validationResult: {
          isValid: false,
          errors: [{
            type: 'USER_NOT_AUTHENTICATED',
            message: 'Debes iniciar sesión para crear pedidos',
            action: 'LOGIN_REQUIRED',
            redirectTo: '/login'
          }],
          warnings: []
        },
        error: 'Usuario no autenticado',
        retryCount: 0
      });
      return;
    }

    const errors = [];
    const warnings = [];

    // Validar perfil de cliente
    if (!userStatus.hasClientProfile) {
      errors.push({
        type: 'PROFILE_INCOMPLETE',
        message: 'Debes completar tu perfil de cliente antes de crear pedidos',
        action: 'COMPLETE_PROFILE',
        redirectTo: '/dashboard/orders'
      });
    }

    // Validar sincronización SAP
    if (userStatus.hasClientProfile && userStatus.isPendingSync) {
      warnings.push({
        type: 'SYNC_IN_PROGRESS',
        message: 'Tu perfil está siendo sincronizado con SAP',
        estimatedTime: '2-5 minutos'
      });
    }

    // Validar usuario activo
    if (userStatus.hasClientProfile && !userStatus.isPendingSync && !userStatus.isActive) {
      errors.push({
        type: 'USER_INACTIVE',
        message: 'Tu cuenta no está activa. Contacta al administrador.',
        action: 'CONTACT_SUPPORT'
      });
    }

    const validationResult = {
      isValid: errors.length === 0 && warnings.length === 0,
      canProceed: errors.length === 0,
      errors,
      warnings
    };

    setValidationState({
      isValidating: false,
      canAccessForm: validationResult.canProceed,
      validationResult,
      error: null,
      retryCount: 0
    });

    // Manejar redirección automática
    if (!validationResult.canProceed && errors.length > 0) {
      const primaryError = errors[0];
      if (primaryError.redirectTo && primaryError.action === 'COMPLETE_PROFILE') {
        setTimeout(() => {
          navigate(primaryError.redirectTo);
        }, 3000);
      }
    }
  };

  // Efecto para validar cuando cambia el estado del usuario
  useEffect(() => {
    if (!userStatus.loading) {
      validateAccess();
    } else {
      setValidationState(prev => ({ ...prev, isValidating: true }));
    }
  }, [userStatus, user?.id]);

  const retryValidation = () => {
    checkStatus();
  };

  return {
    ...validationState,
    retryValidation,
    refresh: retryValidation
  };
};