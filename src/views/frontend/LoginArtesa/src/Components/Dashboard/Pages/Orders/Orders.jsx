import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useOrders } from '../../../../hooks/useOrders';
import CreateOrderForm from './CreateOrderForm';
import OrderList from './OrderList';

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const { refreshOrders } = useOrders();
  const [activeTab, setActiveTab] = useState('list');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  
  const handleOrderCreated = () => {
    setActiveTab('list');
    showNotification('Tu pedido ha sido creado exitosamente', 'success');
    
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
              onClick={() => setActiveTab('list')}
              className={`${
                activeTab === 'list'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
            >
              Mis Pedidos
            </button>
            <button
              onClick={() => setActiveTab('new')}
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