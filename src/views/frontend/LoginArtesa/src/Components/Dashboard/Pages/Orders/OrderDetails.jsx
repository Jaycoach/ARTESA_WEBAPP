import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { orderService } from '../../../../services/orderService';
import { useAuth } from '../../../../hooks/useAuth';
import OrderStatusBadge from './OrderStatusBadge';
import { FaFileDownload, FaFileImage, FaFilePdf, FaFile, FaEdit, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

const OrderDetails = () => {
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editRestriction, setEditRestriction] = useState('');
  const [siteSettings, setSiteSettings] = useState({ orderTimeLimit: '18:00' });
  const navigate = useNavigate();

  // Obtener configuración del sitio al cargar
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await orderService.getSiteSettings();
        if (result.success) {
          setSiteSettings(result.data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId || orderId === 'undefined') {
        setError('ID de pedido no proporcionado o inválido');
        setIsLoading(false);
        return;
      }
      
      if (!user || !user.id) {
        setError('Usuario no identificado');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        if (!orderId || orderId === 'undefined') {
          throw new Error('ID de pedido inválido');
        }

        const result = await orderService.getOrderById(orderId);
        
        if (result && result.success) {
          setOrder(result.data);
          
          // Verificar si el pedido pertenece al usuario actual
          if (result.data.user_id === user.id) {
            // Verificar si el pedido puede ser editado
            const editCheck = await orderService.canEditOrder(
              orderId, 
              siteSettings.orderTimeLimit
            );
            
            setCanEdit(editCheck.canEdit);
            if (!editCheck.canEdit) {
              setEditRestriction(editCheck.reason);
            }
          }
        } else {
          throw new Error('No se pudo obtener los detalles del pedido');
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError(err.message || 'Error al cargar los detalles del pedido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, user, siteSettings.orderTimeLimit]);

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

  // Función para mostrar el tipo de archivo:
  const getFileIcon = (fileType) => {
    if (!fileType) return <FaFile />;
    
    if (fileType.startsWith('image/')) {
      return <FaFileImage className="text-blue-500" />;
    } else if (fileType === 'application/pdf') {
      return <FaFilePdf className="text-red-500" />;
    } else {
      return <FaFile className="text-gray-500" />;
    }
  };

  // Mostrar un spinner mientras se cargan los datos
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar mensaje de error si hay algún problema
  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <button 
            onClick={() => navigate('/dashboard/orders')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Volver a pedidos
          </button>
        </div>
      </div>
    );
  }

  // Mostrar mensaje si no se encuentra el pedido
  if (!order) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert">
          <p className="font-medium">Pedido no encontrado</p>
          <p>No se encontró el pedido solicitado.</p>
          <button 
            onClick={() => navigate('/dashboard/orders')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            Volver a pedidos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => navigate('/dashboard/orders')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a pedidos
          </button>
          
          <div className="flex space-x-4">
            {canEdit ? (
              <button
                onClick={() => navigate(`/dashboard/orders/${orderId}/edit`)}
                className="flex items-center text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md"
              >
                <FaEdit className="mr-2" />
                Editar pedido
              </button>
            ) : (
              order.user_id === user.id && editRestriction && (
                <div className="flex items-center text-gray-500 bg-gray-100 px-3 py-2 rounded-md" title={editRestriction}>
                  <FaExclamationTriangle className="mr-2 text-yellow-500" />
                  No se puede editar
                </div>
              )
            )}
            
            <button
              onClick={() => window.print()}
              className="flex items-center text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir
            </button>
          </div>
        </div>
        
        <div className="border-b pb-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pedido #{order.order_id}</h1>
          <div className="flex flex-wrap gap-y-2 items-center">
            <span className="text-gray-500 mr-4">
              Fecha: <span className="font-medium text-gray-700">{formatDate(order.order_date)}</span>
            </span>
            <span className="text-gray-500 mr-4">
              Cliente: <span className="font-medium text-gray-700">{order.user_name || user.nombre || user.name || user.email || 'Cliente'}</span>
            </span>
            <span className="flex items-center">
              Estado: <span className="ml-2"><OrderStatusBadge status={order.status || 'pendiente'} size="lg" /></span>
            </span>
          </div>
        </div>
        
        {/* Detalles de productos en el pedido */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Productos</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Unitario
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.details && order.details.length > 0 ? (
                  order.details.map((item, index) => (
                    <tr key={item.order_detail_id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-normal">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product_name || `Producto ID: ${item.product_id}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        ${parseFloat(item.unit_price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                      No hay productos en este pedido
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan="3" className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    Total:
                  </td>
                  <td className="px-6 py-4 text-right text-lg font-bold text-gray-900">
                    ${parseFloat(order.total_amount).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        
        {/* Información adicional */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Información adicional</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Fecha de entrega</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {order.delivery_date 
                    ? new Date(order.delivery_date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) 
                    : 'No especificada'}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Método de pago</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.payment_method || 'No especificado'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Método de envío</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.shipping_method || 'No especificado'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Dirección de envío</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.shipping_address || 'No especificada'}</dd>
              </div>
              {order.file_url && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Archivo adjunto</dt>
                  <dd className="mt-2">
                    <a 
                      href={order.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {getFileIcon(order.file_type)}
                      <span className="ml-2">Descargar archivo</span>
                      <FaFileDownload className="ml-2" />
                    </a>
                  </dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Notas</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {order.notes 
                    ? <p className="whitespace-pre-line">{order.notes}</p>
                    : 'Sin notas adicionales'
                  }
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Mostrar ayuda para edición si es necesario */}
        {!canEdit && order.user_id === user.id && (
          <div className="mt-6 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <FaExclamationTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Información sobre edición de pedidos</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    {editRestriction || `No se puede editar este pedido después de las ${siteSettings.orderTimeLimit}.`}
                    <br />
                    Si necesitas modificar tu pedido, contacta con soporte.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetails;