import React from 'react';
import { useUserActivation } from '../hooks/useUserActivation';

const UserActivationStatus = ({ showDetailedStatus = false, allowManualActions = false }) => {
  const { userStatus, error, triggerSync, activateUser, refresh } = useUserActivation();

  if (userStatus.loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
          <span className="text-blue-700">Verificando estado de tu cuenta...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <span className="text-red-700">Error: {error}</span>
          </div>
          <button
            onClick={refresh}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Perfil incompleto
  if (!userStatus.hasClientProfile) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center mb-2">
          <span className="text-blue-500 mr-2">📋</span>
          <span className="text-blue-700 font-medium">Perfil de cliente incompleto</span>
        </div>
        <p className="text-sm text-blue-600 mb-3">{userStatus.statusMessage}</p>
        <div className="flex space-x-2">
          <button
            onClick={() => window.location.href = '/dashboard/profile/client-info'}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Completar perfil
          </button>
          <button
            onClick={refresh}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          >
            Verificar nuevamente
          </button>
        </div>
      </div>
    );
  }

  // Usuario inactivo pero con perfil
  if (userStatus.hasClientProfile && !userStatus.isActive) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex items-center mb-2">
          <span className="text-yellow-500 mr-2">⚠️</span>
          <span className="text-yellow-700 font-medium">Cuenta inactiva</span>
        </div>
        <p className="text-sm text-yellow-600 mb-3">{userStatus.statusMessage}</p>
        <div className="flex space-x-2">
          <button
            onClick={refresh}
            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
          >
            Verificar nuevamente
          </button>
        </div>
      </div>
    );
  }

  // Perfil en proceso de sincronización (pero puede crear pedidos)
  if (userStatus.isPendingSync && userStatus.canCreateOrders) {
    return showDetailedStatus ? (
      <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-orange-500 mr-2">⚠️</span>
            <span className="text-orange-700 font-medium">Tu perfil está siendo procesado por nuestro equipo</span>
          </div>
          <button
            onClick={refresh}
            className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
          >
            Actualizar
          </button>
        </div>
        <p className="text-sm text-orange-600 mt-1">Tiempo estimado: 1-2 días hábiles</p>
        <p className="text-xs text-orange-500 mt-1">
          Puedes crear pedidos normalmente mientras procesamos tu información.
        </p>
      </div>
    ) : null;
  }

  // Estado por defecto - algo inesperado
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-gray-500 mr-2">❓</span>
          <span className="text-gray-700 font-medium">Estado desconocido</span>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
        >
          Reintentar
        </button>
      </div>
      <p className="text-sm text-gray-600 mt-1">
        No pudimos determinar el estado de tu cuenta. Por favor, intenta nuevamente.
      </p>
    </div>
  );
  };

  export default UserActivationStatus;