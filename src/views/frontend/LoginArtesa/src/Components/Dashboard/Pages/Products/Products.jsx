import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiShoppingCart, FiSearch, FiEye, FiClipboard, FiPlus, FiMinus, FiList, FiGrid, FiCheck } from 'react-icons/fi';
import API from '../../../../api/config';
import { useAuth } from '../../../../hooks/useAuth';
import DeliveryDatePicker from '../Orders/DeliveryDatePicker';
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
  const [selectedDate, setSelectedDate] = useState('');
  const { user } = useAuth();

  // Estado para manejar cantidades de cada producto
  const [productQuantities, setProductQuantities] = useState({});

  // Estado para la paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  // Estado para el pedido actual
  const [orderItems, setOrderItems] = useState([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');

  // Función para cambiar de página
  const getPaginationRange = (currentPage, totalPages, siblingCount = 1) => {
    const totalPageNumbers = siblingCount * 2 + 5;

    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      let leftItemCount = 3 + 2 * siblingCount;
      let leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);

      return [...leftRange, '...', totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      let rightItemCount = 3 + 2 * siblingCount;
      let rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + 1 + i);

      return [firstPageIndex, '...', ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      let middleRange = Array.from({ length: (siblingCount * 2) + 1 }, (_, i) => leftSiblingIndex + i);
      return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
    }
  };

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
      const response = await API.get(`/products${search ? `?search=${search}` : ''}`);
      if (response.data.success) {
        setProducts(response.data.data || []);
        setProductQuantities(
          response.data.data.reduce((acc, product) => ({ ...acc, [product.product_id]: 1 }), {})
        );
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
      [productId]: Math.max(1, quantity) // Evita cantidades negativas o cero
    }));
    console.log("Product quantities updated:", productId, Math.max(1, quantity));
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
    if (!user || !user.id) {
      console.error("Error: No se pudo obtener el ID de usuario", user);
      return null;
    }
    return user.id;
  }, [user]);

  const removeFromOrder = useCallback((productId) => {
    setOrderItems(prevItems => 
      prevItems.filter(item => item.product_id !== productId)
    );
    showNotification('Producto eliminado del pedido');
  }, [showNotification]);

  // Función para enviar el pedido completo a la API
  const submitOrder = useCallback(async () => {
    // Validar que hay productos en el pedido
    if (orderItems.length === 0) {
      showNotification('No hay productos en el pedido', 'error');
      return;
    }

    // Validar que todos los productos tienen datos válidos
    const isValid = orderItems.every(item =>
      item.product_id &&
      item.quantity > 0 &&
      item.unit_price > 0
    );

    if (!isValid) {
      showNotification('Por favor revisa los productos del pedido. Todos deben tener cantidades y precios válidos.', 'error');
      return;
    }

    // Validar que se ha seleccionado una fecha de entrega
    if (!deliveryDate) {
      showNotification('Selecciona una fecha de entrega válida', 'error');
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
      showNotification('No se pudo identificar tu usuario. Por favor, inicia sesión nuevamente.', 'error');
      return;
    }

    setSubmittingOrder(true);

    try {
      const orderData = {
        user_id: getCurrentUserId(),
        total_amount: orderTotal,
        delivery_date: deliveryDate,
        details: orderItems.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price)
        }))
      };

      const response = await API.post('/orders', orderData);

      if (response.data.success) {
        showNotification('Pedido creado exitosamente');
        setOrderItems([]);
        setOrderTotal(0);
        setDeliveryDate('');
      } else {
        throw new Error(response.data.message || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error('Error submitting order:', error);

      if (error.response) {
        const status = error.response.status;
        if (status === 400) {
          showNotification('Datos inválidos en el pedido. Revisa la información.', 'error');
        } else if (status === 403) {
          showNotification('Tu usuario no tiene permisos para crear pedidos.', 'error');
        } else if (status === 500) {
          showNotification('Error en el servidor. Contacta al administrador.', 'error');
        } else {
          showNotification(`Error: ${error.response.data?.message || 'Desconocido'}`, 'error');
        }
      } else {
        showNotification('Error de conexión. Verifica tu internet.', 'error');
      }
    } finally {
      setSubmittingOrder(false);
    }
  }, [orderItems, orderTotal, deliveryDate, showNotification, getCurrentUserId]);

  // Formatear precio
  const formatCurrency = useCallback((value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
  }, []);

  // Calcular el total del pedido
  const calculateOrderTotal = useCallback(() => {
    const total = orderItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    setOrderTotal(total);
  }, [orderItems]);

  // Modificar la lógica de paginación
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return products.slice(startIndex, startIndex + itemsPerPage);
  }, [products, currentPage, itemsPerPage]);

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
    <div className="min-h-screen bg-gray-50">
      {notification.show && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Selecciona los productos para tu pedido SAP
            </h1>
            <p className="mt-2 text-gray-600">
              Explora el catálogo y añade productos a tu orden
            </p>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, products.length)} de {products.length} productos
        </div>

        {/* Order summary card */}
        <div className={`mb-8 transform transition-all duration-300 hover:scale-[1.01] ${orderItems.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-90'}`}>
          <Card className="overflow-hidden bg-white border-gray-200">
            <div className="p-1 bg-indigo-100"></div>
            <div className="p-5">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-indigo-100">
                    <FiShoppingCart size={20} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-gray-900">Tu Pedido Actual</h2>
                    <p className="text-gray-700">
                      {orderItems.length} productos | {orderItems.reduce((sum, item) => sum + item.quantity, 0)} unidades
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-auto">
                  <span className="text-xl font-bold text-primary-300">
                    {formatCurrency(orderTotal)}
                  </span>
                  <Button
                    variant="secondary"
                    className={`transition-all duration-200 transform active:scale-95 ${submittingOrder ? 'opacity-75' : ''} 
                    bg-indigo-600 hover:bg-indigo-700`}
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
           {/* Nueva sección de productos seleccionados */}
        {orderItems.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold mb-3 text-gray-900">
              Productos Seleccionados
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {orderItems.map((item) => (
                <div 
                  key={item.product_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {item.name}
                    </p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-sm text-gray-600">
                        Cantidad: {item.quantity}
                      </span>
                      <span className="text-sm text-gray-600">
                        Subtotal: {formatCurrency(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromOrder(item.product_id)}
                    className="ml-4 px-3 py-1 rounded text-white text-sm flex items-center bg-red-600 hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                  >
                    <FiMinus className="mr-1" />
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>

        {/* Banner de fecha seleccionada */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Fecha de entrega
          </label>
          <DeliveryDatePicker
            value={deliveryDate}
            onChange={setDeliveryDate}
            orderTimeLimit={siteSettings?.orderTimeLimit || '18:00'}
          />
          {!deliveryDate && <p className="text-red-500 text-xs mt-1">Selecciona una fecha de entrega</p>}
        </div>

        {/* Search and view controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-3">
            <div className="relative flex items-center rounded-lg overflow-hidden shadow-sm bg-white">
              <div className="px-3">
                <FiSearch className="text-gray-400" />
              </div>
              <Input
                placeholder="Busca por nombre, código o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 shadow-none focus:ring-0 py-3 px-0 w-full"
              />
              {search && (
                <button
                  className="px-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearch('')}
                >
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between lg:justify-end gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                viewMode === 'table' 
                  ? 'bg-white text-indigo-700 shadow-md border border-gray-200' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-500'
                }`}
              aria-label="Ver productos en formato lista"
            >
              <FiList 
                className={`mr-2 ${viewMode === 'table' ? 'text-indigo-500' : ''}`} 
                size={18} 
              />
              <span>Lista</span>
            </button>
            
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                viewMode === 'cards' 
                  ? 'bg-white text-indigo-700 shadow-md border border-gray-200' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-500'
                }`}
              aria-label="Ver productos en formato Miniaturas / Fotos y descripción detallada de producto"
            >
              <FiGrid 
                className={`mr-2 ${viewMode === 'cards' ? 'text-indigo-500' : ''}`} 
                size={18} 
              />
              <span>Miniaturas</span>
            </button>
          </div>
        </div>

        {/* Products display - Table view */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto rounded-lg shadow bg-white">
            {loading ? (
              <div className="text-center py-12 animate-fadeIn">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-gray-600">Cargando productos...</p>
              </div>
            ) : products.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow-md overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <tr key={product.product_id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {product.image && (
                            <div className="flex-shrink-0 h-10 w-10 mr-3">
                              <img className="h-10 w-10 rounded-md object-cover" src={product.image} alt={product.name} />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{formatCurrency(product.price_list1)}</div>
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
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200"
                          >
                            <FiMinus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={productQuantities[product.product_id] || 1}
                            onChange={(e) => handleQuantityChange(product.product_id, parseInt(e.target.value, 10))}
                            className="w-12 text-center text-sm border-0 focus:ring-0 focus:outline-none bg-white"
                          />
                          <button
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              updateQuantity(product.product_id, currentQty + 1);
                            }}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200"
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
                            className="transition-transform active:scale-95 bg-white"
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
                <p className="text-gray-600">No se encontraron productos.</p>
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
                <p className="mt-2 text-gray-600">Cargando productos...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-6">
                {paginatedProducts.map((product) => (
                  <div
                    key={product.product_id}
                    className="rounded-lg overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 bg-white"
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-gray-100">
                        <span className="text-4xl text-gray-400">📦</span>
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2 text-gray-900 line-clamp-2">{product.name}</h3>
                      <p className="text-sm mb-3 text-gray-600 min-h-[3rem] line-clamp-3">
                        {(product.description && product.description !== product.name) 
                          ? (product.description.length > 120 
                              ? `${product.description.substring(0, 120)}...` 
                              : product.description)
                          : 'Sin descripción detallada disponible para este producto.'
                        }
                      </p>
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                        <span className="font-bold text-lg text-indigo-600">
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
                            className="p-1 rounded-md bg-gray-100 hover:bg-gray-200"
                          >
                            <FiMinus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={productQuantities[product.product_id] || 1}
                            onChange={(e) => handleQuantityChange(product.product_id, parseInt(e.target.value, 10))}
                            className="w-12 text-center text-sm mx-1 border rounded-md bg-white border-gray-300"
                          />
                          <button
                            onClick={() => {
                              const currentQty = productQuantities[product.product_id] || 1;
                              updateQuantity(product.product_id, currentQty + 1);
                            }}
                            className="p-1 rounded-md bg-gray-100 hover:bg-gray-200"
                          >
                            <FiPlus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 transition-transform active:scale-95"
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
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-600">No se encontraron productos que coincidan con tu búsqueda.</p>
              </div>
            )}
          </div>
        )}

        {/* Paginación */}
        <div className="flex flex-col items-center mt-4 mb-2">
          {!loading && products.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <button
                onClick={() => paginate(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
              >
                {'<'}
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange(currentPage, Math.ceil(products.length / itemsPerPage)).map((pageNumber, index) =>
                  pageNumber === '...' ? (
                    <span key={index} className="px-2">...</span>
                  ) : (
                    <button
                      key={index}
                      onClick={() => paginate(pageNumber)}
                      className={`mx-1 px-3 py-1 rounded ${currentPage === pageNumber
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      {pageNumber}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => paginate(Math.min(currentPage + 1, Math.ceil(products.length / itemsPerPage)))}
                disabled={currentPage === Math.ceil(products.length / itemsPerPage)}
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
              >
                {'>'}
              </button>
            </div>
          )}

          <div className="text-center font-bold text-gray-700">
            Página actual: {currentPage}
          </div>
        </div>
      </div>

      {/* Product Detail Modal */}
      <Modal
        isOpen={modalVisible}
        onClose={closeModal}
        title={selectedProduct?.name || 'Detalle del Producto'}
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
                <div className="w-full h-64 flex items-center justify-center rounded-lg bg-gray-100">
                  <span className="text-6xl">📦</span>
                </div>
              )}
            </div>
            <div className="w-full md:w-1/2">
              <h2 className="text-2xl font-bold mb-2 text-gray-900">{selectedProduct.name}</h2>
              <div className="mb-4 pb-4 border-b border-gray-200">
                <span className="inline-block px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">
                  Código: {selectedProduct.code || 'N/A'}
                </span>
              </div>
              <p className="mb-6 text-gray-700">
                {selectedProduct.description || 'Sin descripción disponible para este producto.'}
              </p>
              <div className="mb-6 p-4 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600">Precio:</span>
                  <span className="text-xl font-bold text-indigo-600">
                    {formatCurrency(selectedProduct.price_list1)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-gray-600">Cantidad:</span>
                  <div className="flex items-center">
                    <button
                      onClick={decrementQuantity}
                      className="p-2 rounded-l-md bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      <FiMinus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(selectedProduct.product_id, parseInt(e.target.value, 10))}
                      className="w-16 py-2 text-center border-y bg-white text-gray-700 border-gray-200"
                    />
                    <button
                      onClick={incrementQuantity}
                      className="p-2 rounded-r-md bg-gray-200 hover:bg-gray-300 text-gray-700"
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