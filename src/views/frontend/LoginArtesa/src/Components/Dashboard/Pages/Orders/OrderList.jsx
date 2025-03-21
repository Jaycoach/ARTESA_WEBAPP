import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { orderService } from '../../../../services/orderService';
import { useAuth } from '../../../../hooks/useAuth';
import OrderStatusBadge from './OrderStatusBadge';
import { FaEdit, FaEye, FaExclamationTriangle, FaTrashAlt } from 'react-icons/fa';
import API from '../../../../api/config';

const OrderList = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [orderTimeLimit, setOrderTimeLimit] = useState(null);
  const [editableOrders, setEditableOrders] = useState({});
  const ordersPerPage = 10;
  const [orderStatuses, setOrderStatuses] = useState({});

  // Cargar configuración de horario límite
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Obtener los estados de pedidos
        const statusResponse = await API.get('/orders/statuses');
        if (statusResponse.data.success) {
          // Convertir el array a un objeto para fácil acceso por ID
          const statusMap = {};
          statusResponse.data.data.forEach(status => {
            statusMap[status.status_id] = status.name;
          });
          setOrderStatuses(statusMap);
        }
        
        // Obtener la configuración del sitio (orderTimeLimit)
        const siteConfigResponse = await API.get('/admin/settings');
        if (siteConfigResponse.data && siteConfigResponse.data.success) {
          setOrderTimeLimit(siteConfigResponse.data.data.orderTimeLimit || '18:00');
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!user || !user.id) {
      setError('Usuario no identificado');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await orderService.getUserOrders(user.id);
      // Filtrar órdenes con status_id 6 (Cancelado/Cerrado)
      const filteredOrders = data.filter(order => 
        order.status_id !== 6 && 
        order.status_id !== '6' &&
        !['cancelado', 'canceled', 'cerrado'].includes(order.status?.toLowerCase())
      );
      setOrders(filteredOrders);

      // Comprobar cuáles pedidos pueden ser editados
      const editableOrdersMap = {};
      for (const order of data) {
        const editCheck = await orderService.canEditOrder(order.order_id, orderTimeLimit);
        editableOrdersMap[order.order_id] = editCheck.canEdit;
      }
      setEditableOrders(editableOrdersMap);
      
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Error al cargar los pedidos');
    } finally {
      setIsLoading(false);
    }
  }, [user, orderTimeLimit]);

  // Usar la función definida en el useEffect
  useEffect(() => {
    fetchOrders();
  }, [user, orderTimeLimit]); // Incluye fetchOrders en el array de dependencias

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('¿Estás seguro que deseas cancelar este pedido?')) {
      return;
    }
    
    try {
      // Corrección: Usar el método PUT y la ruta completa con /api
      const response = await API.put(`/orders/${orderId}/cancel`);
      if (response.data.success) {
        // Ahora fetchOrders está disponible aquí
        fetchOrders();
      } else {
        alert('Error al cancelar el pedido: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error cancelando orden:', error);
      alert('Error al cancelar el pedido');
    }
  };

    // Función para formatear la fecha
    const formatDate = (dateString) => {
      if (!dateString) return 'Fecha no disponible';
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      
      return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    };

  // Calcular el índice del último y primer pedido de la página actual
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  // Obtener los pedidos de la página actual
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);

  // Cambiar de página
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Si están cargando los pedidos, mostrar indicador
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Si hay un error, mostrar mensaje
  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
        <p className="font-medium">Error al cargar los pedidos</p>
        <p>{error}</p>
      </div>
    );
  }

  // Si no hay pedidos, mostrar mensaje
  if (orders.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <p className="text-gray-500 text-center p-6">No tienes pedidos registrados.</p>
        <div className="flex justify-center">
          <Link 
            to="/dashboard/orders/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Realizar un nuevo pedido
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Mis Pedidos</h2>
        <div className="flex items-center">
          <Link
            to="/dashboard/orders/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Nuevo Pedido
          </Link>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Productos
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentOrders.map((order) => (
              <tr key={order.order_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{order.order_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(order.order_date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.item_count || 0} productos ({order.total_items || 0} unidades)
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                  ${parseFloat(order.total_amount).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <OrderStatusBadge status={orderStatuses[order.status_id] || order.status || 'pendiente'} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                  <div className="flex justify-center space-x-2">
                  <Link 
                    to={order.order_id ? `/dashboard/orders/${order.order_id}` : '#'}
                    className={`text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md flex items-center ${!order.order_id ? 'opacity-50 pointer-events-none' : ''}`}
                    title="Ver detalles"
                    onClick={(e) => {
                      if (!order.order_id) {
                        e.preventDefault();
                        alert('ID de orden no disponible');
                      }
                    }}
                  >
                    <FaEye className="mr-1" />
                    <span className="hidden sm:inline">Ver</span>
                  </Link>
                    
                    {editableOrders[order.order_id] ? (
                      <Link 
                        to={`/dashboard/orders/${order.order_id}/edit`}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md flex items-center"
                        title="Editar pedido"
                      >
                        <FaEdit className="mr-1" />
                        <span className="hidden sm:inline">Editar</span>
                      </Link>
                    ) : (
                      <span 
                        className="text-gray-400 bg-gray-100 px-3 py-1 rounded-md flex items-center cursor-not-allowed"
                        title={`No se puede editar este pedido (${['completado', 'completed', 'entregado', 'delivered', 'cancelado', 'canceled'].includes(order.status?.toLowerCase()) || ['3', '4', '5'].includes(order.status_id?.toString()) ? 'Estado: ' + order.status : 'Fuera de horario de edición'}`}
                      >
                        <FaExclamationTriangle className="mr-1 text-yellow-500" />
                        <span className="hidden sm:inline">No editable</span>
                      </span>
                    )}

                    {/* Botón de cancelar pedido */}
                    {!['cancelado', 'canceled'].includes(order.status?.toLowerCase()) && order.status_id !== '5' && (
                      <button
                        onClick={() => handleCancelOrder(order.order_id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md flex items-center"
                        title="Cancelar pedido"
                      >
                        <FaTrashAlt className="mr-1" />
                        <span className="hidden sm:inline">Cancelar</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Paginación */}
      {orders.length > ordersPerPage && (
        <div className="flex justify-center mt-4">
          <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => paginate(currentPage > 1 ? currentPage - 1 : 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Anterior</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            {[...Array(Math.ceil(orders.length / ordersPerPage)).keys()].map(number => (
              <button
                key={number + 1}
                onClick={() => paginate(number + 1)}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                  currentPage === number + 1 
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {number + 1}
              </button>
            ))}
            
            <button
              onClick={() => paginate(currentPage < Math.ceil(orders.length / ordersPerPage) ? currentPage + 1 : currentPage)}
              disabled={currentPage === Math.ceil(orders.length / ordersPerPage)}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Siguiente</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      )}

      {/* Mensaje informativo sobre edición de pedidos */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Información sobre edición de pedidos</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Solo puedes editar pedidos en estado "Abierto" y antes de las {orderTimeLimit} dos días antes de la fecha de entrega.
                <br />
                Si necesitas modificar un pedido fuera de este tiempo, contacta con nuestro servicio de atención al cliente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderList;