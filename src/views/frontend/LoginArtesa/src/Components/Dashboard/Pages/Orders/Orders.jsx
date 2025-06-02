import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useUserActivation } from '../../../../hooks/useUserActivation'; // NUEVO
import CreateOrderForm from './CreateOrderForm';
import OrderList from './OrderList';
import EditOrderForm from './EditOrderForm';
import Notification from '../../../../Components/ui/Notification';
import { FaUserCheck, FaUserClock, FaUserTimes, FaExclamationTriangle } from 'react-icons/fa'; // NUEVO
import API from '../../../../api/config';

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const { userStatus, error: userError, refresh: refreshUserStatus } = useUserActivation(); // NUEVO
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Estados existentes
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterDates, setFilterDates] = useState({ from: '', to: '' });
  const [activeTab, setActiveTab] = useState('list');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const showNotification = (message, type = 'success') => {
    setNotification({
      show: true,
      message,
      type
    });

    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  // NUEVO: Componente para mostrar el estado del usuario en lugar del botón
  const UserStatusSection = () => {
    if (userStatus.loading) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-4"></div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-blue-800 mb-1">Verificando tu cuenta</h3>
              <p className="text-blue-700 text-sm">Estamos validando el estado de tu cuenta...</p>
            </div>
          </div>
        </div>
      );
    }

    if (userError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <FaUserTimes className="text-red-500 mr-4 mt-1 text-2xl flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-red-800 mb-2">Error de validación</h3>
              <p className="text-red-700 mb-4">{userError}</p>
              <button
                onClick={refreshUserStatus}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
              >
                Reintentar validación
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!userStatus.hasClientProfile) {
      return (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <FaUserClock className="text-yellow-500 mr-4 mt-1 text-2xl flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-xl font-medium text-yellow-800 mb-2">
                ¡Completa tu perfil para crear pedidos!
              </h3>
              <p className="text-yellow-700 mb-4 text-sm leading-relaxed">
              Para comenzar a realizar pedidos necesitas completar tu perfil de cliente con la información requerida. 
              Puedes hacerlo desde el menú "MI PERFIL" en la parte superior de la página.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (userStatus.isPendingSync) {
      return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-4 mt-1 flex-shrink-0"></div>
            <div className="flex-1">
              <h3 className="text-xl font-medium text-blue-800 mb-2">
                🔄 Sincronización en progreso
              </h3>
              <p className="text-blue-700 mb-3 text-sm leading-relaxed">
                Tu perfil está siendo sincronizado con nuestro sistema. Este proceso puede tomar algunos minutos.
                Una vez completado, podrás crear pedidos sin restricciones.
              </p>
              <div className="bg-blue-100 rounded-lg p-3 mb-4">
                <div className="text-xs text-blue-700 space-y-1">
                  <p className="flex items-center">
                    <span className="mr-2">⏱️</span>
                    <strong>Tiempo estimado:</strong> 2-5 minutos
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">🔄</span>
                    Esta página se actualiza automáticamente cada 30 segundos
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={refreshUserStatus}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Verificar estado ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!userStatus.isActive) {
      return (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <FaUserTimes className="text-red-500 mr-4 mt-1 text-2xl flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-xl font-medium text-red-800 mb-2">
                🚫 Cuenta pendiente de activación
              </h3>
              <p className="text-red-700 mb-3 text-sm leading-relaxed">
                Tu perfil está completo, pero tu cuenta aún no ha sido activada por nuestro equipo. 
                Nuestros administradores están revisando tu información y te activarán pronto.
              </p>
                <button
                  onClick={refreshUserStatus}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Verificar estado
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Usuario activo - mostrar mensaje de éxito y botón para crear pedido
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FaUserCheck className="text-green-500 mr-4 text-2xl" />
            <div>
              <h3 className="text-lg font-medium text-green-800">
                ✅ Tu cuenta está activa
              </h3>
              <p className="text-green-700 text-sm">
                Puedes crear pedidos y acceder a todas las funcionalidades
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/orders/new')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center"
          >
            <span className="mr-2">+</span>
            Crear Nuevo Pedido
          </button>
        </div>
      </div>
    );
  };

  // ELIMINAR: lógica antigua de validación con is_active
  // useEffect(() => {
  //   if (user && user.is_active === false && location.pathname.includes('/orders/new')) {
  //     showNotification(userStatusMessage || 'El usuario no puede crear órdenes', 'error');
  //     navigate('/dashboard/orders');
  //   }
  // }, [user, location.pathname, navigate, userStatusMessage]);

  // useEffect(() => {
  //   if (user) {
  //     const isActive = user.is_active !== undefined ? user.is_active : true;
  //     setIsUserActive(isActive);
  //     console.log("Estado de activación del usuario:", isActive);
  //   }
  // }, [user]);

  // Check if we're in edit mode based on URL path
  const isEditMode = location.pathname.includes('/edit');

  // Check if we're in new mode based on URL path or query param
  const isNewMode = location.pathname.includes('/new') || location.search.includes('tab=new');

  useEffect(() => {
    // Set the active tab based on URL
    if (isNewMode) {
      setActiveTab('new');
    } else if (isEditMode) {
      setActiveTab('edit');
    } else {
      setActiveTab('list');
    }
  }, [location.pathname, location.search, isNewMode, isEditMode]);

  const handleOrderCreated = () => {
    setActiveTab('list');
    showNotification('Tu pedido ha sido creado exitosamente', 'success');
    navigate('/dashboard/orders');
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false);
    navigate('/dashboard/orders');
  };

  const handleCancelConfirmationClose = () => {
    setShowCancelConfirmation(false);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');

    if (tab === 'new') {
      setActiveTab('new');
    }
  }, []);

  const handleOrderUpdated = () => {
    setActiveTab('list');
    showNotification('Tu pedido ha sido actualizado exitosamente', 'success');
    navigate('/dashboard/orders');
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md">
          <p className="font-medium">Acceso restringido</p>
          <p>Debes iniciar sesión para acceder a tus pedidos.</p>
        </div>
      </div>
    );
  }

  // Si estamos en modo edicion de un order ID
  if (isEditMode && orderId) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Editar Pedido #{orderId}</h1>

        {notification.show && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification({ show: false, message: '', type: '' })}
          />
        )}

        <EditOrderForm
          orderId={orderId}
          onOrderUpdated={handleOrderUpdated}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestión de Pedidos</h1>

      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ show: false, message: '', type: '' })}
        />
      )}

      {/* NUEVO: Sección de estado del usuario en lugar de tabs */}
      <UserStatusSection />

      {/* MODIFICADO: Tabs simplificados - solo mostrar si el usuario puede crear pedidos */}
      {userStatus.canCreateOrders && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button
                onClick={() => {
                  if (activeTab === 'new') {
                    setShowCancelConfirmation(true);
                  } else {
                    navigate('/dashboard/orders');
                  }
                }}
                className={`${activeTab === 'list'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
              >
                Mis Pedidos
              </button>
              <button
                onClick={() => navigate('/dashboard/orders/new')}
                className={`${activeTab === 'new'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
              >
                Nuevo Pedido
              </button>
            </nav>
          </div>
        </div>
      )}

      <div className="mt-6">
        {activeTab === 'new' ? (
          userStatus.canCreateOrders ? (
            <CreateOrderForm onOrderCreated={handleOrderCreated} />
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center">
                <FaExclamationTriangle className="text-yellow-500 mr-3 text-xl" />
                <div>
                  <h3 className="font-medium text-yellow-800">No puedes crear pedidos en este momento</h3>
                  <p className="text-yellow-700 text-sm mt-1">
                    Revisa la información anterior para completar la configuración de tu cuenta.
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          <OrderList />
        )}
      </div>

      {/* Modal de confirmación para cancelar */}
      {showCancelConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar cancelación</h3>
            <p className="text-gray-500 mb-6">¿En realidad quiere cancelar el trabajo en curso?</p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                onClick={handleCancelConfirmationClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                onClick={handleConfirmCancel}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;