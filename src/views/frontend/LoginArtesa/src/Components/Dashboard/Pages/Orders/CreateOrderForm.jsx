import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { orderService } from '../../../../services/orderService';
import API from '../../../../api/config';
import DeliveryDatePicker from './DeliveryDatePicker';
import OrderFileUpload from './OrderFileUpload';
import Notification from '../../../../Components/ui/Notification';
import { useNavigate } from 'react-router-dom';

const CreateOrderForm = ({ onOrderCreated }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [orderDetails, setOrderDetails] = useState([{ product_id: '', quantity: 1, unit_price: 0 }]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderFile, setOrderFile] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [siteSettings, setSiteSettings] = useState({ orderTimeLimit: '18:00' });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const navigate = useNavigate();

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
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, []);

  // Cargar productos disponibles
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
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
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  // Función para obtener el precio de un producto según su estructura
  const getProductPrice = (product) => {
    if (!product) return 0;
    
    // Intentar obtener el precio desde diferentes propiedades posibles
    return product.price || 
           product.priceList1 || 
           product.price_list1 || 
           0;
  };

  // Formatear precio para visualización
  const formatProductName = (product) => {
    const price = getProductPrice(product);
    return `${product.name} - $${price.toFixed(2)}`;
  };

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
    newDetails[index][field] = value;
    
    if (field === 'product_id') {
      const selectedProduct = products.find(p => p.product_id === parseInt(value));
      if (selectedProduct) {
        // Usar price_list1 como precio unitario
        newDetails[index].unit_price = selectedProduct.price_list1;
      }
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
    
    // Validaciones de usuario
    if (!user) {
      showNotification('Debes iniciar sesión para crear un pedido', 'error');
      return;
    }

    if (!user.id) {
      showNotification('No se puede identificar tu usuario. Por favor, cierra sesión y vuelve a ingresar', 'error');
      console.error('Error: user.id no disponible', user);
      return;
    }
    
    // Validar productos y cantidades
    const isValid = orderDetails.every(detail => 
      detail.product_id && detail.quantity > 0 && detail.unit_price > 0
    );
    
    if (!isValid) {
      showNotification('Por favor completa todos los campos correctamente. Asegúrate de que los productos tengan precios válidos.', 'error');
      return;
    }
    
    // Validar fecha de entrega
    if (!deliveryDate) {
      showNotification('Selecciona una fecha de entrega válida', 'error');
      return;
    }
    
    // Mostrar modal de confirmación en lugar de crear pedido inmediatamente
    setShowConfirmationModal(true);
  };

  const handleConfirmCreateOrder = async () => {
    try {
      setIsSubmitting(true);
      setShowConfirmationModal(false);
      
      // Calcular total
      const totalAmount = parseFloat(calculateTotal());
      
      // Validar que tenemos ID de usuario y usuario activo
      if (!user || !user.id) {
        showNotification('Error: No se pudo identificar el ID de usuario', 'error');
        console.error('Error: ID de usuario no disponible al crear orden', user);
        setIsSubmitting(false);
        return;
      }

      if (user.is_active === false) {
        showNotification('Tu usuario no está activo. No puedes crear pedidos', 'error');
        setIsSubmitting(false);
        return;
      }

      // Preparar datos para la API
      const orderData = {
        user_id: user.id,
        total_amount: totalAmount,
        delivery_date: deliveryDate,
        notes: orderNotes,
        details: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id || 0),
          quantity: parseInt(detail.quantity || 0),
          unit_price: parseFloat(detail.unit_price || 0)
        }))
      };

      console.log('Datos de orden a enviar:', {
        userId: user.id,
        userActive: user.is_active,
        orderData: orderData
      });
      
      // Si hay un archivo adjunto, crear FormData para envío multipart
      let formData = null;
      if (orderFile) {
        formData = new FormData();
        
        // Agregar el archivo
        formData.append('orderFile', orderFile);
        
        // Agregar el ID de usuario explícitamente
        formData.append('user_id', user.id.toString());
        
        // Agregar los demás datos como JSON
        formData.append('orderData', JSON.stringify(orderData));
      }
      
      console.log('Enviando pedido:', orderData);
      
      // Enviar a la API (usando formData si hay archivo)
      let result;
      if (formData) {
        // Si usamos formData, asegúrate de que el ID de usuario está incluido
        result = await orderService.createOrder(formData, true);
      } else {
        // Si enviamos JSON, asegúrate de que el ID de usuario está incluido
        const orderWithUserId = {
          ...orderData,
          user_id: user.id // Garantizar que user_id siempre está presente
        };
        result = await orderService.createOrder(orderWithUserId, false);
      }
      
      if (result.success) {
        showNotification('Pedido creado exitosamente', 'success');
        
        // Resetear formulario
        setOrderDetails([{ product_id: '', quantity: 1, unit_price: 0 }]);
        setDeliveryDate('');
        setOrderFile(null);
        setOrderNotes('');
        
        // Notificar al componente padre
        if (onOrderCreated) onOrderCreated(result.data);
      } else {
        throw new Error(result.message || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      showNotification(error.message || 'Ocurrió un error al procesar tu pedido', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
  };

  const handleCancelClick = () => {
    setShowCancelConfirmation(true);
  };
  
  const handleConfirmCancel = () => {
    // Redirigir a la página de pedidos
    navigate('/dashboard/orders');
  };
  
  const handleCancelConfirmationClose = () => {
    setShowCancelConfirmation(false);
  };

  // Si están cargando los productos o configuraciones, mostrar indicador
  if (loadingProducts || loadingSettings) {
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">Crear Nuevo Pedido</h2>
        
        {notification.show && (
          <Notification 
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification({ show: false, message: '', type: '' })}
          />
        )}
        
        {/* Sección de Fecha de Entrega */}
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Fecha de Entrega</h3>
          <p className="text-sm text-gray-600 mb-3">
            Selecciona la fecha en que necesitas recibir tu pedido.
            <br/>
            Pedidos realizados después de las {siteSettings.orderTimeLimit} requieren al menos 2 días para entrega.
          </p>
          
          <DeliveryDatePicker 
            value={deliveryDate}
            onChange={setDeliveryDate}
            orderTimeLimit={siteSettings.orderTimeLimit}
          />
        </div>
        
        {/* Productos */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio Unitario
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subtotal
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
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
                        >
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input 
                      type="number" 
                      min="1" 
                      value={detail.quantity} 
                      onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
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
        
        <div className="flex justify-between items-center mb-6">
          <button
            type="button"
            className="text-white px-4 py-2 rounded hover:opacity-90"
            style={{ backgroundColor: '#687e8d' }}
            onClick={handleAddProduct}
          >
            + Agregar Producto
          </button>
          
          <div className="text-xl font-bold" style={{ color: '#2c3e50' }}>
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
          </div>
        </div>
        
        <div className="flex gap-4">
          <button 
            type="button" 
            className="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            onClick={handleCancelClick}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className={`flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex justify-center items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </span>
            ) : 'Crear Pedido'}
          </button>
        </div>
      </form>
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
      {/* Modal de confirmación para crear pedido */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar pedido</h3>
            <p className="text-gray-500 mb-2">¿Estás seguro de que deseas crear este pedido?</p>
            <p className="text-gray-700 font-medium mb-4">Total: ${calculateTotal()}</p>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                onClick={handleCloseConfirmationModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                onClick={handleConfirmCreateOrder}
              >
                Confirmar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateOrderForm;
