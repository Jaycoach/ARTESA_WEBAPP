import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiEye, FiClipboard, FiPlus, FiMinus, FiList, FiGrid, FiCheck } from 'react-icons/fi';
import API from '../../../../api/config';
import Notification from '../../../../Components/ui/Notification';

// Importación de componentes personalizados
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
    <div className="bg-gray-100 h-full w-full overflow-hidden">
      {notification.show && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ show: false, message: '', type: '' })}
        />
      )}

      <div className="h-full w-full flex flex-col">
        {/* Encabezado */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Catálogo de Productos</h1>
          <p className="text-gray-600">Selecciona los productos para tu pedido SAP</p>
        </div>

        {/* Resumen del pedido */}
        <Card className="mb-6 p-4 bg-blue-50 border border-blue-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="font-bold text-lg text-blue-800">Resumen de Pedido</h2>
              <p className="text-blue-600">
                Productos: {orderItems.length} | 
                Unidades: {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-blue-800">{formatCurrency(orderTotal)}</span>
              <Button 
                variant="primary"
                className="bg-blue-700 hover:bg-blue-800 flex items-center gap-2"
                onClick={submitOrder}
                disabled={orderItems.length === 0 || submittingOrder}
              >
                {submittingOrder ? 'Procesando...' : 'Finalizar Pedido'} {!submittingOrder && <FiCheck />}
              </Button>
            </div>
          </div>
        </Card>

        {/* Filtros y controles */}
        <Card className="mb-6 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="md:w-2/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="Buscar productos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>
            
            <div className="md:w-1/3 flex items-end">
              <div className="ml-auto flex items-center gap-2">
                <Button 
                  variant={viewMode === 'table' ? 'primary' : 'outline'} 
                  onClick={() => setViewMode('table')}
                  className="flex items-center gap-1"
                >
                  <FiList /> Tabla
                </Button>
                <Button 
                  variant={viewMode === 'cards' ? 'primary' : 'outline'} 
                  onClick={() => setViewMode('cards')}
                  className="flex items-center gap-1"
                >
                  <FiGrid /> Tarjetas
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Contenedor con scroll para el contenido principal */}
        <div className="h-[calc(100vh-320px)] overflow-y-auto pb-6">
          {/* Loader */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* Vista de tabla */}
          {!loading && viewMode === 'table' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Imagen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Precio Normal
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentItems.length > 0 ? (
                      currentItems.map((product) => (
                        <tr key={product.product_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-16 w-16 object-contain rounded-md border border-gray-200"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-blue-600">{formatCurrency(product.price_list1)}</div>
                          </td>
                          {/* En la vista de tabla */}
                          <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center border rounded-md bg-white shadow-sm">
                            <button
                              type="button"
                              onClick={() => {
                                const currentQty = productQuantities[product.product_id] || 1;
                                if (currentQty > 1) {
                                  handleQuantityChange(product.product_id, currentQty - 1);
                                }
                              }}
                              className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 bg-gray-50 hover:bg-gray-100 px-2"
                              disabled={(productQuantities[product.product_id] || 1) <= 1}
                            >
                              <FiMinus size={16} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={productQuantities[product.product_id] || 1}
                              onChange={(e) => handleQuantityChange(product.product_id, parseInt(e.target.value, 10))}
                              className="w-14 text-center text-sm border-0 focus:ring-0 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const currentQty = productQuantities[product.product_id] || 1;
                                handleQuantityChange(product.product_id, currentQty + 1);
                              }}
                              className="p-1 text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-2"
                            >
                              <FiPlus size={16} />
                            </button>
                          </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              className="flex items-center gap-1 py-1 px-2 text-blue-600 border border-blue-600 hover:bg-blue-50"
                              onClick={() => openProductDetails(product)}
                            >
                              <FiEye /> Ver
                            </Button>
                            <Button
                              variant="primary"
                              className="flex items-center gap-1 py-1 px-2 bg-blue-600 text-white hover:bg-blue-700"
                              onClick={() => addToOrder(product, productQuantities[product.product_id] || 1)}
                            >
                              <FiClipboard /> Agregar a Pedido
                            </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                          No se encontraron productos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vista de tarjetas */}
          {!loading && viewMode === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {currentItems.length > 0 ? (
                currentItems.map((product) => (
                  <Card key={product.product_id} className="flex flex-col h-full transition-transform hover:-translate-y-1">
                    <div className="h-44 p-3 flex items-center justify-center bg-gray-50 rounded-t-lg">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-medium text-gray-900 text-sm md:text-base mb-2 line-clamp-2 h-10">{product.name}</h3>
                      <p className="text-lg font-bold text-blue-600 mb-2">{formatCurrency(product.price_list1)}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Cantidad:</span>
                        <div className="flex items-center border rounded-md">
                          <button
                            type="button"
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              if (currentQty > 1) {
                                handleQuantityChange(product.product_id, currentQty - 1);
                              }
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                            disabled={(productQuantities[product.product_id] || 1) <= 1}
                          >
                            <FiMinus size={16} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={productQuantities[product.product_id] || 1}
                            onChange={(e) => handleQuantityChange(product.product_id, parseInt(e.target.value))}
                            className="w-12 text-center text-sm border-0 focus:ring-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              handleQuantityChange(product.product_id, currentQty + 1);
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800"
                          >
                            <FiPlus size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-auto">
                        <Button
                          variant="outline"
                          className="flex-1 flex items-center justify-center gap-1 text-xs"
                          onClick={() => openProductDetails(product)}
                        >
                          <FiEye /> Ver
                        </Button>
                        <Button
                          variant="primary"
                          className="flex-1 flex items-center justify-center gap-1 text-xs"
                          onClick={() => addToOrder(product)}
                        >
                          <FiClipboard /> Agregar
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No se encontraron productos.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paginación */}
        {products.length > itemsPerPage && (
          <div className="flex justify-center mt-6">
            <nav className="inline-flex rounded-md shadow-sm">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, Math.ceil(products.length / itemsPerPage)) }).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <button
                    key={index}
                    onClick={() => paginate(pageNumber)}
                    className={`px-3 py-2 border border-gray-300 text-sm font-medium ${
                      currentPage === pageNumber
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === Math.ceil(products.length / itemsPerPage)}
                className="px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Modal de detalles del producto */}
      <Modal isOpen={modalVisible} onClose={closeModal} title="Detalles del Producto">
        {selectedProduct && (
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="md:flex gap-6">
              <div className="md:w-1/2 mb-4 md:mb-0">
                <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-center h-64">
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name} 
                    className="max-h-full max-w-full object-contain" 
                  />
                </div>
              </div>
              
              <div className="md:w-1/2">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedProduct.name}</h2>
                
                {selectedProduct.description && (
                  <p className="text-gray-600 mb-4">{selectedProduct.description}</p>
                )}
                
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Precios</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Normal:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(selectedProduct.price_list1)}</span>
                    </div>
                    
                    {selectedProduct.price_list2 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mayorista:</span>
                        <span className="font-bold text-blue-600">{formatCurrency(selectedProduct.price_list2)}</span>
                      </div>
                    )}
                    
                    {selectedProduct.price_list3 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Especial:</span>
                        <span className="font-bold text-blue-600">{formatCurrency(selectedProduct.price_list3)}</span>
                      </div>
                    )}
                  </div>
                </div>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-800 font-medium">Cantidad:</span>
                      <div className="flex items-center border rounded-md">
                        <button
                          onClick={decrementQuantity}
                          className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                          disabled={quantity <= 1}
                        >
                          <FiMinus />
                        </button>
                        <span className="w-10 text-center">{quantity}</span>
                        <button
                          onClick={incrementQuantity}
                          className="p-2 text-gray-600 hover:text-gray-800"
                        >
                          <FiPlus />
                        </button>
                      </div>
                    </div>
                    
                    <Button
                      variant="primary"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={() => addToOrder(selectedProduct, quantity)}
                    >
                      <FiClipboard /> Agregar a Pedido
                    </Button>
                  </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;