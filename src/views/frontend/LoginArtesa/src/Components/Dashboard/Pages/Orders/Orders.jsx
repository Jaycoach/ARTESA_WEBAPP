import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useOrders } from '../../../../hooks/useOrders';
import CreateOrderForm from './CreateOrderForm';
import OrderList from './OrderList';
import EditOrderForm from './EditOrderForm';
import Notification from '../../../../Components/ui/Notification';

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('list');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  
  // Check if we're in edit mode based on URL path
  const isEditMode = location.pathname.includes('/edit');
  
  // Check if we're in new mode based on URL path or query param
  const isNewMode = location.pathname.includes('/new') || location.search.includes('tab=new');

  // Modal confirmación cancelación
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  
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
    // Refrescar la lista de pedidos
    refreshOrders();
  };
  
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
  
  const handleConfirmCancel = () => {
    setShowCancelConfirmation(false);
    navigate('/dashboard/orders');
  };
  
  const handleCancelConfirmationClose = () => {
    setShowCancelConfirmation(false);
  };

  useEffect(() => {
    // Verificar si hay un parámetro "tab" en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab === 'new') {
      setActiveTab('new');
    }
  }, []);

  // Agregar esta función en el componente Orders
  const handleOrderUpdated = () => {
    setActiveTab('list');
    showNotification('Tu pedido ha sido actualizado exitosamente', 'success');
    navigate('/dashboard/orders');
    // Si tienes una función para refrescar pedidos, llámala aquí
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
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
          <button
            onClick={() => {
              if (activeTab === 'new') {
                // Si estamos en "Nuevo Pedido", mostrar confirmación
                setShowCancelConfirmation(true);
              } else {
                // Si no, navegar directamente
                navigate('/dashboard/orders');
              }
            }}
            className={`${
              activeTab === 'list'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
          >
            Mis Pedidos
          </button>
            <button
              onClick={() => navigate('/dashboard/orders/new')}
              className={`${
                activeTab === 'new'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
            >
              Nuevo Pedido
            </button>
          </nav>
        </div>
      </div>
      
      <div className="mt-6">
        {activeTab === 'new' ? (
          <CreateOrderForm 
            onOrderCreated={handleOrderCreated} 
          />
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