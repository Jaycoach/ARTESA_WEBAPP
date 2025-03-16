import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { orderService } from '../../../../services/orderService';
import API from '../../../../api/config';
import DeliveryDatePicker from './DeliveryDatePicker';
import OrderFileUpload from './OrderFileUpload';
import { FaExclamationTriangle } from 'react-icons/fa';
import Notification from '../../../../Components/ui/Notification';

const EditOrderForm = ({ orderId, onOrderUpdated }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [orderDetails, setOrderDetails] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderFile, setOrderFile] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState({ orderTimeLimit: '18:00' });
  const [canEdit, setCanEdit] = useState(true);
  const [editNotAllowedReason, setEditNotAllowedReason] = useState('');
  const { orderId } = useParams();

  // Cargar configuración del sitio
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await API.get('/admin/settings');
        if (response.data && response.data.success) {
          setSiteSettings(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching site settings:', error);
      }
    };

    fetchSettings();
  }, []);

  // Cargar el pedido actual
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) {
        showNotification('ID de pedido no proporcionado', 'error');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Agrega logs para depuración
        console.log('Intentando obtener orden con ID:', orderId);

        // Obtener detalles del pedido
        const result = await orderService.getOrderById(orderId);

        useEffect(() => {
          if (order && order.details && order.details.length > 0) {
            // Transformar los detalles del pedido para la edición
            setOrderDetails(order.details.map(detail => ({
              product_id: detail.product_id.toString(),
              quantity: detail.quantity,
              unit_price: detail.unit_price,
              name: detail.product_name // Añadir el nombre del producto
            })));
          }
        }, [order]);
        
        if (result && result.success) {
          const orderData = result.data;
          setOrder(orderData);
          
          // Verificar si el pedido pertenece al usuario actual
          if (orderData.user_id !== user.id) {
            setCanEdit(false);
            setEditNotAllowedReason('No tienes permiso para editar este pedido');
            return;
          }
          
          // Verificar si el pedido puede ser editado según su estado
          if (['completado', 'completed', 'entregado', 'delivered', 'cancelado', 'canceled'].includes(
            orderData.status?.toLowerCase()
          )) {
            setCanEdit(false);
            setEditNotAllowedReason(`No se puede editar un pedido con estado: ${orderData.status}`);
            return;
          }
          
          // Verificar la hora límite para edición
          const orderDate = new Date(orderData.order_date);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
          
          // Si el pedido es de un día anterior, verificar la hora límite
          if (orderDay.getTime() < today.getTime()) {
            const [limitHours, limitMinutes] = siteSettings.orderTimeLimit.split(':').map(Number);
            const limitTime = new Date();
            limitTime.setHours(limitHours, limitMinutes, 0, 0);
            
            if (now > limitTime) {
              setCanEdit(false);
              setEditNotAllowedReason(`No se puede editar después de las ${siteSettings.orderTimeLimit}`);
              return;
            }
          }
          
          // Establecer los datos del formulario
          setDeliveryDate(orderData.delivery_date?.split('T')[0] || '');
          setOrderNotes(orderData.notes || '');
          
          // Establecer los detalles del pedido
          if (orderData.details && orderData.details.length > 0) {
            setOrderDetails(orderData.details.map(detail => ({
              product_id: detail.product_id.toString(),
              quantity: detail.quantity,
              unit_price: detail.unit_price
            })));
          } else {
            setOrderDetails([{ product_id: '', quantity: 1, unit_price: 0 }]);
          }
        } else {
          throw new Error('No se pudo obtener los detalles del pedido');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        showNotification(error.message || 'Error al cargar los detalles del pedido', 'error');
        setCanEdit(false);
        setEditNotAllowedReason('Error al cargar los detalles del pedido');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, user, siteSettings.orderTimeLimit]);

  // Cargar productos disponibles
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await API.get('/products');
        if (response.data.success) {
          setProducts(response.data.data || []);
        } else {
          showNotification('No se pudieron cargar los productos', 'error');
          // Datos de ejemplo como fallback
          setProducts([
            { product_id: 1, name: 'Pan Blanco', price_list1: 25.99 },
            { product_id: 2, name: 'Croissant', price_list1: 15.50 },
            { product_id: 3, name: 'Pan Integral', price_list1: 39.99 }
          ]);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        showNotification('Error al cargar productos', 'error');
        // Datos de ejemplo como fallback
        setProducts([
          { product_id: 1, name: 'Pan Blanco', price_list1: 25.99 },
          { product_id: 2, name: 'Croissant', price_list1: 15.50 },
          { product_id: 3, name: 'Pan Integral', price_list1: 39.99 }
        ]);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    // Actualizar los precios unitarios en los detalles del pedido según los productos disponibles
    if (products.length > 0 && orderDetails.length > 0) {
      const updatedDetails = orderDetails.map(detail => {
        const product = products.find(p => p.product_id.toString() === detail.product_id);
        if (product) {
          return {
            ...detail,
            unit_price: product.price_list1,
            name: product.name
          };
        }
        return detail;
      });
      setOrderDetails(updatedDetails);
    }
  }, [products, orderDetails.length]);

  const handleAddProduct = () => {
    setOrderDetails([...orderDetails, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveProduct = (index) => {
    if (orderDetails.length > 1) {
      const newDetails = [...orderDetails];
      newDetails.splice(index, 1);
      setOrderDetails(newDetails);
    } else {
      showNotification('No se puede eliminar el único producto del pedido', 'warning');
    }
  };

  const handleProductChange = (index, field, value) => {
    const newDetails = [...orderDetails];
    
    if (field === 'product_id') {
      const selectedProduct = products.find(p => p.product_id === parseInt(value));
      if (selectedProduct) {
        newDetails[index] = {
          ...newDetails[index],
          product_id: value,
          unit_price: selectedProduct.price_list1,
          name: selectedProduct.name
        };
      } else {
        newDetails[index] = {
          ...newDetails[index],
          product_id: value
        };
      }
    } else {
      newDetails[index] = {
        ...newDetails[index],
        [field]: value
      };
    }
    
    setOrderDetails(newDetails);
  };

  const calculateTotal = () => {
    return orderDetails.reduce((total, item) => {
      const itemTotal = item.quantity * item.unit_price;
      return total + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0).toFixed(2);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canEdit) {
      showNotification(editNotAllowedReason, 'error');
      return;
    }
    
    // Validaciones
    if (!user || !user.id) {
      showNotification('Debes iniciar sesión para actualizar un pedido', 'error');
      return;
    }
    
    // Validar productos y cantidades
    const isValid = orderDetails.every(detail => 
      detail.product_id && detail.quantity > 0 && detail.unit_price > 0
    );
    
    if (!isValid) {
      showNotification('Por favor completa todos los campos correctamente', 'error');
      return;
    }
    
    // Validar fecha de entrega
    if (!deliveryDate) {
      showNotification('Selecciona una fecha de entrega válida', 'error');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Calcular total
      const totalAmount = parseFloat(calculateTotal());
      
      // Preparar datos para la API
      const orderData = {
        user_id: user.id,
        total_amount: parseFloat(calculateTotal()),
        delivery_date: deliveryDate,
        notes: orderNotes,
        details: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id),
          quantity: parseInt(detail.quantity),
          unit_price: parseFloat(detail.unit_price)
        }))
      };
      
      // Si hay un archivo adjunto, crear FormData para envío multipart
      let formData = null;
      if (orderFile) {
        formData = new FormData();
        
        // Agregar el archivo
        formData.append('orderFile', orderFile);
        
        // Agregar los demás datos como JSON
        formData.append('orderData', JSON.stringify(orderData));
      }
      
      console.log('Actualizando pedido:', orderData);
      
      // Enviar a la API (usando formData si hay archivo)
      const result = await orderService.updateOrder(
        orderId, 
        formData || orderData, 
        !!formData
      );
      
      if (result.success) {
        showNotification('Pedido actualizado exitosamente', 'success');
        
        // Notificar al componente padre
        if (onOrderUpdated) onOrderUpdated(result.data);
        
        // Redireccionar después de 2 segundos
        setTimeout(() => {
          navigate(`/dashboard/orders/${orderId}`);
        }, 2000);
      } else {
        throw new Error(result.message || 'Error al actualizar el pedido');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      showNotification(error.message || 'Ocurrió un error al actualizar tu pedido', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si están cargando los datos, mostrar indicador
  if (loading) {
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Si no se puede editar, mostrar mensaje
  if (!canEdit) {
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert">
          <p className="font-medium">Edición no permitida</p>
          <p>{editNotAllowedReason}</p>
          <button 
            onClick={() => navigate(`/dashboard/orders/${orderId}`)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            Volver a detalles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Editar Pedido #{orderId}</h2>
          <button 
            type="button"
            onClick={() => navigate(`/dashboard/orders/${orderId}`)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
        
        {notification.show && (
          <Notification 
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification({ show: false, message: '', type: '' })}
          />
        )}
        {/* Agregar esto después del encabezado */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaExclamationTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                <span className="font-medium">Recuerda: </span> 
                Solo puedes editar este pedido hasta las {siteSettings.orderTimeLimit} del día siguiente a su creación.
                {order && (
                  <span>
                    {' '}El pedido fue creado el {new Date(order.order_date).toLocaleDateString('es-ES')}.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        {/* Sección de Fecha de Entrega */}
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Fecha de Entrega</h3>
          <p className="text-sm text-gray-600 mb-3">
            Selecciona la fecha en que necesitas recibir tu pedido.
            <br/>
            <span className="font-medium text-amber-700">
              Importante: Solo podrás editar este pedido hasta las {siteSettings.orderTimeLimit} del {
                (() => {
                  const orderDate = order ? new Date(order.order_date) : new Date();
                  const nextDay = new Date(orderDate);
                  nextDay.setDate(orderDate.getDate() + 1);
                  return nextDay.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                })()
              }.
            </span>
          </p>
          
          <DeliveryDatePicker 
            value={deliveryDate}
            onChange={setDeliveryDate}
            orderTimeLimit={siteSettings.orderTimeLimit}
          />
        </div>
        
        {/* Productos */}
        <div className="overflow-x-auto">
          {/* En la sección de productos del formulario */}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orderDetails.map((detail, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select 
                      value={detail.product_id} 
                      onChange={(e) => handleProductChange(index, 'product_id', e.target.value)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="">Seleccionar producto</option>
                      {products.map(product => (
                        <option 
                          key={product.product_id} 
                          value={product.product_id}
                          disabled={orderDetails.some(
                            item => item !== detail && item.product_id === product.product_id.toString()
                          )}
                        >
                          {product.name} {product.stock > 0 ? `(${product.stock} disponibles)` : '(Agotado)'}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input 
                      type="number" 
                      min="1" 
                      value={detail.quantity} 
                      onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${parseFloat(detail.unit_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${(detail.quantity * detail.unit_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(index)}
                      className="text-red-600 hover:text-red-800"
                      disabled={orderDetails.length <= 1}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-between items-center">
          <button 
            type="button" 
            onClick={handleAddProduct}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Producto
          </button>
          
          <div className="text-xl font-bold">
            Total: ${calculateTotal()}
          </div>
        </div>
        
        {/* Notas y Adjuntos */}
        <div className="space-y-4 mt-6 border-t pt-6">
          <div>
            <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas adicionales
            </label>
            <textarea
              id="orderNotes"
              rows="3"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Instrucciones especiales, detalles de entrega, etc."
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo adjunto (opcional)
            </label>
            <OrderFileUpload
              value={orderFile}
              onChange={setOrderFile}
            />
            {order && order.file_url && !orderFile && (
              <div className="mt-2 text-sm text-gray-500">
                Ya hay un archivo adjunto. Subir uno nuevo reemplazará el anterior.
              </div>
            )}
          </div>
        </div>
        
        <button 
          type="submit" 
          className={`w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex justify-center items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Actualizando...
            </span>
          ) : 'Actualizar Pedido'}
        </button>
      </form>
    </div>
  );
};

export default EditOrderForm;