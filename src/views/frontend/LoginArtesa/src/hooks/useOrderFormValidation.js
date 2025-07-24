import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useUserActivation } from './useUserActivation';
import { useNavigate } from 'react-router-dom';
import API from '../api/config';

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


  const validateAccess = async () => {
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

    try {
      // USAR LA MISMA VALIDACIÓN QUE Orders.jsx - endpoint can-create
      const response = await API.get(`/orders/can-create/${user.id}`);
      const { data } = response.data;

      const errors = [];
      const warnings = [];

      // Si el endpoint dice que NO puede crear, analizar las razones
      if (!data.canCreate) {
        if (!data.isActive) {
          errors.push({
            type: 'USER_INACTIVE',
            message: 'Tu cuenta está inactiva y no puede realizar pedidos.',
            action: 'CONTACT_SUPPORT'
          });
        } else if (!data.hasProfile) {
          errors.push({
            type: 'PROFILE_INCOMPLETE',
            message: 'Debes completar tu perfil de cliente antes de crear pedidos',
            action: 'COMPLETE_PROFILE',
            redirectTo: '/dashboard/profile/client-info'
          });
        } else if (!data.hasCardCode) {
          warnings.push({
            type: 'PENDING_CARD_CODE',
            message: 'Tu perfil está siendo procesado por nuestro equipo',
            estimatedTime: '1-2 días hábiles'
          });
        } else {
          errors.push({
            type: 'UNKNOWN_RESTRICTION',
            message: 'Tu cuenta no tiene permisos para crear pedidos en este momento.',
            action: 'CONTACT_SUPPORT'
          });
        }
      }

      const validationResult = {
        isValid: data.canCreate && errors.length === 0,
        canProceed: data.canCreate,
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

    } catch (error) {
      console.error('❌ Error al validar creación de pedidos:', error);

      // Manejo de errores del endpoint
      const errors = [{
        type: 'VALIDATION_ERROR',
        message: 'No pudimos verificar el estado de tu cuenta en este momento.',
        action: 'RETRY'
      }];

      setValidationState({
        isValidating: false,
        canAccessForm: false,
        validationResult: {
          isValid: false,
          canProceed: false,
          errors,
          warnings: []
        },
        error: error.message,
        retryCount: validationState.retryCount + 1
      });
    }
  };

  // Efecto para validar cuando cambia el estado del usuario
  useEffect(() => {
    if (user?.id) {
      validateAccess();
    } else {
      setValidationState(prev => ({ ...prev, isValidating: true }));
    }
  }, [user?.id]); // Solo depender del user.id, no de userStatus

  const retryValidation = () => {
    checkStatus();
  };

  return {
    ...validationState,
    retryValidation,
    refresh: retryValidation
  };
};