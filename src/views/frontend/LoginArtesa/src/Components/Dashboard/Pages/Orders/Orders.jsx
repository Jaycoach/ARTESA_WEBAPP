import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useOrders } from '../../../../hooks/useOrders';
import CreateOrderForm from './CreateOrderForm';
import OrderList from './OrderList';
import EditOrderForm from './EditOrderForm';

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
          <div className={`mb-4 p-4 rounded-md ${
            notification.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 
            notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500' : 
            'bg-red-100 text-red-800 border-l-4 border-red-500'
          }`}>
            {notification.message}
          </div>
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
        <div className={`mb-4 p-4 rounded-md ${
          notification.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 
          notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500' : 
          'bg-red-100 text-red-800 border-l-4 border-red-500'
        }`}>
          {notification.message}
        </div>
      )}
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
            <button
              onClick={() => navigate('/dashboard/orders')}
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
    </div>
  );
};

export default Orders;