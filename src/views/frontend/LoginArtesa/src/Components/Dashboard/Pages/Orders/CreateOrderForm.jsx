import React, { useState, useEffect } from 'react';
import { orderService } from '../../../../services/orderService';
import API from '../../../../api/config';

const CreateOrderForm = ({ userId, onOrderCreated }) => {
  const [products, setProducts] = useState([]);
  const [orderDetails, setOrderDetails] = useState([
    { product_id: '', quantity: 1, unit_price: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [productData, setProductData] = useState({}); // Para almacenar los datos completos

  // Cargar productos disponibles
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await API.get('/products');
        console.log('Productos recibidos de la API:', response.data.data);
        
        // Transformamos los productos para crear un mapa para acceso rápido
        const productsMap = {};
        const productsArray = response.data.data || [];
        
        productsArray.forEach(product => {
          productsMap[product.id || product.product_id] = product;
        });
        
        setProductData(productsMap);
        setProducts(productsArray);
      } catch (error) {
        console.error('Error fetching products:', error);
        // Datos de ejemplo solo en caso de error
        setProducts([
          { id: 1, name: 'Producto 1', priceList1: 25.99 },
          { id: 2, name: 'Producto 2', priceList1: 15.50 },
          { id: 3, name: 'Producto 3', priceList1: 39.99 }
        ]);
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
      showNotification('Debe haber al menos un producto en la orden', 'warning');
    }
  };

  const handleProductChange = (index, field, value) => {
    const newDetails = [...orderDetails];
    newDetails[index][field] = value;
    
    if (field === 'product_id' && value) {
      // Buscar el producto por ID
      const productId = parseInt(value);
      const selectedProduct = productData[productId] || 
                             products.find(p => p.id === productId || p.product_id === productId);
      
      if (selectedProduct) {
        // Obtener el precio usando la función auxiliar
        const price = getProductPrice(selectedProduct);
        
        console.log("Producto seleccionado:", selectedProduct);
        console.log("Precio obtenido:", price);
        
        newDetails[index].unit_price = price;
      } else {
        console.warn(`Producto con ID ${productId} no encontrado`);
        newDetails[index].unit_price = 0;
      }
    }
    
    setOrderDetails(newDetails);
  };

  const calculateTotal = () => {
    return orderDetails.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return total + (quantity * unitPrice);
    }, 0).toFixed(2);
  };

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación mejorada
    const invalidItems = orderDetails.filter(detail => 
      !detail.product_id || 
      detail.quantity <= 0 || 
      detail.unit_price <= 0
    );
    
    if (invalidItems.length > 0) {
      showNotification('Por favor completa todos los campos correctamente. Asegúrate de que los productos tengan precios válidos.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const orderData = {
        user_id: userId,
        total_amount: parseFloat(calculateTotal()),
        details: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id || 0),
          quantity: parseInt(detail.quantity || 0),
          unit_price: parseFloat(detail.unit_price || 0)
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
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4" style={{ color: '#687e8d' }}>Crear Nueva Orden</h2>
      
      {notification.show && (
        <div className={`mb-4 p-3 rounded ${
          notification.type === 'error' ? 'bg-red-100 text-red-700' : 
          notification.type === 'success' ? 'bg-green-100 text-green-700' : 
          'bg-yellow-100 text-yellow-700'
        }`}>
          {notification.message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          {orderDetails.map((detail, index) => (
            <div key={index} className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg">
              <div className="flex-grow">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Producto
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  style={{ borderColor: '#f6db8e' }}
                  value={detail.product_id}
                  onChange={(e) => handleProductChange(index, 'product_id', e.target.value)}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {products.map(product => (
                    <option key={product.id || product.product_id} value={product.id || product.product_id}>
                      {product.name} - ${getProductPrice(product).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="w-24">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full border rounded-md px-3 py-2"
                  style={{ borderColor: '#f6db8e' }}
                  value={detail.quantity}
                  onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                  required
                />
              </div>
              
              <div className="w-28">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio
                </label>
                <div className="border rounded-md px-3 py-2 bg-gray-50">
                  ${(detail.unit_price || 0).toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-end">
                <button
                  type="button"
                  className="text-white p-2 rounded hover:opacity-90"
                  style={{ backgroundColor: '#f6754e' }}
                  onClick={() => handleRemoveProduct(index)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
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
        
        <div className="flex justify-center">
          <button
            type="submit"
            className="text-white px-6 py-2 rounded-lg hover:opacity-90 w-full md:w-auto"
            style={{ backgroundColor: '#f6754e' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Procesando...' : 'Crear Orden'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateOrderForm;
