import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useUserActivation } from '../../../../hooks/useUserActivation';
import CreateOrderForm from './CreateOrderForm';
import OrderList from './OrderList';
import EditOrderForm from './EditOrderForm';
import Notification from '../../../../Components/ui/Notification';
import API, { BranchOrdersAPI } from '../../../../api/config';
import { FaExclamationTriangle, FaUserCheck, FaSync, FaPlus, FaArrowLeft } from 'react-icons/fa';
import { AUTH_TYPES } from '../../../../constants/AuthTypes';

const Orders = () => {
  // ✅ OBTENER CONTEXTO COMPLETO DE AUTENTICACIÓN
  const { user, branch, authType, isAuthenticated } = useAuth();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Estados principales
  const [currentView, setCurrentView] = useState('list');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  // ✅ NUEVOS ESTADOS PARA MANEJO DE ÓRDENES
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [errorOrders, setErrorOrders] = useState(null);

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

  // Hook para validación de usuario
  const { userStatus, error: activationError, refresh: refreshActivation } = useUserActivation();

  // ✅ FUNCIÓN PARA OBTENER ÓRDENES SEGÚN TIPO DE USUARIO
  const fetchOrders = async () => {
    if (!isAuthenticated) {
      console.log('❌ Usuario no autenticado');
      setOrders([]);
      setErrorOrders('Usuario no autenticado');
      return;
    }

    setLoadingOrders(true);
    setErrorOrders(null);

    try {
      let response;
      let userId;

      if (authType === AUTH_TYPES.BRANCH && branch) {
        userId = branch.branch_id || branch.client_id;
        console.log('🏢 Cargando órdenes para usuario BRANCH:', userId);

        try {
          // ✅ INTENTAR ENDPOINT ESPECÍFICO DE BRANCH
          response = await BranchOrdersAPI.getOrders({});
        } catch (branchError) {
          if (branchError.response?.status === 404) {
            console.log('⚠️ Endpoint branch-orders no existe, usando endpoint estándar con filtro');

            // ✅ FALLBACK: Usar endpoint estándar con filtro por branch
            response = await API.get(`/orders?branch_id=${userId}`);

            // Si tampoco existe, crear respuesta vacía
            if (!response.data) {
              response = { data: { success: true, data: [] } };
            }
          } else {
            throw branchError;
          }
        }

      } else if (authType === AUTH_TYPES.USER && user) {
        userId = user.id;
        console.log('👤 Cargando órdenes para usuario PRINCIPAL:', userId);
        response = await API.get(`/orders/user/${userId}`);
      } else {
        throw new Error('No se pudo identificar el tipo de usuario');
      }

      const ordersData = response?.data?.data || response?.data || [];
      setOrders(ordersData);

      console.log('✅ Órdenes cargadas exitosamente:', {
        authType,
        userId,
        ordersCount: ordersData.length
      });

    } catch (error) {
      console.error('❌ Error cargando órdenes:', error);

      // ✅ MANEJO ESPECÍFICO PARA USUARIOS BRANCH SIN ENDPOINT
      if (authType === AUTH_TYPES.BRANCH && error.response?.status === 404) {
        console.log('ℹ️ Endpoint de órdenes branch no disponible, mostrando lista vacía');
        setOrders([]);
        setErrorOrders(null); // No mostrar error, solo lista vacía
      } else {
        const errorMessage = error.response?.data?.message || error.message || 'Error al cargar órdenes';
        setErrorOrders(errorMessage);
        setOrders([]);
        showNotification(errorMessage, 'error');
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  // ✅ CARGAR ÓRDENES CUANDO CAMBIE EL CONTEXTO DE AUTENTICACIÓN
  useEffect(() => {
    fetchOrders();
  }, [user, branch, authType, isAuthenticated]);

  // Función simplificada para validación
  const checkCanCreateStatus = async () => {
    if (userStatus.loading) {
      setCanCreateValidation(prev => ({ ...prev, loading: true }));
      return;
    }

    if (authType === AUTH_TYPES.BRANCH && branch) {
      setCanCreateValidation({
        loading: false,
        canCreate: true,
        isActive: true,
        hasProfile: true,
        hasCardCode: true,
        statusMessage: 'Tu cuenta de sucursal está habilitada para crear pedidos.',
        actionMessage: ''
      });
    } else if (authType === AUTH_TYPES.USER && user) {
      try {
        console.log('🔍 Validando con endpoint real para usuario:', user.id);

        // ✅ USAR ENDPOINT REAL PARA LA DECISIÓN FINAL
        const response = await API.get(`/orders/can-create/${user.id}`);

        if (response.data.success) {
          const endpointData = response.data.data;

          console.log('✅ Respuesta del endpoint:', endpointData);

          setCanCreateValidation({
            loading: false,
            canCreate: endpointData.canCreate, // ✅ Usar respuesta del endpoint
            isActive: endpointData.isActive,
            hasProfile: endpointData.hasProfile,
            hasCardCode: endpointData.hasCardCode,
            statusMessage: endpointData.canCreate
              ? 'Tu cuenta está activa y puedes crear pedidos'
              : getStatusMessageFromEndpoint(endpointData),
            actionMessage: endpointData.canCreate
              ? ''
              : 'Para completar tu perfil de cliente, haz clic en tu cuenta (parte superior derecha) y selecciona "Mi Perfil".'
          });
        }
      } catch (error) {
        console.error('❌ Error en endpoint, usando fallback del hook:', error);

        // Fallback al hook en caso de error del endpoint
        setCanCreateValidation({
          loading: false,
          canCreate: userStatus.canCreateOrders,
          isActive: userStatus.isActive,
          hasProfile: userStatus.hasClientProfile,
          hasCardCode: true,
          statusMessage: userStatus.statusMessage,
          actionMessage: userStatus.canCreateOrders ? '' :
            'Para completar tu perfil de cliente, haz clic en tu cuenta (parte superior derecha) y selecciona "Mi Perfil".'
        });
      }
    }
  };

  // Función auxiliar para generar mensajes según la respuesta del endpoint
  const getStatusMessageFromEndpoint = (data) => {
    if (!data.hasProfile) {
      return 'Debes completar tu perfil de cliente para poder crear pedidos';
    }
    if (!data.isActive) {
      return 'Tu cuenta no está activa. Contacta con el administrador para activar tu cuenta.';
    }
    if (!data.hasCardCode) {
      return 'Tu perfil está siendo sincronizado. Podrás crear pedidos una vez completado.';
    }
    return 'No puedes crear pedidos en este momento';
  };

  // Actualizar validación cuando cambie el estado
  useEffect(() => {
  checkCanCreateStatus();
}, [userStatus.loading, userStatus.canCreateOrders, authType, user, branch]);

  // Manejar navegación basada en la URL con validación
  useEffect(() => {
    const path = location.pathname;

    if (path.includes('/new')) {
      if (!canCreateValidation.loading && canCreateValidation.canCreate) {
        setCurrentView('create');
      } else if (!canCreateValidation.loading && !canCreateValidation.canCreate) {
        setCurrentView('list');
        const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
        navigate(`${routePrefix}/orders`, { replace: true });
        showNotification(canCreateValidation.statusMessage, 'warning');
      }
    } else if (path.includes('/edit') || orderId) {
      setCurrentView('edit');
    } else {
      setCurrentView('list');
    }
  }, [location.pathname, orderId, canCreateValidation.loading,
  canCreateValidation.canCreate, navigate, canCreateValidation.statusMessage, authType]);

  // ✅ MANEJAR CLIC EN CREAR PEDIDO CON CONTEXTO CORRECTO
  const handleCreateOrderClick = async () => {
    console.log('🎯 handleCreateOrderClick - Estado actual:', {
      authType,
      loading: canCreateValidation.loading,
      canCreate: canCreateValidation.canCreate,
      statusMessage: canCreateValidation.statusMessage,
      userStatusFromHook: userStatus.canCreateOrders, 
      userStatusMessage: userStatus.statusMessage 
    });

    if (canCreateValidation.loading) {
      showNotification('Verificando estado de la cuenta...', 'info');
      return;
    }

    if (!canCreateValidation.canCreate) {
      showNotification(canCreateValidation.statusMessage, 'warning');
      return;
    }

    // Navegar según tipo de usuario
    const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
    console.log('✅ Navegando a crear pedido:', `${routePrefix}/orders/new`);

    setCurrentView('create');
    navigate(`${routePrefix}/orders/new`);
  };

  // Manejar eventos del formulario
  const handleOrderCreated = () => {
    setCurrentView('list');
    showNotification('Tu pedido ha sido creado exitosamente', 'success');
    fetchOrders(); // ✅ Recargar órdenes

    const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
    navigate(`${routePrefix}/orders`);
  };

  const handleOrderUpdated = () => {
    setCurrentView('list');
    showNotification('Tu pedido ha sido actualizado exitosamente', 'success');
    fetchOrders(); // ✅ Recargar órdenes

    const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
    navigate(`${routePrefix}/orders`);
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false);
    setCurrentView('list');

    const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
    navigate(`${routePrefix}/orders`);
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

  // **COMPONENTE**: Botón de volver
  const BackButton = () => {
    if (currentView === 'list') return null;

    return (
      <button
        onClick={() => {
          setCurrentView('list');
          const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
          navigate(`${routePrefix}/orders`);
        }}
        className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
      >
        <FaArrowLeft className="mr-2" />
        Volver a Mis Pedidos
      </button>
    );
  };

  // ✅ INFORMACIÓN DE DEBUG (solo en desarrollo)
  const DebugInfo = () => {
    if (!import.meta.env.DEV) return null;

    return (
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Debug Orders:</strong>
          Tipo: {authType} |
          Usuario: {authType === AUTH_TYPES.BRANCH
            ? (branch?.branchname || 'N/A')
            : (user?.nombre || user?.name || 'N/A')} |
          ID: {authType === AUTH_TYPES.BRANCH
            ? (branch?.branch_id || branch?.client_id || 'N/A')
            : (user?.id || 'N/A')} |
          Órdenes: {orders.length} |
          Cargando: {loadingOrders ? 'SÍ' : 'NO'} |
          Error: {errorOrders || 'Ninguno'}
        </p>
      </div>
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
      {/* ✅ INFO DE DEBUG */}
      <DebugInfo />

      {/* Header dinámico según la vista actual */}
      <div className="mb-6">
        <BackButton />

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {currentView === 'create' && 'Crear Nuevo Pedido'}
          {currentView === 'edit' && 'Editar Pedido'}
          {currentView === 'list' && `Gestión de Pedidos ${authType === AUTH_TYPES.BRANCH ? '- Sucursal' : ''}`}
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

      {/* **CONTENIDO** - Renderizado condicional basado en currentView */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          {/* Vista de lista de pedidos */}
          {currentView === 'list' && (
            <OrderList
              orders={orders}
              loading={loadingOrders}
              error={errorOrders}
              canCreateValidation={canCreateValidation}
              onCreateOrderClick={handleCreateOrderClick}
              onRefresh={fetchOrders} // ✅ Función para refrescar
            />
          )}

          {/* Vista de crear pedido */}
          {currentView === 'create' && (
            <div>
              {canCreateValidation.loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Validando permisos...</p>
                </div>
              ) : canCreateValidation.canCreate ? (
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
                      const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
                      navigate(`${routePrefix}/orders`);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Volver a Mis Pedidos
                  </button>
                </div>
              )}
            </div>
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