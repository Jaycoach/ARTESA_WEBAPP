import React, { useState, useEffect } from 'react';
import { orderService } from '../../../../services/orderService';
import API from '../../../../api/config';

const CreateOrderForm = ({ userId, onOrderCreated }) => {
  const [products, setProducts] = useState([]);
  const [orderDetails, setOrderDetails] = useState([{ product_id: '', quantity: 1, unit_price: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Cargar productos disponibles
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Reemplaza esto con tu endpoint real de productos
        const response = await API.get('/products');
        setProducts(response.data.data || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        // Si no hay acceso a la API real, usar datos de ejemplo
        setProducts([
          { id: 1, name: 'Producto 1', price: 25.99 },
          { id: 2, name: 'Producto 2', price: 15.50 },
          { id: 3, name: 'Producto 3', price: 39.99 }
        ]);
      }
    };

    fetchProducts();
  }, []);

  const handleAddProduct = () => {
    setOrderDetails([...orderDetails, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveProduct = (index) => {
    const newDetails = [...orderDetails];
    newDetails.splice(index, 1);
    setOrderDetails(newDetails);
  };

  const handleProductChange = (index, field, value) => {
    const newDetails = [...orderDetails];
    newDetails[index][field] = value;
    
    if (field === 'product_id') {
      const selectedProduct = products.find(p => p.id === parseInt(value));
      if (selectedProduct) {
        newDetails[index].unit_price = selectedProduct.price;
      }
    }
    
    setOrderDetails(newDetails);
  };

  const calculateTotal = () => {
    return orderDetails.reduce((total, item) => {
      return total + (item.quantity * item.unit_price);
    }, 0).toFixed(2);
  };

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación
    const isValid = orderDetails.every(detail => 
      detail.product_id && detail.quantity > 0 && detail.unit_price > 0
    );
    
    if (!isValid) {
      showNotification('Por favor completa todos los campos correctamente', 'error');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const orderData = {
        user_id: userId,
        total_amount: parseFloat(calculateTotal()),
        details: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id),
          quantity: parseInt(detail.quantity),
          unit_price: parseFloat(detail.unit_price)
        }))
      };
      
      const result = await orderService.createOrder(orderData);
      
      showNotification(`Orden creada exitosamente`, 'success');
      
      // Resetear formulario
      setOrderDetails([{ product_id: '', quantity: 1, unit_price: 0 }]);
      
      // Notificar al componente padre
      if (onOrderCreated) onOrderCreated(result.data);
      
    } catch (error) {
      showNotification(error.message || 'Ocurrió un error al procesar tu orden', 'error');
      console.error('Order creation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">Crear Nueva Orden</h2>
        
        {notification.show && (
          <div className={`p-4 mb-4 rounded-md ${
            notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {notification.message}
          </div>
        )}
        
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
                        <option key={product.id} value={product.id}>
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
                    ${detail.unit_price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${(detail.quantity * detail.unit_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {orderDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
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
        
        <button 
          type="submit" 
          className={`w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex justify-center items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creando...
            </span>
          ) : 'Crear Orden'}
        </button>
      </form>
    </div>
  );
};

export default CreateOrderForm;