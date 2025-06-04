import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useUserActivation } from '../../../../hooks/useUserActivation';
import CreateOrderForm from './CreateOrderForm';
import OrderList from './OrderList';
import EditOrderForm from './EditOrderForm';
import Notification from '../../../../Components/ui/Notification';
import { FaExclamationTriangle, FaUserCheck, FaSync, FaPlus } from 'react-icons/fa';

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const { userStatus, refresh: refreshUserStatus } = useUserActivation();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('list');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  // Validación mejorada del estado del usuario
  const canCreateOrders = userStatus.isActive && userStatus.hasClientProfile && !userStatus.isPendingSync;
  
  const isEditMode = location.pathname.includes('/edit');
  const isNewMode = location.pathname.includes('/new') || location.search.includes('tab=new');

  useEffect(() => {
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

  const handleOrderUpdated = () => {
    setActiveTab('list');
    showNotification('Tu pedido ha sido actualizado exitosamente', 'success');
    navigate('/dashboard/orders');
  };

  // Función mejorada para manejar clic en crear pedido
  const handleCreateOrderClick = () => {
    if (!canCreateOrders) {
      showNotification(userStatus.statusMessage, 'warning');
      return;
    }
    navigate('/dashboard/orders/new');
  };

  // Componente para mostrar el estado del usuario
  const UserStatusAlert = () => {
    if (canCreateOrders || userStatus.loading) return null;

    const getAlertIcon = () => {
      if (!userStatus.hasClientProfile) return <FaUserCheck className="text-orange-500" />;
      if (userStatus.isPendingSync) return <FaSync className="text-blue-500 animate-spin" />;
      return <FaExclamationTriangle className="text-red-500" />;
    };

    const getAlertColor = () => {
      if (!userStatus.hasClientProfile) return 'bg-orange-50 border-orange-200 text-orange-800';
      if (userStatus.isPendingSync) return 'bg-blue-50 border-blue-200 text-blue-800';
      return 'bg-red-50 border-red-200 text-red-800';
    };

    return (
      <div className={`mb-6 p-4 rounded-lg border-l-4 ${getAlertColor()}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-3">
            {getAlertIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium mb-1">
              Estado de la cuenta
            </h3>
            <p className="text-sm">
              {userStatus.statusMessage}
            </p>
            {!userStatus.hasClientProfile && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                Para completar tu perfil de cliente, haz clic en tu <strong>cuenta</strong> (parte superior derecha) y selecciona <strong>"Mi Perfil"</strong>.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Componente para el botón de crear pedido
  const CreateOrderButton = () => {
    if (userStatus.loading) {
      return (
        <div className="flex items-center justify-center p-3 bg-gray-100 rounded-lg">
          <FaSync className="animate-spin text-gray-500 mr-2" />
          <span className="text-gray-600">Verificando estado...</span>
        </div>
      );
    }

    if (!canCreateOrders) {
      return (
        <button
          disabled
          className="flex items-center justify-center w-full p-3 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed opacity-50"
          title={userStatus.statusMessage}
        >
          <FaPlus className="mr-2" />
          Crear Nuevo Pedido
        </button>
      );
    }

    return (
      <button
        onClick={handleCreateOrderClick}
        className="flex items-center justify-center w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
      >
        <FaPlus className="mr-2" />
        Crear Nuevo Pedido
      </button>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <FaExclamationTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-2 text-lg font-medium text-gray-900">Acceso restringido</h2>
            <p className="mt-1 text-sm text-gray-600">
              Debes iniciar sesión para acceder a tus pedidos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Gestión de Pedidos</h1>
        
        {/* Mostrar alerta de estado del usuario */}
        <UserStatusAlert />
        
        {/* Botón de crear pedido con validación */}
        <div className="mb-6">
          <CreateOrderButton />
        </div>
      </div>

      {/* Resto del componente */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mis Pedidos
            </button>
            {canCreateOrders && (
              <button
                onClick={() => setActiveTab('new')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'new'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Nuevo Pedido
              </button>
            )}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'list' && (
            <OrderList />
          )}
          
          {activeTab === 'new' && canCreateOrders && (
            <CreateOrderForm 
              onOrderCreated={handleOrderCreated}
              onCancel={() => setShowCancelConfirmation(true)}
            />
          )}
          
          {activeTab === 'edit' && orderId && (
            <EditOrderForm 
              orderId={orderId}
              onOrderUpdated={handleOrderUpdated}
              onCancel={() => setShowCancelConfirmation(true)}
            />
          )}
        </div>
      </div>

      {/* Notificación */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ show: false, message: '', type: '' })}
        />
      )}

      {/* Modal de confirmación de cancelación */}
      {showCancelConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <FaExclamationTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Cancelar cambios</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  ¿En realidad quiere cancelar el trabajo en curso?
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-24 mr-2 hover:bg-red-600"
                >
                  Sí
                </button>
                <button
                  onClick={handleCancelConfirmationClose}
                  className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-24 hover:bg-gray-600"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;