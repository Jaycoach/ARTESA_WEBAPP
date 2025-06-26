import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
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

  // **NUEVA FUNCIÓN**: Validar si el usuario puede crear pedidos usando el endpoint específico
  const validateCanCreateOrder = async () => {
    try {
      setCanCreateValidation(prev => ({ ...prev, loading: true }));

      console.log('🔍 Validando si el usuario puede crear pedidos...');

      const response = await API.get(`/orders/can-create/${user.id}`);
      const { data } = response.data;

      console.log('📋 Respuesta de validación:', data);

      // Parsear la respuesta
      const canCreate = data.canCreate === 'true' || data.canCreate === true;

      // **MENSAJES MEJORADOS**: Más específicos y accionables
      let statusMessage = '';
      let actionMessage = '';

      if (!data.isActive) {
        statusMessage = 'Tu cuenta está inactiva y no puede realizar pedidos en este momento.';
        actionMessage = 'Contacta al equipo de soporte para activar tu cuenta o consulta el estado de tu registro.';
      } else if (!data.hasProfile) {
        statusMessage = 'Tu perfil de cliente está incompleto.';
        actionMessage = 'Completa tu información personal y de empresa para poder realizar pedidos.';
      } else if (!data.hasCardCode) {
        statusMessage = 'Tu perfil está siendo revisado por nuestro equipo.';
        actionMessage = 'Estamos procesando tu información para asignarte un código de cliente. Este proceso puede tomar 1-2 días hábiles.';
      } else if (!canCreate) {
        statusMessage = 'Tu cuenta no tiene permisos para crear pedidos.';
        actionMessage = 'Verifica tu tipo de cuenta o contacta al administrador para obtener los permisos necesarios.';
      } else {
        statusMessage = 'Tu cuenta está habilitada para crear pedidos.';
        actionMessage = '';
      }

      setCanCreateValidation({
        loading: false,
        canCreate: canCreate,
        isActive: data.isActive,
        hasProfile: data.hasProfile,
        hasCardCode: data.hasCardCode,
        statusMessage: statusMessage,
        actionMessage: actionMessage // **NUEVO CAMPO**
      });

    } catch (error) {
      console.error('❌ Error al validar creación de pedidos:', error);

      // **MANEJO DE ERRORES MEJORADO**: Más específico según el tipo de error
      let errorMessage = '';
      let errorAction = '';

      if (error.response?.status === 401) {
        errorMessage = 'Tu sesión ha expirado.';
        errorAction = 'Por favor, inicia sesión nuevamente para continuar.';
      } else if (error.response?.status === 403) {
        errorMessage = 'No tienes permisos para acceder a esta función.';
        errorAction = 'Contacta al administrador si crees que esto es un error.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Nuestros servidores están experimentando problemas técnicos.';
        errorAction = 'Intenta nuevamente en unos minutos. Si el problema persiste, contacta al soporte técnico.';
      } else if (error.code === 'NETWORK_ERROR' || !navigator.onLine) {
        errorMessage = 'Problemas de conexión a internet detectados.';
        errorAction = 'Verifica tu conexión e intenta nuevamente.';
      } else {
        errorMessage = 'No pudimos verificar el estado de tu cuenta en este momento.';
        errorAction = 'Intenta refrescar la página o contacta al soporte si el problema continúa.';
      }

      setCanCreateValidation({
        loading: false,
        canCreate: false,
        isActive: false,
        hasProfile: false,
        hasCardCode: false,
        statusMessage: errorMessage,
        actionMessage: errorAction
      });
    }
  };

  // Cargar validación al montar el componente
  useEffect(() => {
    if (isAuthenticated) {
      validateCanCreateOrder();
    }
  }, [isAuthenticated]);

  // Manejar navegación basada en la URL
  useEffect(() => {
    const path = location.pathname;
    
    if (path.includes('/new')) {
      setCurrentView('create');
    } else if (path.includes('/edit') || orderId) {
      setCurrentView('edit');
    } else {
      setCurrentView('list');
    }
  }, [location.pathname, orderId]);

  // **FUNCIÓN MEJORADA**: Manejar clic en crear pedido con validación
  const handleCreateOrderClick = async () => {
    if (canCreateValidation.loading) {
      showNotification('Verificando estado de la cuenta...', 'info');
      return;
    }
    
    if (!canCreateValidation.canCreate) {
      showNotification(canCreateValidation.statusMessage, 'warning');
      return;
    }
    
    // Navegar al formulario de creación
    navigate('/dashboard/orders/new');
    setCurrentView('create');
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
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                Para completar tu perfil de cliente, haz clic en tu <strong>cuenta</strong> (parte superior derecha) y selecciona <strong>"Mi Perfil"</strong>.
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
            <OrderList />
          )}
          
          {/* Vista de crear pedido (solo si está validado) */}
          {currentView === 'create' && canCreateValidation.canCreate && (
            <CreateOrderForm 
              onOrderCreated={handleOrderCreated}
              onCancel={() => setShowCancelConfirmation(true)}
            />
          )}
          
          {/* Vista de editar pedido */}
          {currentView === 'edit' && orderId && (
            <EditOrderForm 
              orderId={orderId}
              onOrderUpdated={handleOrderUpdated}
              onCancel={() => setShowCancelConfirmation(true)}
            />
          )}
          
          {/* Mensaje si se intenta acceder al formulario sin validación */}
          {currentView === 'create' && !canCreateValidation.canCreate && !canCreateValidation.loading && (
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
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Volver a Mis Pedidos
              </button>
            </div>
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