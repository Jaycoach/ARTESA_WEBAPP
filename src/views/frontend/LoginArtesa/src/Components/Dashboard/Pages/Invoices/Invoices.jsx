import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import InvoiceList from './InvoiceList';
import InvoiceDetail from './InvoiceDetail';
import Notification from '../../../../Components/ui/Notification';

const Invoices = () => {
  const { user, isAuthenticated } = useAuth();
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState('list');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  // Determinar si estamos en vista detallada
  const isDetailView = location.pathname.includes('/invoices/detail/');

  useEffect(() => {
    if (isDetailView) {
      setActiveView('detail');
    } else {
      setActiveView('list');
    }
  }, [location.pathname, isDetailView]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso restringido</h2>
        <p className="mb-4">Debes iniciar sesión para acceder a tus facturas.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}
      
      {activeView === 'list' && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Mis Facturas</h1>
            
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <h2 className="text-lg font-semibold mb-3">Filtrar por estado</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleFilterChange('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    selectedFilter === 'all' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => handleFilterChange('active')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    selectedFilter === 'active' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Activas
                </button>
                <button
                  onClick={() => handleFilterChange('pending')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    selectedFilter === 'pending' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Pendientes por pagar
                </button>
                <button
                  onClick={() => handleFilterChange('overdue')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    selectedFilter === 'overdue' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Vencidas
                </button>
                <button
                  onClick={() => handleFilterChange('closed')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    selectedFilter === 'closed' 
                      ? 'bg-gray-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cerradas/Canceladas
                </button>
              </div>
            </div>
          </div>
          
          <InvoiceList filterStatus={selectedFilter} />
        </>
      )}
      
      {activeView === 'detail' && invoiceId && (
        <InvoiceDetail 
          invoiceId={invoiceId} 
          onBack={() => navigate('/dashboard/invoices')}
          onDownloadSuccess={() => showNotification('Factura descargada exitosamente', 'success')}
        />
      )}
    </div>
  );
};

export default Invoices;