import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useUserActivation } from '../../../../hooks/useUserActivation';
import CreateOrderForm from './CreateOrderForm';
import OrderList from './OrderList';
import EditOrderForm from './EditOrderForm';
import Notification from '../../../../Components/ui/Notification';
import API from '../../../../api/config';
import { FaExclamationTriangle, FaUserCheck, FaSync, FaPlus, FaArrowLeft } from 'react-icons/fa';

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estados principales
  const [currentView, setCurrentView] = useState('list'); // 'list', 'create', 'edit'
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  
  // Estados para validación de creación de pedidos
  const [canCreateValidation, setCanCreateValidation] = useState({
    loading: true,
    canCreate: false,
    isActive: false,
    hasProfile: false,
    hasCardCode: false,
    statusMessage: ''
  });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  // **FUNCIÓN CORREGIDA**: Usar el hook useUserActivation en lugar de validación duplicada
  const { userStatus, error: activationError, refresh: refreshActivation } = useUserActivation();

  // Función simplificada: usar directamente el estado del hook
  const getCanCreateValidation = () => {
    if (userStatus.loading) {
      return {
        loading: true,
        canCreate: false,
        isActive: false,
        hasProfile: false,
        hasCardCode: false,
        statusMessage: 'Verificando estado de tu cuenta...',
        actionMessage: ''
      };
    }

    if (activationError) {
      return {
        loading: false,
        canCreate: false,
        isActive: false,
        hasProfile: false,
        hasCardCode: false,
        statusMessage: 'No pudimos verificar el estado de tu cuenta en este momento.',
        actionMessage: 'Intenta refrescar la página o contacta al soporte si el problema continúa.'
      };
    }

    // Usar directamente los valores del hook sin lógica adicional
    return {
      loading: false,
      canCreate: userStatus.canCreateOrders,
      isActive: userStatus.isActive,
      hasProfile: userStatus.hasClientProfile,
      hasCardCode: true, // Si tiene CardCode SAP, no está pendiente
      statusMessage: userStatus.canCreateOrders ? 
        'Tu cuenta está habilitada para crear pedidos.' : 
        userStatus.statusMessage,
      actionMessage: userStatus.canCreateOrders ? '' : 
        'Para completar tu perfil de cliente, haz clic en tu cuenta (parte superior derecha) y selecciona "Mi Perfil".'
    };
  };

  // **EFECTO CORREGIDO**: Usar el estado del hook directamente
  useEffect(() => {
    // El hook useUserActivation se encarga de toda la validación automáticamente
    // Solo necesitamos actualizar nuestro estado local cuando cambie
    const newValidation = getCanCreateValidation();
    setCanCreateValidation(newValidation);
  }, [userStatus.loading, userStatus.canCreateOrders, userStatus.isActive, userStatus.hasClientProfile, 
    userStatus.isPendingSync, userStatus.statusMessage, activationError]);

  // Manejar navegación basada en la URL con validación
  useEffect(() => {
    const path = location.pathname;
    
    if (path.includes('/new')) {
      // Solo cambiar a vista de creación si la validación está completa y el usuario puede crear
      if (!canCreateValidation.loading && canCreateValidation.canCreate) {
        setCurrentView('create');
      } else if (!canCreateValidation.loading && !canCreateValidation.canCreate) {
        // Si no puede crear, redirigir a la lista y mostrar notificación
        setCurrentView('list');
        navigate('/dashboard/orders', { replace: true });
        showNotification(canCreateValidation.statusMessage, 'warning');
      }
      // Si está cargando, no hacer nada (mantener vista actual)
    } else if (path.includes('/edit') || orderId) {
      setCurrentView('edit');
    } else {
      setCurrentView('list');
    }
  }, [location.pathname, orderId, canCreateValidation.loading, canCreateValidation.canCreate, navigate, canCreateValidation.statusMessage]);

  // **FUNCIÓN MEJORADA**: Manejar clic en crear pedido con validación
  const handleCreateOrderClick = async () => {
    console.log('🎯 handleCreateOrderClick - Estado actual:', {
      loading: canCreateValidation.loading,
      canCreate: canCreateValidation.canCreate,
      statusMessage: canCreateValidation.statusMessage
    });

    if (canCreateValidation.loading) {
      showNotification('Verificando estado de la cuenta...', 'info');
      return;
    }
    
    if (!canCreateValidation.canCreate) {
      showNotification(canCreateValidation.statusMessage, 'warning');
      return;
    }
    
    // Navegar al formulario de creación INMEDIATAMENTE
    console.log('✅ Navegando a crear pedido - validación exitosa');
    setCurrentView('create');
    navigate('/dashboard/orders/new');
  };

  // Manejar eventos del formulario
  const handleOrderCreated = () => {
    setCurrentView('list');
    showNotification('Tu pedido ha sido creado exitosamente', 'success');
    navigate('/dashboard/orders');
  };

  const handleOrderUpdated = () => {
    setCurrentView('list');
    showNotification('Tu pedido ha sido actualizado exitosamente', 'success');
    navigate('/dashboard/orders');
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false);
    setCurrentView('list');
    navigate('/dashboard/orders');
  };

  const handleCancelConfirmationClose = () => {
    setShowCancelConfirmation(false);
  };

  // **COMPONENTE**: Alert de estado del usuario
  const UserStatusAlert = () => {
    if (canCreateValidation.loading || canCreateValidation.canCreate) return null;

    const getAlertIcon = () => {
      if (!canCreateValidation.hasProfile) return <FaUserCheck className="text-orange-500" />;
      if (!canCreateValidation.isActive) return <FaExclamationTriangle className="text-red-500" />;
      if (!canCreateValidation.hasCardCode) return <FaSync className="text-blue-500" />;
      return <FaExclamationTriangle className="text-red-500" />;
    };

    const getAlertColor = () => {
      if (!canCreateValidation.hasProfile) return 'bg-orange-50 border-orange-200 text-orange-800';
      if (!canCreateValidation.isActive) return 'bg-red-50 border-red-200 text-red-800';
      if (!canCreateValidation.hasCardCode) return 'bg-blue-50 border-blue-200 text-blue-800';
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
              {canCreateValidation.statusMessage}
            </p>
            {!canCreateValidation.hasProfile && (
              <div className="mt-2">
                <p className="text-sm font-medium text-blue-700 mb-1">
                  {canCreateValidation.actionMessage}
                </p>
                <button
                  onClick={() => navigate('/dashboard/profile/client-info')}
                  className="inline-flex items-center px-3 py-1 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FaUserCheck className="mr-2" />
                  Completar Perfil
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // **COMPONENTE**: Botón de crear pedido mejorado
  const CreateOrderButton = () => {
    if (canCreateValidation.loading) {
      return (
        <div className="flex items-center justify-center p-3 bg-gray-100 rounded-lg">
          <FaSync className="animate-spin text-gray-500 mr-2" />
          <span className="text-gray-600">Verificando estado...</span>
        </div>
      );
    }

    if (!canCreateValidation.canCreate) {
      return (
        <button
          disabled
          className="flex items-center justify-center w-full p-3 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed opacity-50"
          title={canCreateValidation.statusMessage}
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

  // **COMPONENTE**: Botón de volver (solo para formularios)
  const BackButton = () => {
    if (currentView === 'list') return null;

    return (
      <button
        onClick={() => {
          setCurrentView('list');
          navigate('/dashboard/orders');
        }}
        className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
      >
        <FaArrowLeft className="mr-2" />
        Volver a Mis Pedidos
      </button>
    );
  };

  // Verificar autenticación
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
      {/* Header dinámico según la vista actual */}
      <div className="mb-6">
        <BackButton />
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {currentView === 'create' && 'Crear Nuevo Pedido'}
          {currentView === 'edit' && 'Editar Pedido'}
          {currentView === 'list' && 'Gestión de Pedidos'}
        </h1>
        
        {/* Solo mostrar alerta y botón en la vista principal */}
        {currentView === 'list' && (
          <>
            <UserStatusAlert />
            
            <div className="mb-6">
              <CreateOrderButton />
            </div>
          </>
        )}
      </div>

      {/* **CONTENIDO SIN PESTAÑAS** - Renderizado condicional basado en currentView */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          {/* Vista de lista de pedidos */}
          {currentView === 'list' && (
            <OrderList 
              canCreateValidation={canCreateValidation}
              onCreateOrderClick={handleCreateOrderClick}
            />
          )}
          
          {/* Vista de crear pedido */}
          {currentView === 'create' && (
            !canCreateValidation.loading ? (
              canCreateValidation.canCreate ? (
                <CreateOrderForm 
                  onOrderCreated={handleOrderCreated}
                  onCancel={() => setShowCancelConfirmation(true)}
                />
              ) : (
                <div className="text-center py-8">
                  <FaExclamationTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No puedes crear pedidos
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {canCreateValidation.statusMessage}
                  </p>
                  <button
                    onClick={() => {
                      setCurrentView('list');
                      navigate('/dashboard/orders');
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Volver a Mis Pedidos
                  </button>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Validando permisos...</p>
              </div>
            )
          )}
          
          {/* Vista de editar pedido */}
          {currentView === 'edit' && orderId && (
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