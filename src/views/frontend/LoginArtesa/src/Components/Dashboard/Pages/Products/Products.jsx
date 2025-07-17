import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiShoppingCart, FiSearch, FiEye, FiPlus, FiMinus, FiList, FiGrid,
  FiCheck, FiEdit, FiTrash2, FiUpload, FiImage, FiSettings,
  FiToggleLeft, FiToggleRight, FiInfo, FiSave, FiX
} from 'react-icons/fi';
import Select from 'react-select';
import { useBranches } from '../../../../hooks/useBranches';
import API, { UploadAPI, ProductsAPI } from '../../../../api/config';
import { useAuth } from '../../../../hooks/useAuth';
import DeliveryDatePicker from '../Orders/DeliveryDatePicker';
import Notification from '../../../../Components/ui/Notification';
import Modal from '../../../../Components/ui/Modal';
import Input from '../../../../Components/ui/Input';
import Card from '../../../../Components/ui/Card';
import Button from '../../../../Components/ui/Button';
import ProductImage from './components/ProductImage';

// **CONSTANTES DE ZONAS DE ENTREGA Y CÁLCULOS**
const DELIVERY_ZONES = {
  'MIERCOLES_SABADO': {
    name: 'Miércoles y Sábado',
    days: [3, 6],
    municipalities: ['25175', '25126', '25758', '25899', '25214', '25322', '25295', '25799'],
    cities: ['Chía', 'Cajicá', 'Sopó', 'Zipaquirá', 'Cota', 'Guasca', 'Gachancipá', 'Tenjo']
  },
  'LUNES_JUEVES': {
    name: 'Lunes y Jueves',
    days: [1, 4],
    municipalities: ['25754'],
    cities: ['Soacha']
  },
  'MARTES_VIERNES': {
    name: 'Martes y Viernes',
    days: [2, 5],
    municipalities: ['25473', '25430', '25286', '25214'],
    cities: ['Mosquera', 'Madrid', 'Funza', 'Siberia']
  },
  'LUNES_SABADO': {
    name: 'Lunes a Sábado',
    days: [1, 2, 3, 4, 5, 6],
    municipalities: ['11001'],
    cities: ['Bogotá', 'Bogotá D.C']
  }
};

const IVA_RATE = 0.19;
const MIN_ORDER_AMOUNT = 50000;
const SHIPPING_CHARGE = 10000;
const SHIPPING_LIMIT = 50000;
const SHIPPING_FREE_LIMIT = 80000;

// **HOOK PERSONALIZADO PARA GESTIÓN DE PRECIOS**
const usePriceList = () => {
  const { user } = useAuth();
  const [userPriceListCode, setUserPriceListCode] = useState(null);
  const [priceCache, setPriceCache] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const determinePriceList = () => {
      if (!user) return;

      let priceListCode = 'GENERAL';

      if (user.role === 1) {
        priceListCode = 'ORO';
      } else if (user.clientProfile?.tamanoEmpresa === 'Grande') {
        priceListCode = 'ORO';
      } else if (user.clientProfile?.tamanoEmpresa === 'Mediana') {
        priceListCode = 'PLATA';
      } else if (user.clientProfile?.tamanoEmpresa === 'Pequena') {
        priceListCode = 'BRONCE';
      }

      setUserPriceListCode(priceListCode);
    };

    determinePriceList();
  }, [user]);

  const fetchMultiplePrices = useCallback(async (productCodes) => {
    if (!userPriceListCode || !productCodes.length) return {};

    setLoading(true);
    try {
      const response = await API.post(
        `/api/price-lists/${userPriceListCode}/products/prices`,
        { productCodes }
      );

      if (response.data.success) {
        const newPrices = response.data.data;
        setPriceCache(prev => ({ ...prev, ...newPrices }));
        return newPrices;
      }
      return {};
    } catch (error) {
      console.error('Error fetching prices:', error);
      return {};
    } finally {
      setLoading(false);
    }
  }, [userPriceListCode]);

  const getProductPrice = useCallback(async (productCode) => {
    if (!userPriceListCode) return null;

    if (priceCache[productCode]) {
      return priceCache[productCode];
    }

    try {
      const response = await API.get(
        `/api/price-lists/${userPriceListCode}/products/${productCode}/price`
      );

      if (response.data.success) {
        const priceData = {
          price: response.data.data.price,
          currency: response.data.data.currency,
          productName: response.data.data.product_name,
          lastUpdate: response.data.data.updated_at
        };

        setPriceCache(prev => ({ ...prev, [productCode]: priceData }));
        return priceData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching product price:', error);
      return null;
    }
  }, [userPriceListCode, priceCache]);

  return {
    userPriceListCode,
    priceCache,
    loading,
    fetchMultiplePrices,
    getProductPrice
  };
};

const Products = () => {
  // **AUTENTICACIÓN**
  const { user, isAuthenticated, isAdmin } = useAuth();
  const userIsAdmin = isAdmin();

  // **HOOKS PERSONALIZADOS**
  const {
    branches,
    loading: loadingBranches,
    error: branchError,
    fetchBranches
  } = useBranches();

  const {
    userPriceListCode,
    priceCache,
    loading: pricesLoading,
    fetchMultiplePrices,
    getProductPrice
  } = usePriceList();

  // **ESTADOS PRINCIPALES**
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [productQuantities, setProductQuantities] = useState({});

  // **ESTADOS ADMINISTRATIVOS**
  const [adminMode, setAdminMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState(null);

  // **ESTADOS PARA SUCURSALES Y ZONAS DE ENTREGA**
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchOptions, setBranchOptions] = useState([]);
  const [branchAddress, setBranchAddress] = useState('');
  const [deliveryZone, setDeliveryZone] = useState(null);
  const [availableDeliveryDays, setAvailableDeliveryDays] = useState([]);
  const [municipalityCode, setMunicipalityCode] = useState(null);

  // **ESTADOS PARA PEDIDOS**
  const [orderItems, setOrderItems] = useState([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');

  // **ESTADOS PARA PRECIOS PERSONALIZADOS**
  const [customPricesApplied, setCustomPricesApplied] = useState(false);
  const [calculatingDates, setCalculatingDates] = useState(false);

  // **ESTADOS PARA PAGINACIÓN**
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [siteSettings, setSiteSettings] = useState({ orderTimeLimit: '18:00' });

  // **FUNCIÓN PARA NOTIFICACIONES**
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
  }, []);

  // **FUNCIONES AUXILIARES**
  const getCurrentUserId = useCallback(() => {
    if (!user || !user.id) {
      console.error("Error: No se pudo obtener el ID de usuario", user);
      return null;
    }
    return user.id;
  }, [user]);

  const formatCurrency = useCallback((value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
  }, []);

  // **FUNCIONES DE ZONA DE ENTREGA**
  const getDeliveryZoneByDANECode = useCallback((daneCode, cityName = '') => {
    if (!daneCode && !cityName) return null;

    if (daneCode) {
      const normalizedDANE = daneCode.toString().trim();
      for (const [zoneKey, zoneData] of Object.entries(DELIVERY_ZONES)) {
        if (zoneData.municipalities.includes(normalizedDANE)) {
          return { key: zoneKey, ...zoneData };
        }
      }
    }

    if (cityName) {
      const normalizedCity = cityName.toLowerCase().trim();
      for (const [zoneKey, zoneData] of Object.entries(DELIVERY_ZONES)) {
        if (zoneData.cities.some(city => normalizedCity.includes(city.toLowerCase()))) {
          return { key: zoneKey, ...zoneData };
        }
      }
    }

    return null;
  }, []);

  const calculateAvailableDeliveryDates = useCallback((zone, orderTimeLimit = '18:00') => {
    if (!zone) return [];

    const today = new Date();
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const [limitHour, limitMinute] = orderTimeLimit.split(':').map(Number);

    const isAfterLimit = currentHour > limitHour ||
      (currentHour === limitHour && currentMinute > limitMinute);

    let additionalDays = 2;
    if (isAfterLimit) additionalDays += 1;

    const availableDates = [];
    for (let i = additionalDays; i <= 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      const dayOfWeek = checkDate.getDay();

      if (zone.days.includes(dayOfWeek)) {
        availableDates.push(new Date(checkDate));
      }
    }

    return availableDates;
  }, []);

  // **FUNCIONES DE CÁLCULO FINANCIERO**
  const calculateSubtotal = useCallback(() => {
    return orderItems.reduce((total, item) => {
      const itemTotal = item.quantity * item.unit_price;
      return total + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
  }, [orderItems]);

  const calculateIVA = useCallback((subtotal) => {
    return subtotal * IVA_RATE;
  }, []);

  const calculateShipping = useCallback((subtotal) => {
    if (subtotal >= SHIPPING_FREE_LIMIT) return 0;
    if (subtotal >= SHIPPING_LIMIT) return SHIPPING_CHARGE;
    return null;
  }, []);

  // **FUNCIÓN DE PAGINACIÓN**
  const getPaginationRange = useCallback((currentPage, totalPages, siblingCount = 1) => {
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
  }, []);

  const paginate = useCallback((pageNumber) => setCurrentPage(pageNumber), []);

  // **FUNCIÓN PRINCIPAL: fetchProducts CON PRECIOS PERSONALIZADOS**
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = `/products${search ? `?search=${encodeURIComponent(search)}` : ''}`;
      console.log('🔄 Fetching products from:', endpoint);

      const response = await API.get(endpoint);

      if (response.data.success) {
        const productsData = response.data.data || [];

        // Si hay lista de precios personalizada, obtener precios
        if (userPriceListCode && userPriceListCode !== 'GENERAL' && productsData.length > 0) {
          try {
            const productCodes = productsData.map(p =>
              p.sap_code || p.code || p.product_id.toString()
            );

            console.log('🔄 Fetching custom prices for list:', userPriceListCode);
            const customPrices = await fetchMultiplePrices(productCodes);

            const productsWithCustomPrices = productsData.map(product => {
              const productCode = product.sap_code || product.code || product.product_id.toString();
              const customPrice = customPrices[productCode];

              return {
                ...product,
                original_price_list1: product.price_list1,
                original_price_list2: product.price_list2,
                original_price_list3: product.price_list3,
                price_list1: customPrice?.price || product.price_list1,
                price_list2: product.price_list2,
                price_list3: product.price_list3,
                has_custom_price: !!customPrice,
                custom_price_info: customPrice || null,
                price_list_code: userPriceListCode
              };
            });

            setProducts(productsWithCustomPrices);
            setCustomPricesApplied(true);
            console.log('✅ Products loaded with custom prices:', productsWithCustomPrices.length);
          } catch (priceError) {
            console.warn('⚠️ Error loading custom prices, using default prices:', priceError);
            setProducts(productsData);
            setCustomPricesApplied(false);
          }
        } else {
          setProducts(productsData);
          setCustomPricesApplied(false);
        }

        setProductQuantities(
          productsData.reduce((acc, product) => ({
            ...acc,
            [product.product_id]: 1
          }), {})
        );

        console.log('✅ Products loaded:', productsData.length);
      } else {
        throw new Error(response.data.message || 'Error al cargar productos');
      }
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      showNotification(error.response?.data?.message || 'Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, userPriceListCode, fetchMultiplePrices, showNotification]);

  // **FUNCIONES CRUD DE PRODUCTOS**
  const handleCreateProduct = useCallback(async (productData) => {
    if (!userIsAdmin) {
      showNotification('No tienes permisos para crear productos', 'error');
      return;
    }

    try {
      console.log('🔄 Creando producto:', productData);
      const response = await API.post('/products', productData);

      if (response.data.success) {
        showNotification('Producto creado exitosamente');
        setShowProductForm(false);
        fetchProducts();
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Error al crear producto');
      }
    } catch (error) {
      console.error('❌ Error creating product:', error);
      showNotification(error.response?.data?.message || 'Error al crear producto', 'error');
      throw error;
    }
  }, [userIsAdmin, showNotification, fetchProducts]);

  const handleUpdateProduct = useCallback(async (productId, productData) => {
    if (!userIsAdmin) {
      showNotification('No tienes permisos para actualizar productos', 'error');
      return;
    }

    try {
      console.log('🔄 Actualizando producto:', productId, productData);
      const response = await API.put(`/products/${productId}`, productData);

      if (response.data.success) {
        showNotification('Producto actualizado exitosamente');
        setEditingProduct(null);
        setShowProductForm(false);
        fetchProducts();
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Error al actualizar producto');
      }
    } catch (error) {
      console.error('❌ Error updating product:', error);
      showNotification(error.response?.data?.message || 'Error al actualizar producto', 'error');
      throw error;
    }
  }, [userIsAdmin, showNotification, fetchProducts]);

  const handleDeleteProduct = useCallback(async (productId) => {
    if (!userIsAdmin) {
      showNotification('No tienes permisos para eliminar productos', 'error');
      return;
    }

    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      return;
    }

    try {
      console.log('🗑️ Eliminando producto:', productId);
      const response = await API.delete(`/products/${productId}`);

      if (response.data.success) {
        showNotification('Producto eliminado exitosamente');
        fetchProducts();
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Error al eliminar producto');
      }
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      showNotification(error.response?.data?.message || 'Error al eliminar producto', 'error');
    }
  }, [userIsAdmin, showNotification, fetchProducts]);

  // **FUNCIONES DE IMAGEN**
  const assignProductImage = useCallback(async (productId, imageUrl) => {
    try {
      console.log('🖼️ Asignando imagen al producto:', { productId, imageUrl });

      const assignResponse = await API.put(`/products/${productId}/image`, {
        imageUrl: imageUrl
      });

      console.log('🖼️ Resultado asignación:', assignResponse.data);

      if (assignResponse.data.success) {
        showNotification('Imagen asignada exitosamente', 'success');
        await fetchProducts();
        return true;
      } else {
        showNotification(assignResponse.data.message || 'Error en asignación', 'error');
        return false;
      }
    } catch (error) {
      console.error('❌ Error en asignación de imagen:', error);
      showNotification(error.response?.data?.message || error.message || 'Error en asignación', 'error');
      return false;
    }
  }, [fetchProducts, showNotification]);

  const handleImageUpload = useCallback(async (productId, imageFile) => {
    if (!userIsAdmin) {
      showNotification('No tienes permisos para actualizar imágenes', 'error');
      return;
    }

    try {
      console.log('📷 Iniciando proceso de upload de imagen:', {
        productId,
        fileName: imageFile.name,
        fileSize: imageFile.size,
        fileType: imageFile.type
      });

      const uploadResponse = await UploadAPI.uploadImage(imageFile, {
        productId: productId,
        uploadType: 'product-image'
      });

      console.log('✅ Upload exitoso:', uploadResponse.data);

      let imageUrl = null;

      if (uploadResponse.data && uploadResponse.data.data && uploadResponse.data.data.imageUrl) {
        imageUrl = uploadResponse.data.data.imageUrl;
      } else if (uploadResponse.data && uploadResponse.data.imageUrl) {
        imageUrl = uploadResponse.data.imageUrl;
      } else if (uploadResponse.data && uploadResponse.data.data && uploadResponse.data.data.url) {
        imageUrl = uploadResponse.data.data.url;
      }

      if (!imageUrl) {
        throw new Error('No se pudo extraer la URL de la imagen de la respuesta del servidor');
      }

      console.log('🔗 URL de imagen extraída correctamente:', imageUrl);

      const asignado = await assignProductImage(productId, imageUrl);

      if (asignado) {
        setShowImageUpload(false);
        setSelectedProductForImage(null);
        console.log('🎉 Proceso completo: imagen subida y asignada exitosamente');
      }

    } catch (error) {
      console.error('❌ Error en proceso de upload:', error);
      const errorMessage = error.response?.data?.message ||
        error.message ||
        'Error al subir imagen';
      showNotification(errorMessage, 'error');
    }
  }, [userIsAdmin, showNotification, assignProductImage]);

  // **FUNCIONES DE GESTIÓN DE PRODUCTOS**
  const openProductDetails = useCallback((product) => {
    setSelectedProduct(product);
    const savedQuantity = productQuantities[product.product_id] || 1;
    setQuantity(savedQuantity);
    setModalVisible(true);
  }, [productQuantities]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const openEditProduct = useCallback((product) => {
    if (!userIsAdmin) {
      showNotification('No tienes permisos para editar productos', 'error');
      return;
    }
    console.log('✏️ Opening edit for product:', product);
    setEditingProduct(product);
    setShowProductForm(true);
  }, [userIsAdmin, showNotification]);

  const openImageUpload = useCallback((product) => {
    if (!userIsAdmin) {
      showNotification('No tienes permisos para actualizar imágenes', 'error');
      return;
    }
    console.log('📷 Opening image upload for product:', product);
    setSelectedProductForImage(product);
    setShowImageUpload(true);
  }, [userIsAdmin, showNotification]);

  // **FUNCIONES DE CANTIDAD**
  const updateQuantity = useCallback((productId, quantity) => {
    setProductQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, quantity)
    }));
  }, []);

  const handleQuantityChange = useCallback((productId, newValue) => {
    const numValue = parseInt(newValue, 10);
    const validQuantity = !isNaN(numValue) && numValue > 0 ? numValue : 1;

    setProductQuantities(prev => ({
      ...prev,
      [productId]: validQuantity
    }));

    if (selectedProduct && selectedProduct.product_id === productId) {
      setQuantity(validQuantity);
    }
  }, [selectedProduct]);

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

  // **FUNCIONES DE GESTIÓN DE SUCURSALES**
  const formatBranchOptions = useCallback((branchesData) => {
    return branchesData.map(branch => ({
      value: branch.id || branch.branch_id,
      label: branch.name || branch.branch_name,
      data: branch
    }));
  }, []);

  const formatBranchOptionLabel = useCallback((option) => {
    if (!option.data) return option.label;

    return (
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">{option.label}</span>
        <span className="text-sm text-gray-500">
          {option.data.address || option.data.direccion || 'Sin dirección'}
        </span>
      </div>
    );
  }, []);

  const handleBranchChange = useCallback((selectedOption) => {
    setSelectedBranch(selectedOption);

    if (selectedOption && selectedOption.data) {
      const address = selectedOption.data.address ||
        selectedOption.data.direccion ||
        selectedOption.data.full_address ||
        'Dirección no disponible';
      setBranchAddress(address);

      // **NUEVA FUNCIONALIDAD: Determinar zona de entrega**
      const municipalityCode = selectedOption.data.municipality_code ||
        selectedOption.data.dane_code;
      const cityName = selectedOption.data.city || selectedOption.data.ciudad;

      if (municipalityCode) {
        setMunicipalityCode(municipalityCode);
        const zone = getDeliveryZoneByDANECode(municipalityCode, cityName);

        if (zone) {
          setDeliveryZone(zone);
          showNotification(`Zona de entrega: ${zone.name}`, 'info');

          // Calcular fechas disponibles
          const dates = calculateAvailableDeliveryDates(zone, siteSettings?.orderTimeLimit);
          setAvailableDeliveryDays(dates);
        } else {
          setDeliveryZone(null);
          setAvailableDeliveryDays([]);
          showNotification('No se pudo determinar la zona de entrega para esta sucursal', 'warning');
        }
      }
    } else {
      setBranchAddress('');
      setDeliveryZone(null);
      setAvailableDeliveryDays([]);
      setMunicipalityCode(null);
      setDeliveryDate('');
    }
  }, [getDeliveryZoneByDANECode, calculateAvailableDeliveryDates, siteSettings, showNotification]);

  // **FUNCIONES DE PEDIDOS**
  const addToOrder = useCallback((product, qty = 1) => {
    if (!isAuthenticated) {
      showNotification('Debes iniciar sesión para añadir productos al pedido', 'error');
      return;
    }

    try {
      const quantityToAdd = Number(qty || productQuantities[product.product_id] || 1);
      const existingItemIndex = orderItems.findIndex(item => item.product_id === product.product_id);

      // **NUEVA LÓGICA: Usar precio personalizado si existe**
      const finalPrice = product.has_custom_price && product.custom_price_info
        ? product.custom_price_info.price
        : product.price_list1;

      const orderItem = {
        product_id: product.product_id,
        name: product.name,
        quantity: quantityToAdd,
        unit_price: finalPrice,
        price_source: product.price_list_code || 'default',
        has_custom_price: product.has_custom_price || false,
        original_price: product.original_price_list1 || product.price_list1
      };

      if (existingItemIndex >= 0) {
        const updatedItems = [...orderItems];
        updatedItems[existingItemIndex].quantity += quantityToAdd;
        setOrderItems(updatedItems);
      } else {
        setOrderItems([...orderItems, orderItem]);
      }

      showNotification(`${product.name} agregado al pedido`);
      if (modalVisible) closeModal();
    } catch (error) {
      console.error('Error adding to order:', error);
      showNotification('Error al agregar al pedido', 'error');
    }
  }, [orderItems, modalVisible, closeModal, showNotification, productQuantities, isAuthenticated]);

  const removeFromOrder = useCallback((productId) => {
    setOrderItems(prevItems =>
      prevItems.filter(item => item.product_id !== productId)
    );
    showNotification('Producto eliminado del pedido');
  }, [showNotification]);

  const calculateOrderTotal = useCallback(() => {
    const total = orderItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    setOrderTotal(total);
  }, [orderItems]);

  const submitOrder = useCallback(async () => {
    if (!isAuthenticated) {
      showNotification('Debes iniciar sesión para realizar un pedido', 'error');
      return;
    }

    if (orderItems.length === 0) {
      showNotification('No hay productos en el pedido', 'error');
      return;
    }

    if (!selectedBranch) {
      showNotification('Debes seleccionar una sucursal para continuar', 'error');
      return;
    }

    // **NUEVA VALIDACIÓN: Zona de entrega**
    if (!deliveryZone) {
      showNotification('No se pudo determinar la zona de entrega para la sucursal seleccionada', 'error');
      return;
    }

    if (!deliveryDate) {
      showNotification('Selecciona una fecha de entrega válida', 'error');
      return;
    }

    // **NUEVA VALIDACIÓN: Fecha disponible para la zona**
    if (availableDeliveryDays.length > 0) {
      const selectedDate = new Date(deliveryDate);
      const isDateAvailable = availableDeliveryDays.some(date =>
        date.toDateString() === selectedDate.toDateString()
      );

      if (!isDateAvailable) {
        showNotification(`La fecha seleccionada no está disponible para entregas en ${deliveryZone.name}`, 'error');
        return;
      }
    }

    // Cálculos financieros
    const subtotal = calculateSubtotal();
    const iva = calculateIVA(subtotal);
    const shipping = calculateShipping(subtotal);

    // **NUEVA VALIDACIÓN: Monto mínimo con IVA**
    if (subtotal < MIN_ORDER_AMOUNT) {
      showNotification(`El monto mínimo para crear un pedido es ${formatCurrency(MIN_ORDER_AMOUNT)} (sin IVA)`, 'error');
      return;
    }

    const isValid = orderItems.every(item =>
      item.product_id &&
      item.quantity > 0 &&
      item.unit_price > 0
    );

    if (!isValid) {
      showNotification('Por favor revisa los productos del pedido. Todos deben tener cantidades y precios válidos.', 'error');
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
        user_id: userId,
        total_amount: shipping !== null ? subtotal + iva + shipping : subtotal + iva,
        subtotal_amount: subtotal,
        iva_amount: iva,
        shipping_amount: shipping || 0,
        delivery_date: deliveryDate,
        branch_id: selectedBranch.value,
        branch_name: selectedBranch.label,
        branch_address: branchAddress,
        delivery_zone: deliveryZone.key,
        delivery_zone_name: deliveryZone.name,
        municipality_code: municipalityCode,
        price_list_code: userPriceListCode || 'GENERAL',
        has_custom_pricing: customPricesApplied,
        details: orderItems.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
          price_source: item.price_source || 'default',
          original_unit_price: parseFloat(item.original_price || item.unit_price)
        }))
      };

      const response = await API.post('/orders', orderData);

      if (response.data.success) {
        showNotification('Pedido creado exitosamente');
        setOrderItems([]);
        setOrderTotal(0);
        setDeliveryDate('');
        setSelectedBranch(null);
        setBranchAddress('');
        setDeliveryZone(null);
        setAvailableDeliveryDays([]);
      } else {
        throw new Error(response.data.message || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error('❌ Error submitting order:', error);
      showNotification(
        error.response?.data?.message || 'Error al crear el pedido',
        'error'
      );
    } finally {
      setSubmittingOrder(false);
    }
  }, [orderItems, deliveryDate, selectedBranch, branchAddress, deliveryZone, availableDeliveryDays, municipalityCode, userPriceListCode, customPricesApplied, calculateSubtotal, calculateIVA, calculateShipping, formatCurrency, getCurrentUserId, isAuthenticated, showNotification]);

  // **DATOS COMPUTADOS**
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return products.slice(startIndex, startIndex + itemsPerPage);
  }, [products, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(products.length / itemsPerPage);

  // **CÁLCULOS FINANCIEROS COMPUTADOS**
  const subtotal = calculateSubtotal();
  const iva = calculateIVA(subtotal);
  const shipping = calculateShipping(subtotal);
  const total = shipping !== null ? subtotal + iva + shipping : subtotal + iva;

  // **VERIFICAR SI HAY PRECIOS PERSONALIZADOS**
  const hasCustomPrices = useMemo(() => {
    return products.some(product => product.has_custom_price);
  }, [products]);

  // **EFFECTS**
  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
    }
  }, [fetchProducts, isAuthenticated]);

  useEffect(() => {
    calculateOrderTotal();
  }, [orderItems, calculateOrderTotal]);

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

  useEffect(() => {
    if (products.length > 0) {
      const initialQuantities = {};
      products.forEach(product => {
        initialQuantities[product.product_id] = 1;
      });
      setProductQuantities(initialQuantities);
    }
  }, [products]);

  useEffect(() => {
    const loadBranches = async () => {
      if (isAuthenticated && user) {
        console.log('🔄 Cargando sucursales para usuario:', user);
        const branchesData = await fetchBranches();

        if (branchesData && branchesData.length > 0) {
          const options = formatBranchOptions(branchesData);
          setBranchOptions(options);
          console.log('✅ Opciones de sucursales configuradas:', options);
        } else {
          console.warn('⚠️ No se encontraron sucursales para el usuario');
          setBranchOptions([]);
        }
      }
    };

    loadBranches();
  }, [isAuthenticated, user, fetchBranches, formatBranchOptions]);

  // **PROTECCIÓN DE AUTENTICACIÓN**
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FiShoppingCart className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Acceso Requerido
          </h3>
          <p className="text-gray-600 mb-6">
            Debes iniciar sesión para acceder al catálogo de productos.
          </p>
          <Button
            onClick={() => window.location.href = '/login'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  // **COMPONENTE INDICADOR DE LISTA DE PRECIOS**
  const PriceListIndicator = () => {
    if (!userPriceListCode || userPriceListCode === 'GENERAL') return null;

    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center">
          <FiInfo className="text-blue-500 mr-2" />
          <span className="text-blue-700 text-sm">
            {customPricesApplied ? (
              <>
                <strong>Lista de precios activa: {userPriceListCode}</strong>
                <span className="ml-2 text-green-600">• Precios personalizados aplicados</span>
              </>
            ) : (
              <>
                <strong>Lista asignada: {userPriceListCode}</strong>
                <span className="ml-2 text-amber-600">• Usando precios por defecto</span>
              </>
            )}
          </span>
        </div>
        {pricesLoading && (
          <div className="mt-2 flex items-center text-sm text-blue-600">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
            Cargando precios personalizados...
          </div>
        )}
      </div>
    );
  };

  // **COMPONENTE PARA MOSTRAR PRECIOS**
  const PriceDisplay = ({ product, showOriginalPrice = false, adminMode = false }) => {
    const renderCustomPriceBadge = () => {
      if (!product.has_custom_price) return null;

      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">
          Precio Personalizado
        </span>
      );
    };

    const renderPriceUnavailable = () => (
      <div className="text-red-600 font-medium">
        <span>Precio no disponible</span>
        <div className="text-xs text-gray-500">
          Contacta al administrador
        </div>
      </div>
    );

    if (!product.price_list1 || product.price_list1 <= 0) {
      return renderPriceUnavailable();
    }

    return (
      <div className="price-display">
        <div className="font-bold text-lg text-indigo-600">
          {formatCurrency(product.price_list1)}
          {renderCustomPriceBadge()}
        </div>

        {/* Mostrar precio original si es diferente */}
        {showOriginalPrice && product.has_custom_price && product.original_price_list1 !== product.price_list1 && (
          <div className="text-sm text-gray-500 line-through">
            Original: {formatCurrency(product.original_price_list1)}
          </div>
        )}

        {/* Modo admin: mostrar precios adicionales */}
        {adminMode && (
          <div className="mt-1 space-y-1">
            {product.price_list2 > 0 && (
              <div className="text-sm text-gray-600">
                Lista 2: {formatCurrency(product.price_list2)}
              </div>
            )}
            {product.price_list_code && (
              <div className="text-xs text-blue-600">
                Lista: {product.price_list_code}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // **RENDER PRINCIPAL**
  return (
    <div className="min-h-screen bg-gray-50">
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ show: false, message: '', type: '' })}
        />
      )}

      <div className="container mx-auto px-4 py-6">
        {/* **HEADER CON CONTROLES ADMINISTRATIVOS** */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-8 space-y-4 lg:space-y-0">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              {adminMode ? 'Administración de Productos' : 'Selecciona los productos para tu pedido SAP'}
            </h1>
            <p className="text-sm lg:text-base text-gray-600">
              {adminMode
                ? 'Gestiona el inventario y configura productos'
                : 'Explora el catálogo y añade productos a tu orden'
              }
            </p>
          </div>

          {userIsAdmin && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setAdminMode(!adminMode)}
                className={`flex items-center px-4 py-2 rounded-lg transition-all duration-200 border ${adminMode
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 border-2'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {adminMode ? (
                  <>
                    <FiToggleRight className="mr-2 text-indigo-600 w-5 h-5" />
                    <span className="font-medium">Modo Admin ON</span>
                  </>
                ) : (
                  <>
                    <FiToggleLeft className="mr-2 text-gray-400 w-5 h-5" />
                    <span>Modo Admin OFF</span>
                  </>
                )}
              </button>

              {adminMode && (
                <Button
                  onClick={() => setShowProductForm(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  <FiPlus className="mr-2 w-4 h-4" />
                  Crear Producto
                </Button>
              )}
            </div>
          )}
        </div>

        {/* **NUEVA SECCIÓN: Información de precios** */}
        <PriceListIndicator />

        {/* **INFORMACIÓN DE DEBUG** */}
        {import.meta.env.DEV && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Debug AuthContext:</strong> Usuario: {user?.name || user?.nombre} |
              Email: {user?.mail || user?.email} |
              Role: {user?.role} | Rol: {user?.rol} |
              Es Admin: {userIsAdmin ? 'SÍ' : 'NO'} |
              Modo Admin: {adminMode ? 'ACTIVADO' : 'DESACTIVADO'} |
              Autenticado: {isAuthenticated ? 'SÍ' : 'NO'} |
              Lista Precios: {userPriceListCode || 'GENERAL'} |
              Precios Aplicados: {customPricesApplied ? 'SÍ' : 'NO'}
            </p>
            <p className="text-sm text-purple-800 mt-1">
              <strong>Debug Delivery:</strong>
              Sucursal: {selectedBranch?.label || 'Ninguna'} |
              Zona: {deliveryZone?.name || 'No definida'} |
              Fechas disponibles: {availableDeliveryDays.length} |
              Fecha seleccionada: {deliveryDate || 'Ninguna'}
            </p>
          </div>
        )}

        {/* **INFORMACIÓN DE PRODUCTOS** */}
        {!loading && products.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, products.length)} de {products.length} productos
          </div>
        )}

        {/* **RESUMEN DE PEDIDO MEJORADO** */}
        {!adminMode && orderItems.length > 0 && (
          <div className="mb-8 transform transition-all duration-300 hover:scale-[1.01]">
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
                      {selectedBranch && (
                        <p className="text-sm text-indigo-600">
                          📍 {selectedBranch.label}
                        </p>
                      )}
                      {deliveryZone && (
                        <p className="text-sm text-green-600">
                          🚚 {deliveryZone.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-auto">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Subtotal: {formatCurrency(subtotal)}</div>
                      <div className="text-sm text-gray-600">IVA (19%): {formatCurrency(iva)}</div>
                      <div className="text-sm text-gray-600">
                        Flete: {shipping === 0 ? 'Gratis' : shipping ? formatCurrency(shipping) : 'No aplica'}
                      </div>
                      <div className="text-xl font-bold text-primary-300 border-t pt-1">
                        Total: {formatCurrency(total)}
                      </div>
                    </div>
                    <Button
                      className={`transition-all duration-200 transform active:scale-95 ${submittingOrder ? 'opacity-75' : ''} 
                      bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium`}
                      onClick={submitOrder}
                      disabled={orderItems.length === 0 || submittingOrder || !selectedBranch || !deliveryDate}
                    >
                      <span className="flex items-center gap-2">
                        {submittingOrder ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Procesando...
                          </>
                        ) : (
                          <>
                            Finalizar Pedido
                            <FiCheck className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* **PRODUCTOS SELECCIONADOS** */}
              {orderItems.length > 0 && (
                <div className="mt-6 border-t pt-4 px-5 pb-5">
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
                            {item.has_custom_price && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                Precio Personalizado
                              </span>
                            )}
                          </p>
                          <div className="flex gap-4 mt-1">
                            <span className="text-sm text-gray-600">
                              Cantidad: {item.quantity}
                            </span>
                            <span className="text-sm text-gray-600">
                              Precio Unit.: {formatCurrency(item.unit_price)}
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
            </Card>
          </div>
        )}

        {/* **SELECTOR DE SUCURSALES MEJORADO** */}
        {!adminMode && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecciona tu sucursal
            </label>

            {loadingBranches ? (
              <div className="flex items-center justify-center p-4 border border-gray-300 rounded-md bg-gray-50">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                <span className="text-sm text-gray-600">Cargando sucursales...</span>
              </div>
            ) : branchError ? (
              <div className="p-3 border border-red-300 rounded-md bg-red-50">
                <p className="text-sm text-red-600">Error al cargar sucursales: {branchError}</p>
                <button
                  onClick={fetchBranches}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 underline"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <Select
                value={selectedBranch}
                onChange={handleBranchChange}
                options={branchOptions}
                formatOptionLabel={formatBranchOptionLabel}
                placeholder="Selecciona una sucursal"
                isClearable
                className="w-full"
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: '#D1D5DB',
                    boxShadow: 'none',
                    '&:hover': { borderColor: '#4F46E5' }
                  }),
                  option: (base) => ({
                    ...base,
                    padding: '12px 16px'
                  })
                }}
              />
            )}

            {!selectedBranch && (
              <p className="text-red-500 text-xs mt-1">Selecciona una sucursal para continuar</p>
            )}
          </div>
        )}

        {/* **MOSTRAR DIRECCIÓN DE SUCURSAL SELECCIONADA** */}
        {!adminMode && selectedBranch && (
          <div className="mb-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Dirección de la sucursal
                </label>
                <input
                  type="text"
                  value={branchAddress}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                  readOnly
                />
              </div>
              {deliveryZone && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center">
                    <FiCheck className="text-green-500 mr-2" />
                    <span className="text-sm text-green-700">
                      <strong>Zona de entrega determinada:</strong> {deliveryZone.name}
                    </span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Entregas disponibles: {deliveryZone.days.map(day => {
                      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                      return dayNames[day];
                    }).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* **FECHA DE ENTREGA MEJORADA** */}
        {!adminMode && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Fecha de entrega
            </label>

            {calculatingDates && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm text-blue-700">
                    Calculando fechas disponibles para {selectedBranch?.label}...
                  </span>
                </div>
              </div>
            )}

            <DeliveryDatePicker
              value={deliveryDate}
              onChange={setDeliveryDate}
              orderTimeLimit={siteSettings?.orderTimeLimit || '18:00'}
              availableDates={availableDeliveryDays}
              deliveryZone={deliveryZone}
            />

            {!deliveryDate && !calculatingDates && (
              <p className="text-red-500 text-xs mt-1">Selecciona una fecha de entrega</p>
            )}
          </div>
        )}

        {/* **BARRA DE BÚSQUEDA Y CONTROLES** */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-3">
            <div className="relative flex items-center bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-3">
                <FiSearch className="w-5 h-5 text-gray-400" />
              </div>
              <Input
                placeholder="Busca por nombre, código o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 shadow-none focus:ring-0 py-3 px-0 w-full bg-transparent"
              />
              {search && (
                <button
                  className="px-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearch('')}
                >
                  <FiX />
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-between lg:justify-end gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${viewMode === 'table'
                ? 'bg-white text-indigo-700 shadow-md border border-gray-200'
                : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-500 border border-transparent'
                }`}
              aria-label="Ver productos en formato lista"
            >
              <FiList className={`mr-2 w-4 h-4 ${viewMode === 'table' ? 'text-indigo-500' : ''}`} />
              <span className="text-sm font-medium">Lista</span>
            </button>

            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${viewMode === 'cards'
                ? 'bg-white text-indigo-700 shadow-md border border-gray-200'
                : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-500 border border-transparent'
                }`}
              aria-label="Ver productos en formato Miniaturas / Fotos y descripción detallada de producto"
            >
              <FiGrid className={`mr-2 w-4 h-4 ${viewMode === 'cards' ? 'text-indigo-500' : ''}`} />
              <span className="text-sm font-medium">Miniaturas</span>
            </button>
          </div>
        </div>

        {/* **VISTA DE TABLA MEJORADA** */}
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                    {!adminMode && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    )}
                    {adminMode && (
                      <>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado SAP</th>
                      </>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <tr key={product.product_id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">
                              {product.sap_code || product.code || `ID: ${product.product_id}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <ProductImage
                            src={product.image_url || product.image}
                            alt={product.name}
                            productId={product.product_id}
                            className="h-12 w-12"
                          />

                          {adminMode && userIsAdmin && (
                            <button
                              onClick={() => openImageUpload(product)}
                              className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors duration-200"
                              title="Subir imagen"
                            >
                              <FiUpload className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriceDisplay
                          product={product}
                          showOriginalPrice={true}
                          adminMode={adminMode}
                        />
                      </td>

                      {!adminMode && (
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
                      )}

                      {adminMode && (
                        <>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${product.stock > 10
                              ? 'bg-green-100 text-green-800'
                              : product.stock > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                              }`}>
                              {product.stock || 0} unidades
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              {product.sap_code && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  SAP: {product.sap_code}
                                </span>
                              )}
                              {product.sap_sync_pending && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                  Sync Pendiente
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

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

                          {adminMode && userIsAdmin ? (
                            <>
                              <Button
                                onClick={() => openEditProduct(product)}
                                className="px-3 py-1 text-sm text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors duration-200"
                              >
                                <FiEdit className="mr-1 w-3 h-3" /> Editar
                              </Button>
                              <Button
                                onClick={() => handleDeleteProduct(product.product_id)}
                                className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors duration-200"
                              >
                                <FiTrash2 className="mr-1 w-3 h-3" /> Eliminar
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="transition-transform active:scale-95 bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => addToOrder(product, productQuantities[product.product_id] || 1)}
                              disabled={!isAuthenticated}
                            >
                              <FiPlus className="mr-1" /> Añadir
                            </Button>
                          )}
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

        {/* **VISTA DE TARJETAS MEJORADA** */}
        {viewMode === 'cards' && (
          <div className={`${loading ? 'flex justify-center items-center min-h-[300px]' : ''}`}>
            {loading ? (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-gray-600">Cargando productos...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedProducts.map((product) => (
                  <div
                    key={product.product_id}
                    className="rounded-lg overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 bg-white"
                  >
                    <div className="relative">
                      <ProductImage
                        src={product.image_url || product.image}
                        alt={product.name}
                        productId={product.product_id}
                        className="w-full h-48"
                      />

                      {adminMode && userIsAdmin && (
                        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
                          <button
                            onClick={() => openImageUpload(product)}
                            className="bg-white text-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors mr-2"
                            title="Cambiar imagen"
                          >
                            <FiUpload className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditProduct(product)}
                            className="bg-white text-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                            title="Editar producto"
                          >
                            <FiEdit className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="absolute top-3 left-3 flex flex-col gap-1">
                        {adminMode && product.stock <= 5 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Stock Bajo
                          </span>
                        )}
                        {product.sap_code && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            SAP: {product.sap_code}
                          </span>
                        )}
                        {product.has_custom_price && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Precio Personalizado
                          </span>
                        )}
                      </div>
                    </div>

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

                      {adminMode && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Stock:</span>
                            <span className={`font-medium ${product.stock > 10
                              ? 'text-green-600'
                              : product.stock > 0
                                ? 'text-yellow-600'
                                : 'text-red-600'
                              }`}>
                              {product.stock || 0} unidades
                            </span>
                          </div>

                          {product.price_list2 > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Lista 2:</span>
                              <span className="font-medium text-gray-800">
                                {formatCurrency(product.price_list2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                        <PriceDisplay
                          product={product}
                          showOriginalPrice={false}
                          adminMode={adminMode}
                        />

                        {!adminMode && (
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
                        )}
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

                        {adminMode && userIsAdmin ? (
                          <Button
                            onClick={() => handleDeleteProduct(product.product_id)}
                            className="flex-1 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors duration-200"
                          >
                            <FiTrash2 className="mr-1 w-3 h-3" /> Eliminar
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1 transition-transform active:scale-95 bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => addToOrder(product, productQuantities[product.product_id] || 1)}
                            disabled={!isAuthenticated}
                          >
                            <FiPlus className="mr-1" /> Añadir
                          </Button>
                        )}
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

        {/* **PAGINACIÓN** */}
        {!loading && products.length > 0 && (
          <div className="flex flex-col items-center mt-4 mb-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <button
                onClick={() => paginate(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
              >
                {'<'}
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange(currentPage, totalPages).map((pageNumber, index) =>
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
                onClick={() => paginate(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
              >
                {'>'}
              </button>
            </div>

            <div className="text-center font-bold text-gray-700">
              Página actual: {currentPage}
            </div>
          </div>
        )}
      </div>

      {/* **MODALES** */}
      {/* Modal de detalles del producto */}
      <Modal
        isOpen={modalVisible}
        onClose={closeModal}
        title={selectedProduct?.name || 'Detalle del Producto'}
      >
        {selectedProduct && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2">
              <ProductImage
                src={selectedProduct.image_url || selectedProduct.image}
                alt={selectedProduct.name}
                productId={selectedProduct.product_id}
                className="w-full h-auto"
              />
            </div>
            <div className="w-full md:w-1/2">
              <h2 className="text-2xl font-bold mb-2 text-gray-900">{selectedProduct.name}</h2>
              <div className="mb-4 pb-4 border-b border-gray-200">
                <span className="inline-block px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">
                  Código: {selectedProduct.sap_code || selectedProduct.code || selectedProduct.product_id}
                </span>
                {selectedProduct.has_custom_price && (
                  <span className="inline-block px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-800 ml-2">
                    Precio Personalizado ({selectedProduct.price_list_code})
                  </span>
                )}
              </div>
              <p className="mb-6 text-gray-700">
                {selectedProduct.description || 'Sin descripción disponible para este producto.'}
              </p>
              <div className="mb-6 p-4 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600">Precio:</span>
                  <div className="text-right">
                    <div className="text-xl font-bold text-indigo-600">
                      {formatCurrency(selectedProduct.price_list1)}
                    </div>
                    {selectedProduct.has_custom_price && selectedProduct.original_price_list1 !== selectedProduct.price_list1 && (
                      <div className="text-sm text-gray-500 line-through">
                        Original: {formatCurrency(selectedProduct.original_price_list1)}
                      </div>
                    )}
                  </div>
                </div>
                {!adminMode && isAuthenticated && (
                  <>
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
                  </>
                )}
                {!isAuthenticated && (
                  <div className="text-center py-4">
                    <p className="text-gray-600 mb-4">Inicia sesión para añadir productos al pedido</p>
                    <Button
                      onClick={() => window.location.href = '/login'}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                    >
                      Iniciar Sesión
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de formulario de producto */}
      <Modal
        isOpen={showProductForm}
        onClose={() => {
          setShowProductForm(false);
          setEditingProduct(null);
        }}
        title={editingProduct ? 'Editar Producto' : 'Crear Producto'}
      >
        <ProductFormSimple
          product={editingProduct}
          onSubmit={editingProduct ?
            (data) => handleUpdateProduct(editingProduct.product_id, data) :
            handleCreateProduct
          }
          onCancel={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
        />
      </Modal>

      {/* Modal de subida de imagen */}
      <Modal
        isOpen={showImageUpload}
        onClose={() => {
          setShowImageUpload(false);
          setSelectedProductForImage(null);
        }}
        title="Actualizar Imagen del Producto"
      >
        <ImageUploadSimple
          product={selectedProductForImage}
          onUpload={(file) => handleImageUpload(selectedProductForImage.product_id, file)}
          onCancel={() => {
            setShowImageUpload(false);
            setSelectedProductForImage(null);
          }}
        />
      </Modal>
    </div>
  );
};

// **COMPONENTES AUXILIARES**
const ProductFormSimple = ({ product, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    priceList1: product?.price_list1?.toString() || '',
    priceList2: product?.price_list2?.toString() || '',
    priceList3: product?.price_list3?.toString() || '',
    stock: product?.stock?.toString() || '',
    barcode: product?.barcode || ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.priceList1 || isNaN(formData.priceList1) || parseFloat(formData.priceList1) < 0) {
      newErrors.priceList1 = 'El precio debe ser un número válido mayor a 0';
    }

    if (formData.stock && (isNaN(formData.stock) || parseInt(formData.stock) < 0)) {
      newErrors.stock = 'El stock debe ser un número válido mayor o igual a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        priceList1: parseFloat(formData.priceList1) || 0,
        priceList2: parseFloat(formData.priceList2) || 0,
        priceList3: parseFloat(formData.priceList3) || 0,
        stock: parseInt(formData.stock) || 0,
        barcode: formData.barcode.trim()
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Producto *
          </label>
          <Input
            value={formData.name}
            onChange={handleChange('name')}
            placeholder="Ingrese el nombre del producto"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            value={formData.description}
            onChange={handleChange('description')}
            placeholder="Descripción detallada del producto"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código SAP
          </label>
          <Input
            value={formData.sap_code}
            onChange={handleChange('sap_code')}
            placeholder="Código SAP del producto"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código de Barras
          </label>
          <Input
            value={formData.barcode}
            onChange={handleChange('barcode')}
            placeholder="Código de barras del producto"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Lista 1 (Principal) *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.priceList1}
            onChange={handleChange('priceList1')}
            placeholder="0.00"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.priceList1 ? 'border-red-300' : 'border-gray-300'}`}
          />
          {errors.priceList1 && (
            <p className="mt-1 text-sm text-red-600">{errors.priceList1}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Lista 2 (Mayorista)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.priceList2}
            onChange={handleChange('priceList2')}
            placeholder="0.00"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.priceList2 ? 'border-red-300' : 'border-gray-300'}`}
          />
          {errors.priceList2 && (
            <p className="mt-1 text-sm text-red-600">{errors.priceList2}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Lista 3 (Especial)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.priceList3}
            onChange={handleChange('priceList3')}
            placeholder="0.00"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.priceList3 ? 'border-red-300' : 'border-gray-300'}`}
          />
          {errors.priceList3 && (
            <p className="mt-1 text-sm text-red-600">{errors.priceList3}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stock Inicial
          </label>
          <Input
            type="number"
            min="0"
            value={formData.stock}
            onChange={handleChange('stock')}
            placeholder="0"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.stock ? 'border-red-300' : 'border-gray-300'}`}
          />
          {errors.stock && (
            <p className="mt-1 text-sm text-red-600">{errors.stock}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
        >
          <FiX className="mr-2 w-4 h-4" />
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors duration-200 disabled:opacity-50"
        >
          <FiSave className="mr-2 w-4 h-4" />
          {loading ? 'Guardando...' : (product ? 'Actualizar' : 'Crear')} Producto
        </Button>
      </div>
    </form>
  );
};

const ImageUploadSimple = ({ product, onUpload, onCancel }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, GIF)');
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Tamaño máximo: 5MB');
      return;
    }

    setSelectedFile(file);

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await onUpload(selectedFile);
      // El modal se cerrará desde el componente padre si la subida es exitosa
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir la imagen. Por favor intenta nuevamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileSelect(fakeEvent);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  return (
    <div className="space-y-6">
      {/* Información del producto */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900">{product?.name}</h3>
        <p className="text-sm text-gray-600">
          Código: {product?.sap_code || product?.code || product?.product_id}
        </p>
        {product?.image_url && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-2">Imagen actual:</p>
            <ProductImage
              src={product.image_url}
              alt={product.name}
              productId={product.product_id}
              className="h-16 w-16 rounded-md"
            />
          </div>
        )}
      </div>

      {/* Área de drag & drop */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
      >
        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 max-w-full mx-auto rounded-lg shadow-md"
            />
            <div className="flex justify-center space-x-2">
              <Button
                type="button"
                onClick={handleRemoveFile}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <FiX className="mr-1 w-3 h-3" />
                Cambiar imagen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FiImage className="mx-auto w-12 h-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900">
                Selecciona una imagen
              </p>
              <p className="text-sm text-gray-600">
                Arrastra y suelta aquí, o haz clic para seleccionar
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Formatos soportados: PNG, JPG, GIF (máximo 5MB)
              </p>
            </div>
            <Button
              type="button"
              onClick={() => document.querySelector('input[type="file"]').click()}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <FiUpload className="mr-2 w-4 h-4" />
              Seleccionar Archivo
            </Button>
          </div>
        )}
      </div>

      {/* Input file oculto */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Información del archivo seleccionado */}
      {selectedFile && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-blue-700">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type}
              </p>
            </div>
            <FiCheck className="text-blue-600 w-5 h-5" />
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <FiX className="mr-2 w-4 h-4" />
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Subiendo imagen...
            </>
          ) : (
            <>
              <FiUpload className="mr-2 w-4 h-4" />
              Subir Imagen
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Products;