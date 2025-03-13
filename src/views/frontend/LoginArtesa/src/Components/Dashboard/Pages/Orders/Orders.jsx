import React, { useState, useContext } from 'react';
import CreateOrder from './CreateOrderForm';
import OrderList from './OrderList';
import AuthContext from '../../../../context/AuthContext';

const Orders = () => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('new');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  
  const handleOrderCreated = () => {
    setActiveTab('list');
    setNotification({
      show: true,
      message: 'Tu orden ha sido creada exitosamente',
      type: 'success'
    });
    
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };
  
  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md">
          <p>Debes iniciar sesión para acceder a tus órdenes.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestión de Órdenes</h1>
      
      {notification.show && (
        <div className={`mb-4 p-4 rounded-md ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('new')}
              className={`${
                activeTab === 'new'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
            >
              Nueva Orden
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`${
                activeTab === 'list'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
            >
              Mis Órdenes
            </button>
          </nav>
        </div>
      </div>
      
      <div className="mt-6">
        {activeTab === 'new' ? (
          <CreateOrder 
            userId={user.id} 
            onOrderCreated={handleOrderCreated} 
          />
        ) : (
          <OrderList userId={user.id} />
        )}
      </div>
    </div>
  );
};

export default Orders;