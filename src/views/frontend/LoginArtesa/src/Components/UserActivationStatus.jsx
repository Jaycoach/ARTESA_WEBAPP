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

  // Usuario puede crear órdenes
  if (userStatus.canCreateOrders) {
    return showDetailedStatus ? (
      <div className="bg-green-50 border border-green-200 rounded-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <span className="text-green-700 font-medium">Cuenta activa - Puedes crear pedidos</span>
          </div>
          <button
            onClick={refresh}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Actualizar
          </button>
        </div>
        <p className="text-sm text-green-600 mt-1">{userStatus.statusMessage}</p>
        {userStatus.lastChecked && (
          <p className="text-xs text-green-500 mt-1">
            Última verificación: {new Date(userStatus.lastChecked).toLocaleString()}
          </p>
        )}
      </div>
    ) : null;
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
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Completar perfil
          </button>
          <button
            onClick={refresh}
            className="px-3 py-2 border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
          >
            Verificar estado
          </button>
        </div>
      </div>
    );
  }

  // Sincronización en progreso
  if (userStatus.isPendingSync) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex items-center mb-2">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-yellow-500 mr-3"></div>
          <span className="text-yellow-700 font-medium">Sincronización con SAP en progreso</span>
        </div>
        <p className="text-sm text-yellow-600 mb-3">{userStatus.statusMessage}</p>
        <div className="flex space-x-2">
          <button
            onClick={refresh}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Verificar estado
          </button>
          {allowManualActions && (
            <button
              onClick={triggerSync}
              className="px-3 py-2 border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-100"
            >
              Reintentar sincronización
            </button>
          )}
        </div>
        <div className="mt-3 text-xs text-yellow-600">
          <p>⏱️ La sincronización puede tomar entre 2-5 minutos</p>
          <p>🔄 Esta página se actualiza automáticamente cada 30 segundos</p>
        </div>
      </div>
    );
  }

  // Cuenta inactiva
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4">
      <div className="flex items-center mb-2">
        <span className="text-red-500 mr-2">🚫</span>
        <span className="text-red-700 font-medium">Cuenta no activa</span>
      </div>
      <p className="text-sm text-red-600 mb-3">{userStatus.statusMessage}</p>
      <div className="flex space-x-2">
        {allowManualActions && (
          <button
            onClick={activateUser}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Activar cuenta
          </button>
        )}
        <button
          onClick={() => window.location.href = '/dashboard/support'}
          className="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-100"
        >
          Contactar soporte
        </button>
        <button
          onClick={refresh}
          className="px-3 py-2 border border-red-300 text-red-700 rounded hover:bg-red-100"
        >
          Verificar estado
        </button>
      </div>
    </div>
  );
};

export default UserActivationStatus;