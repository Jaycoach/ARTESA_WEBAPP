import React, { useState, useEffect, useCallback } from 'react';
import { FiShoppingCart, FiSearch, FiEye, FiClipboard, FiPlus, FiMinus, FiList, FiGrid, FiCheck, FiMoon, FiSun } from 'react-icons/fi';
import API from '../../../../api/config';
import Notification from '../../../../Components/ui/Notification';
import Modal from '../../../../Components/ui/Modal';
import Input from '../../../../Components/ui/Input';
import Card from '../../../../Components/ui/Card';
import Button from '../../../../Components/ui/Button';

const Products = () => {
  // Estado principal
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // Estado para manejar cantidades de cada producto
  const [productQuantities, setProductQuantities] = useState({});
  
  // Estado para la paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Estado para el pedido actual
  const [orderItems, setOrderItems] = useState([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Efecto para cargar la configuración del sitio
  const [siteSettings, setSiteSettings] = useState({ orderTimeLimit: '18:00' });
  const [darkMode, setDarkMode] = useState(false);

  // Función para mostrar notificaciones
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    // El componente Notification maneja internamente el timeout
  }, []);

  // Funciones para interactuar con la API
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/products';
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await API.get(url);
      if (response.data.success) {
        setProducts(response.data.data || []);
      } else {
        showNotification(response.data.message || 'Error al cargar productos', 'error');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      showNotification('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, showNotification]);


  // Funcionalidades de producto
  const openProductDetails = useCallback((product) => {
    setSelectedProduct(product);
    // Inicializa con la cantidad guardada o 1 por defecto
    const savedQuantity = productQuantities[product.product_id] || 1;
    setQuantity(savedQuantity);
    setModalVisible(true);
  }, [productQuantities]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setProductQuantities(prev => ({
      ...prev,
      [productId]: quantity
    }));
    console.log("Product quantities updated:", productId, quantity);
  }, []);

  const incrementQuantity = useCallback(() => {
    if (selectedProduct) {
      const currentQty = quantity || 1;
      const newQuantity = currentQty + 1;
      setQuantity(newQuantity);
      updateQuantity(selectedProduct.product_id, newQuantity);
    }
  }, [selectedProduct, quantity, updateQuantity]);

  const decrementQuantity = useCallback(() => {
    const currentQty = quantity || 1;
    if (currentQty > 1) {
      const newQuantity = currentQty - 1;
      setQuantity(newQuantity);
      if (selectedProduct) {
        updateQuantity(selectedProduct.product_id, newQuantity);
      }
    }
  }, [quantity, selectedProduct, updateQuantity]);

  // Función para agregar a pedido
  const addToOrder = useCallback((product, qty = 1) => {
    try {
      const quantityToAdd = Number(qty || productQuantities[product.product_id] || 1);
      
      const existingItemIndex = orderItems.findIndex(item => item.product_id === product.product_id);
    
      if (existingItemIndex >= 0) {
        // Si el producto ya está en el pedido, actualizamos la cantidad
        const updatedItems = [...orderItems];
        updatedItems[existingItemIndex].quantity += quantityToAdd;
        setOrderItems(updatedItems);
      } else {
        // Si es un producto nuevo, lo agregamos al pedido
        setOrderItems([...orderItems, {
          product_id: product.product_id,
          name: product.name,
          quantity: quantityToAdd,
          unit_price: product.price_list1
        }]);
      }
      
      showNotification(`${product.name} agregado al pedido`);
      if (modalVisible) closeModal();
    } catch (error) {
      console.error('Error adding to order:', error);
      showNotification('Error al agregar al pedido', 'error');
    }
  }, [orderItems, modalVisible, closeModal, showNotification, productQuantities]);

  //Manejador para actualizar cantidades
  const handleQuantityChange = useCallback((productId, newValue) => {
    // Asegurarse de que la cantidad es un número válido
    const numValue = parseInt(newValue, 10);
    // Si no es un número o es menor que 1, usar 1
    const validQuantity = !isNaN(numValue) && numValue > 0 ? numValue : 1;
    
    // Actualizar la cantidad
    setProductQuantities(prev => ({
      ...prev,
      [productId]: validQuantity
    }));
      
    // Si estamos en el modal y el producto seleccionado coincide con el productId,
    // también actualizamos el estado de quantity
    if (selectedProduct && selectedProduct.product_id === productId) {
      setQuantity(validQuantity);
    }
  }, [selectedProduct]);

  // Función auxiliar para obtener el ID del usuario actual
  const getCurrentUserId = useCallback(() => {
    return localStorage.getItem('userId') || 1; // Valor predeterminado para pruebas
  }, []);

  // Función para enviar el pedido completo a la API
  const submitOrder = useCallback(async () => {
    if (orderItems.length === 0) {
      showNotification('No hay productos en el pedido', 'error');
      return;
    }
  
    setSubmittingOrder(true);
    try {
      // Obtener fecha de entrega según políticas de negocio
      const now = new Date();
      const currentDay = now.getDay(); // 0 (domingo) a 6 (sábado)
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Convertir orderTimeLimit a horas y minutos (usar valor predeterminado si no está disponible)
      const orderTimeLimit = siteSettings?.orderTimeLimit || '18:00';
      const [limitHours, limitMinutes] = orderTimeLimit.split(':').map(Number);
      
      const isPastTimeLimit = currentHour > limitHours || 
        (currentHour === limitHours && currentMinute >= limitMinutes);
      
      // Calcular días de entrega según reglas
      let deliveryOffset = 2; // Mínimo 2 días en el futuro para entrega
      
      // Regla especial para sábados
      if (currentDay === 6) { // Sábado
        if (isPastTimeLimit) {
          // Después del límite, entrega el miércoles (4 días después)
          deliveryOffset = 4;
        } else {
          // Antes del límite, entrega el martes (3 días después)
          deliveryOffset = 3;
        }
      } 
      // Regla para domingos - siempre entrega el miércoles (3 días)
      else if (currentDay === 0) {
        deliveryOffset = 3;
      }
      // Para otros días, si pasó el límite, agregar un día extra
      else if (isPastTimeLimit) {
        deliveryOffset++;
      }
      
      // Calcular fecha de entrega
      const deliveryDate = new Date(now);
      deliveryDate.setDate(now.getDate() + deliveryOffset);
      
      // Formato YYYY-MM-DD para la API
      const formattedDeliveryDate = deliveryDate.toISOString().split('T')[0];
      
      // Preparar datos para la API según la estructura de orderController
      const orderData = {
          user_id: getCurrentUserId(),
          total_amount: orderTotal,
          delivery_date: formattedDeliveryDate, // Añadir fecha de entrega
          details: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };
      
      // Agregar información del sitio para la fecha de entrega
      const response = await API.post('/orders', orderData);
      
      if (response.data.success) {
        showNotification('Pedido enviado correctamente. Entrega programada para: ' + 
          new Date(formattedDeliveryDate).toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }));
        setOrderItems([]);
        setOrderTotal(0);
      } else {
        showNotification(response.data.message || 'Error al crear el pedido', 'error');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      showNotification('Error al enviar el pedido: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setSubmittingOrder(false);
    }
  }, [orderItems, orderTotal, showNotification, getCurrentUserId, siteSettings]);

  // Formatear precio
  const formatCurrency = useCallback((value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
  }, []);

  // Calcular el total del pedido
  const calculateOrderTotal = useCallback(() => {
    const total = orderItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    setOrderTotal(total);
  }, [orderItems]);

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = products.slice(indexOfFirstItem, indexOfLastItem);
  const paginate = useCallback((pageNumber) => setCurrentPage(pageNumber), []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await API.get('/admin/settings');
        if (response.data && response.data.success) {
          setSiteSettings(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching site settings:', error);
        // Usar valores predeterminados si no se puede cargar
      }
    };
  
    fetchSettings();
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Inicializar cantidades de productos cuando se cargan
useEffect(() => {
  if (products.length > 0) {
    const initialQuantities = {};
    products.forEach(product => {
      initialQuantities[product.product_id] = 1;
    });
    setProductQuantities(initialQuantities);
  }
}, [products]);

  // Actualizar productos cuando cambia la búsqueda
  useEffect(() => {
    fetchProducts();
  }, [search, fetchProducts]);

  // Actualizar total cuando cambian los items
  useEffect(() => {
    calculateOrderTotal();
  }, [orderItems, calculateOrderTotal]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {notification.show && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Header with dark mode toggle */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Selecciona los productos para tu pedido SAP
            </h1>
            <p className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Explora el catálogo y añade productos a tu orden
            </p>
          </div>
          <Button 
            variant="outline" 
            className={`rounded-full p-3 ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'}`}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
          </Button>
        </div>
        
        {/* Order summary card with animation */}
        <div className={`mb-8 transform transition-all duration-300 hover:scale-[1.01] ${orderItems.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-90'}`}>
          <Card className={`overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`p-1 ${darkMode ? 'bg-indigo-900' : 'bg-indigo-100'}`}></div>
            <div className="p-5">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${darkMode ? 'bg-indigo-900' : 'bg-indigo-100'}`}>
                    <FiShoppingCart size={20} className={darkMode ? 'text-indigo-300' : 'text-indigo-600'} />
                  </div>
                  <div>
                    <h2 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>Tu Pedido Actual</h2>
                    <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                      {orderItems.length} productos | {orderItems.reduce((sum, item) => sum + item.quantity, 0)} unidades
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-auto">
                  <span className={`text-xl font-bold ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                    {formatCurrency(orderTotal)}
                  </span>
                  <Button
                    variant="primary"
                    className={`transition-all duration-200 transform active:scale-95 ${
                      submittingOrder ? 'opacity-75' : ''
                    } ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    onClick={submitOrder}
                    disabled={orderItems.length === 0 || submittingOrder}
                  >
                    <span className="flex items-center gap-2">
                      {submittingOrder ? 'Procesando...' : 'Finalizar Pedido'} 
                      {!submittingOrder && <FiCheck />}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Search and view controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-3">
            <div className={`relative flex items-center ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'} rounded-lg overflow-hidden shadow-sm`}>
              <div className="px-3">
                <FiSearch className="text-gray-400" />
              </div>
              <Input
                placeholder="Busca por nombre, código o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`border-0 shadow-none focus:ring-0 ${darkMode ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white text-gray-900'} py-3 px-0 w-full`}
              />
              {search && (
                <button
                  className={`px-3 text-gray-400 hover:${darkMode ? 'text-gray-200' : 'text-gray-600'}`}
                  onClick={() => setSearch('')}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between lg:justify-end gap-2">
            <Button 
              variant={viewMode === 'table' ? 'primary' : 'outline'} 
              onClick={() => setViewMode('table')}
              className={`flex-1 lg:flex-none ${viewMode === 'table' ? (darkMode ? 'bg-indigo-600' : 'bg-indigo-600') : (darkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white border-gray-300')}`}
            >
              <FiList className="mr-1" /> Lista
            </Button>
            <Button 
              variant={viewMode === 'cards' ? 'primary' : 'outline'} 
              onClick={() => setViewMode('cards')}
              className={`flex-1 lg:flex-none ${viewMode === 'cards' ? (darkMode ? 'bg-indigo-600' : 'bg-indigo-600') : (darkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white border-gray-300')}`}
            >
              <FiGrid className="mr-1" /> Tarjetas
            </Button>
          </div>
        </div>
        
        {/* Products display - Table view */}
        {viewMode === 'table' && (
          <div className={`overflow-x-auto rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            {loading ? (
              <div className="text-center py-12 animate-fadeIn">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2">Cargando productos...</p>
              </div>
            ) : products.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Producto</th>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Precio</th>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Cantidad</th>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {products.map((product) => (
                    <tr key={product.product_id} className={`transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {product.image && (
                            <div className="flex-shrink-0 h-10 w-10 mr-3">
                              <img className="h-10 w-10 rounded-md object-cover" src={product.image} alt={product.name} />
                            </div>
                          )}
                          <div>
                            <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{product.name}</div>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{product.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(product.price_list1)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center border rounded-md w-32 overflow-hidden">
                          <button 
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              if (currentQty > 1) {
                                updateQuantity(product.product_id, currentQty - 1);
                              }
                            }} 
                            className={`px-2 py-1 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                          >
                            <FiMinus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={productQuantities[product.product_id] || 1}
                            onChange={(e) => handleQuantityChange(product.product_id, parseInt(e.target.value, 10))}
                            className={`w-12 text-center text-sm border-0 focus:ring-0 focus:outline-none ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}
                          />
                          <button 
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              updateQuantity(product.product_id, currentQty + 1);
                            }} 
                            className={`px-2 py-1 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                          >
                            <FiPlus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`transition-transform active:scale-95 ${darkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200' : 'bg-white'}`}
                            onClick={() => openProductDetails(product)}
                          >
                            <FiEye className="mr-1" /> Ver
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="transition-transform active:scale-95 bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => addToOrder(product, productQuantities[product.product_id] || 1)}
                          >
                            <FiPlus className="mr-1" /> Añadir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>No se encontraron productos.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Products display - Cards view */}
        {viewMode === 'cards' && (
          <div className={`${loading ? 'flex justify-center items-center min-h-[300px]' : ''}`}>
            {loading ? (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2">Cargando productos...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <div 
                    key={product.product_id} 
                    className={`rounded-lg overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 ${
                      darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
                    }`}
                  >
                    {product.image ? (
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className={`w-full h-48 flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <span className={`text-4xl ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>📦</span>
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className={`font-semibold text-lg mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{product.name}</h3>
                      <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {product.description ? 
                          (product.description.length > 80 ? 
                            `${product.description.substring(0, 80)}...` : product.description
                          ) : 'Sin descripción'
                        }
                      </p>
                      <div className={`flex justify-between items-center mb-3 pb-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <span className={`font-bold text-lg ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                          {formatCurrency(product.price_list1)}
                        </span>
                        <div className="flex items-center">
                          <button 
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              if (currentQty > 1) {
                                updateQuantity(product.product_id, currentQty - 1);
                              }
                            }} 
                            className={`p-1 rounded-md ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                          >
                            <FiMinus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={productQuantities[product.product_id] || 1}
                            onChange={(e) => handleQuantityChange(product.product_id, parseInt(e.target.value, 10))}
                            className={`w-12 text-center text-sm mx-1 border rounded-md ${
                              darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'
                            }`}
                          />
                          <button 
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              updateQuantity(product.product_id, currentQty + 1);
                            }} 
                            className={`p-1 rounded-md ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                          >
                            <FiPlus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`flex-1 transition-transform active:scale-95 ${
                            darkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200' : ''
                          }`}
                          onClick={() => openProductDetails(product)}
                        >
                          <FiEye className="mr-1" /> Ver
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 transition-transform active:scale-95 bg-indigo-600 hover:bg-indigo-700"
                          onClick={() => addToOrder(product, productQuantities[product.product_id] || 1)}
                        >
                          <FiPlus className="mr-1" /> Añadir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-12 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
                <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>No se encontraron productos que coincidan con tu búsqueda.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Pagination */}
        {!loading && products.length > itemsPerPage && (
          <div className="mt-6 flex justify-center">
            <nav className="flex items-center">
              {Array.from({ length: Math.ceil(products.length / itemsPerPage) }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => paginate(index + 1)}
                  className={`mx-1 px-3 py-1 rounded ${
                    currentPage === index + 1
                      ? darkMode
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-600 text-white'
                      : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
      
      {/* Product Detail Modal */}
      <Modal 
        isOpen={modalVisible} 
        onClose={closeModal} 
        title={selectedProduct?.name || 'Detalle del Producto'}
        className={darkMode ? 'bg-gray-800 text-white' : ''}
      >
        {selectedProduct && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2">
              {selectedProduct.image ? (
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name} 
                  className="w-full h-auto rounded-lg object-cover shadow-md"
                />
              ) : (
                <div className={`w-full h-64 flex items-center justify-center rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <span className="text-6xl">📦</span>
                </div>
              )}
            </div>
            <div className="w-full md:w-1/2">
              <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedProduct.name}</h2>
              <div className={`mb-4 pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  Código: {selectedProduct.code || 'N/A'}
                </span>
              </div>
              <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {selectedProduct.description || 'Sin descripción disponible para este producto.'}
              </p>
              <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Precio:</span>
                  <span className={`text-xl font-bold ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                    {formatCurrency(selectedProduct.price_list1)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-6">
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Cantidad:</span>
                  <div className="flex items-center">
                    <button 
                      onClick={decrementQuantity} 
                      className={`p-2 rounded-l-md ${
                        darkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      <FiMinus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(selectedProduct.product_id, parseInt(e.target.value, 10))}
                      className={`w-16 py-2 text-center border-y ${
                        darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    />
                    <button 
                      onClick={incrementQuantity} 
                      className={`p-2 rounded-r-md ${
                        darkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      <FiPlus size={16} />
                    </button>
                  </div>
                </div>
                <Button
                  variant="primary"
                  className="w-full transition-transform active:scale-95 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => addToOrder(selectedProduct, quantity)}
                >
                  <FiShoppingCart className="mr-2" /> Añadir al Pedido
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;