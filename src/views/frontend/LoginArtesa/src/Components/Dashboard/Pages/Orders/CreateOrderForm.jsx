import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Select from 'react-select';
import { useAuth } from '../../../../hooks/useAuth';
import { useUserActivation } from '../../../../hooks/useUserActivation';
import { orderService } from '../../../../services/orderService';
import UserActivationStatus from '../../../UserActivationStatus';
import API from '../../../../api/config';
import DeliveryDatePicker from './DeliveryDatePicker';
import OrderFileUpload from './OrderFileUpload';
import Notification from '../../../../Components/ui/Notification';
import { useNavigate } from 'react-router-dom';
import usePriceList from '../../../../hooks/usePriceList';

const CreateOrderForm = ({ onOrderCreated }) => {
  const { user } = useAuth();
  const {
    userPriceListCode,
    priceCache,
    loading: pricesLoading,
    fetchMultiplePrices,
    getProductPrice
  } = usePriceList(); // AÑADIR ESTAS LÍNEAS
  // Remover useOrderFormValidation duplicado - usar solo useUserActivation
  const { userStatus } = useUserActivation();
  // Debug para diagnosticar el problema
  useEffect(() => {
    console.log('🔍 CreateOrderForm montado - Estado inicial:', {
      userStatus: {
        loading: userStatus.loading,
        canCreateOrders: userStatus.canCreateOrders,
        isActive: userStatus.isActive,
        hasClientProfile: userStatus.hasClientProfile,
        statusMessage: userStatus.statusMessage
      },
      isValidating,
      canAccessForm
    });
  }, []); // Solo en mount

  // Estados de validación simplificados basados en useUserActivation
  const isValidating = userStatus.loading;
  const canAccessForm = userStatus.canCreateOrders && !userStatus.loading;
  const validationResult = {
    errors: !userStatus.canCreateOrders && !userStatus.loading ? [{
      type: 'ACCESS_DENIED',
      message: userStatus.statusMessage || 'No puedes crear pedidos en este momento',
      action: !userStatus.hasClientProfile ? 'COMPLETE_PROFILE' : 'CONTACT_SUPPORT',
      redirectTo: '/dashboard/profile/client-info'
    }] : [],
    warnings: []
  };

  // Debug simplificado
  useEffect(() => {
    console.log('🔍 CreateOrderForm - Estado simplificado:', {
      isValidating,
      canAccessForm,
      userCanCreate: userStatus.canCreateOrders,
      userActive: userStatus.isActive,
      hasProfile: userStatus.hasClientProfile,
      userId: user?.id
    });
  }, [isValidating, canAccessForm, userStatus, user?.id]);

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
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchAddress, setBranchAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryZone, setDeliveryZone] = useState(null);
  const [availableDeliveryDays, setAvailableDeliveryDays] = useState([]);
  const navigate = useNavigate();

  const MIN_ORDER_AMOUNT = 50000;
  const SHIPPING_CHARGE = 10000;
  const SHIPPING_LIMIT = 50000;
  const SHIPPING_FREE_LIMIT = 80000;
  const IVA_RATE = 0.19;

  const DELIVERY_ZONES = {
    'MIERCOLES_SABADO': {
      name: 'Miércoles y Sábado',
      days: [3, 6],
      municipalities: [
        '25175', '25126', '25758', '25899', '25214', '25322', '25295', '25799'
      ],
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

  const getDeliveryZoneByDANECode = (daneCode, cityName = '') => {
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
  };

  const getCityNameByDANECode = (daneCode) => {
    const municipalityMap = {
      '25175': 'Chía',
      '25126': 'Cajicá',
      '25758': 'Sopó',
      '25899': 'Zipaquirá',
      '25214': 'Cota',
      '25322': 'Guasca',
      '25295': 'Gachancipá',
      '25799': 'Tenjo',
      '25754': 'Soacha',
      '25473': 'Mosquera',
      '25430': 'Madrid',
      '25286': 'Funza',
      '11001': 'Bogotá D.C'
    };

    return municipalityMap[daneCode] || 'Ciudad no identificada';
  };

  const calculateAvailableDeliveryDates = (zone, orderTimeLimit = '18:00') => {
    if (!zone) return [];

    const today = new Date();
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const [limitHour, limitMinute] = orderTimeLimit.split(':').map(Number);

    const isAfterLimit = currentHour > limitHour ||
      (currentHour === limitHour && currentMinute > limitMinute);

    let additionalDays = 2;
    const currentDay = today.getDay();

    if (isAfterLimit) {
      additionalDays += 1;
    }

    if (currentDay === 6) {
      if (isAfterLimit) {
        additionalDays = 4;
      } else {
        additionalDays = 3;
      }
    } else if (currentDay === 0) {
      additionalDays = 3;
    }

    const availableDates = [];
    const maxDaysToCheck = 30;

    for (let i = additionalDays; i <= maxDaysToCheck; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      const dayOfWeek = checkDate.getDay();

      if (zone.days.includes(dayOfWeek)) {
        availableDates.push(new Date(checkDate));
      }
    }

    return availableDates;
  };

  const formatBranchOptionLabel = ({ value, label, address, municipality_code, city }) => {
    const municipalityName = getCityNameByDANECode(municipality_code);

    return (
      <div className="flex flex-col">
        <div className="font-medium text-sm text-gray-800">{label}</div>
        <div className="text-xs text-gray-500">{address}</div>
        <div className="text-xs text-blue-600">
          {municipalityName || city || 'Municipio no identificado'}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!canAccessForm) return;

    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const response = await API.get('/products');
        if (response.data.success && Array.isArray(response.data.data)) {
          const fetchedProducts = response.data.data.map(p => ({
            ...p,
            image_url: p.image_url || null
          }));

          // **NUEVA LÓGICA: Si hay lista de precios personalizada, obtener precios**
          if (userPriceListCode && userPriceListCode !== 'GENERAL' && fetchedProducts.length > 0) {
            try {
              console.log('🔄 Fetching custom prices for list:', userPriceListCode);
              const productCodes = fetchedProducts.map(p =>
                p.sap_code || p.code || p.product_id.toString()
              );

              const customPrices = await fetchMultiplePrices(productCodes);

              const productsWithCustomPrices = fetchedProducts.map(product => {
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

              // Filtrar productos con precios válidos
              const productsWithValidPrices = productsWithCustomPrices.filter(product => {
                const price = product.has_custom_price && product.custom_price_info
                  ? product.custom_price_info.price
                  : product.price_list1;
                return price > 0;
              });

              setProducts(productsWithValidPrices);
              console.log('✅ Products loaded with custom prices:', productsWithValidPrices.length);
            } catch (priceError) {
              console.warn('⚠️ Error loading custom prices, using default prices:', priceError);
              // Filtrar productos con precios válidos (precio por defecto)
              const productsWithValidPrices = fetchedProducts.filter(product => product.price_list1 > 0);
              setProducts(productsWithValidPrices);
            }
          } else {
            // Filtrar productos con precios válidos (precio por defecto)
            const productsWithValidPrices = fetchedProducts.filter(product => product.price_list1 > 0);
            setProducts(productsWithValidPrices);
          }
        } else {
          showNotification('No se pudieron cargar los productos', 'error');
          setProducts([]);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        showNotification('Error al cargar productos', 'error');
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, [canAccessForm, userPriceListCode, fetchMultiplePrices]);

  useEffect(() => {
    if (!canAccessForm || !user || !user.id) return;

    const fetchBranches = async () => {
      try {
        const response = await API.get(`/client-branches/user/${user.id}`);
        if (response.data.success && Array.isArray(response.data.data)) {
          setBranches(response.data.data);
        } else {
          setBranches([]);
        }
      } catch (error) {
        setBranches([]);
      }
    };
    fetchBranches();
  }, [user, canAccessForm]);

  const branchOptions = useMemo(() => {
    return branches.map(branch => ({
      value: branch.branch_id,
      label: branch.branch_name,
      address: branch.address,
      city: branch.city || '',
      municipality_code: branch.municipality_code,
      municipality_name: getCityNameByDANECode(branch.municipality_code)
    }));
  }, [branches]);

  useEffect(() => {
    if (deliveryZone && siteSettings.orderTimeLimit) {
      const dates = calculateAvailableDeliveryDates(deliveryZone, siteSettings.orderTimeLimit);
      setAvailableDeliveryDays(dates);

      if (deliveryDate) {
        const selectedDate = new Date(deliveryDate);
        const isDateAvailable = dates.some(date =>
          date.toDateString() === selectedDate.toDateString()
        );
        if (!isDateAvailable) {
          setDeliveryDate('');
        }
      }
    } else {
      setAvailableDeliveryDays([]);
    }
  }, [deliveryZone, siteSettings.orderTimeLimit, deliveryDate]);

  const handleBranchChange = (option) => {
    if (option) {
      setSelectedBranch(option);
      setBranchAddress(option.address || '');
      setDeliveryAddress(option.address || '');

      const zone = getDeliveryZoneByDANECode(
        option.municipality_code,
        option.city || ''
      );
      setDeliveryZone(zone);
      setDeliveryDate('');

      if (zone) {
        const cityName = getCityNameByDANECode(option.municipality_code);
        showNotification(
          `Sucursal en ${cityName} - Zona de entrega: ${zone.name}`,
          'info'
        );

        console.log('Zona de entrega determinada:', {
          municipalityCode: option.municipality_code,
          cityName: cityName,
          zone: zone.name,
          deliveryDays: zone.days
        });
      } else {
        showNotification(
          'No se pudo determinar la zona de entrega para esta sucursal. Verifique el código DANE o contacte soporte.',
          'warning'
        );

        console.warn('No se pudo determinar zona de entrega:', {
          municipalityCode: option.municipality_code,
          city: option.city,
          address: option.address
        });
      }
    } else {
      setSelectedBranch(null);
      setBranchAddress('');
      setDeliveryAddress('');
      setDeliveryZone(null);
      setDeliveryDate('');
    }
  };

  const handleDeliveryAddressChange = (e) => {
    setDeliveryAddress(e.target.value);
  };

  const calculateSubtotal = () => {
    return orderDetails.reduce((total, item) => {
      const itemTotal = item.quantity * item.unit_price;
      return total + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
  };

  const calculateShipping = (subtotal) => {
    if (subtotal >= SHIPPING_FREE_LIMIT) return 0;
    if (subtotal >= SHIPPING_LIMIT) return SHIPPING_CHARGE;
    return null;
  };

  const calculateIVA = (subtotal) => {
    return subtotal * IVA_RATE;
  };

  const subtotal = calculateSubtotal();
  const iva = calculateIVA(subtotal);
  const shipping = calculateShipping(subtotal);
  const total = shipping !== null ? subtotal + iva + shipping : subtotal + iva;

  const formatProductName = (product) => {
    const price = product.has_custom_price && product.custom_price_info 
      ? product.custom_price_info.price 
      : product.price_list1;
    return `${product.name} - ${formatCurrencyCOP(price)}`;
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
        if (selectedProduct.has_custom_price && selectedProduct.custom_price_info) {
          newDetails[index].unit_price = selectedProduct.custom_price_info.price;
          newDetails[index].price_source = 'custom';
          newDetails[index].original_price = selectedProduct.price_list1;
        } else {
          newDetails[index].unit_price = selectedProduct.price_list1;
          newDetails[index].price_source = 'default';
          newDetails[index].original_price = selectedProduct.price_list1;
        }
      }
    }

    setOrderDetails(newDetails);
  };

  const calculateTotal = () => {
  const subtotal = orderDetails.reduce((total, item) => {
    const itemTotal = item.quantity * item.unit_price;
      return total + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
  
  const iva = calculateIVA(subtotal);
  const shipping = calculateShipping(subtotal);
  
    return shipping !== null ? subtotal + iva + shipping : subtotal + iva;
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isValid = orderDetails.every(detail =>
      detail.product_id && detail.quantity > 0 && detail.unit_price > 0
    );

    if (!isValid) {
      showNotification('Por favor completa todos los campos correctamente. Asegúrate de que los productos tengan precios válidos.', 'error');
      return;
    }

    if (!deliveryDate) {
      showNotification('Selecciona una fecha de entrega válida', 'error');
      return;
    }

    if (!selectedBranch) {
      showNotification('Debes seleccionar una sucursal para el pedido.', 'error');
      return;
    }

    if (!deliveryZone) {
      showNotification('No se pudo determinar la zona de entrega para la sucursal seleccionada.', 'error');
      return;
    }

    const selectedDate = new Date(deliveryDate);
    const isDateAvailable = availableDeliveryDays.some(date =>
      date.toDateString() === selectedDate.toDateString()
    );

    if (!isDateAvailable) {
      showNotification(`La fecha seleccionada no está disponible para entregas en ${deliveryZone.name}`, 'error');
      return;
    }

    if (subtotal < MIN_ORDER_AMOUNT) {
      showNotification(`El monto mínimo para crear un pedido es ${formatCurrencyCOP(MIN_ORDER_AMOUNT)} (sin IVA).`, 'error');
      return;
    }

    if (shipping === null) {
      showNotification('El monto mínimo para aplicar flete es $50.000. Por favor, ajusta tu pedido.', 'error');
      return;
    }

    setShowConfirmationModal(true);
  };

  const handleConfirmCreateOrder = async () => {
    try {
      setIsSubmitting(true);
      setShowConfirmationModal(false);

      const totalAmount = parseFloat(calculateTotal());

      const orderData = {
        user_id: user.id,
        total_amount: totalAmount,
        delivery_date: deliveryDate,
        notes: orderNotes,
        delivery_zone: deliveryZone ? deliveryZone.key : null,
        delivery_zone_name: deliveryZone ? deliveryZone.name : null,
        municipality_dane_code: selectedBranch ? selectedBranch.municipality_code : null,
        price_list_code: userPriceListCode || 'GENERAL',
        has_custom_pricing: userPriceListCode && userPriceListCode !== 'GENERAL',
        subtotal_amount: subtotal,
        iva_amount: iva,
        shipping_amount: shipping || 0,
        details: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id || 0),
          quantity: parseInt(detail.quantity || 0),
          branch_id: selectedBranch ? selectedBranch.value : null,
          branch_name: selectedBranch ? selectedBranch.label : '',
          branch_address: branchAddress,
          delivery_address: branchAddress,
          shipping_fee: shipping,
          unit_price: parseFloat(detail.unit_price || 0),
          municipality_dane_code: selectedBranch ? selectedBranch.municipality_code : null,
          price_source: detail.price_source || 'default',
          original_unit_price: parseFloat(detail.original_price || detail.unit_price || 0)
        }))
      };

      console.log('Datos de orden a enviar con código DANE:', {
        userId: user.id,
        userActive: user.is_active,
        deliveryZone: deliveryZone,
        municipalityDANE: selectedBranch ? selectedBranch.municipality_code : null,
        orderData: orderData
      });

      let formData = null;
      if (orderFile) {
        formData = new FormData();
        formData.append('orderFile', orderFile);
        formData.append('user_id', user.id.toString());
        formData.append('orderData', JSON.stringify(orderData));
      }

      let result;
      if (formData) {
        result = await orderService.createOrder(formData, true);
      } else {
        const orderWithUserId = {
          ...orderData,
          user_id: user.id
        };
        result = await orderService.createOrder(orderWithUserId, false);
      }

      if (result.success) {
        showNotification('Pedido creado exitosamente', 'success');

        setOrderDetails([{ product_id: '', quantity: 1, unit_price: 0 }]);
        setDeliveryDate('');
        setOrderFile(null);
        setOrderNotes('');
        setSelectedBranch(null);
        setBranchAddress('');
        setDeliveryAddress('');
        setDeliveryZone(null);

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
    navigate('/dashboard/orders');
  };

  const handleCancelConfirmationClose = () => {
    setShowCancelConfirmation(false);
  };

  const productOptionsForSelect = useMemo(() => {
    return products.map(product => ({
      value: product.product_id,
      label: product.name,
      image: product.image_url,
      price: product.price_list1
    }));
  }, [products]);

  const handleSelectChange = (index, option) => {
    const newDetails = [...orderDetails];

    if (option) {
      newDetails[index].product_id = option.value;
      const selectedProduct = products.find(p => p.product_id === parseInt(option.value));
      if (selectedProduct) {
        if (selectedProduct.has_custom_price && selectedProduct.custom_price_info) {
          newDetails[index].unit_price = selectedProduct.custom_price_info.price;
          newDetails[index].price_source = 'custom';
          newDetails[index].original_price = selectedProduct.price_list1;
        } else {
          newDetails[index].unit_price = selectedProduct.price_list1;
          newDetails[index].price_source = 'default';
          newDetails[index].original_price = selectedProduct.price_list1;
        }
      }
    } else {
      newDetails[index].product_id = '';
      newDetails[index].unit_price = 0;
    }

    handleProductChange(index, 'product_id', option ? option.value : '');
  };

  const formatOptionLabel = ({ value, label, image, price }) => (
    <div className="flex items-center">
      {image ? (
        <img src={image} alt={label} className="w-8 h-8 mr-3 rounded-md object-cover border border-gray-200" />
      ) : (
        <div className="w-8 h-8 mr-3 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-400 border border-gray-200">Img</div>
      )}
      <div>
        <div className="font-medium text-sm text-gray-800">{label}</div>
        {price && <div className="text-xs text-gray-500">{formatCurrencyCOP(price)}</div>}
      </div>
    </div>
  );

  const formatCurrencyCOP = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "$ 0";

    const intValue = Math.floor(numValue);
    const valueStr = intValue.toString();

    if (valueStr.length <= 6) {
      return `$ ${valueStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
    }

    const millionsPart = valueStr.slice(0, valueStr.length - 6);
    const thousandsPart = valueStr.slice(valueStr.length - 6);

    const formattedMillions = millionsPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const formattedThousands = thousandsPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    return `$ ${formattedMillions}'${formattedThousands}`;
  };

  if (isValidating) {
    console.log('🔄 CreateOrderForm - Validando permisos...');
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Validando permisos de usuario...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccessForm) {
    console.log('❌ CreateOrderForm - Acceso denegado:', {
      canAccessForm,
      userStatus: userStatus.statusMessage,
      userCanCreate: userStatus.canCreateOrders,
      isActive: userStatus.isActive,
      hasProfile: userStatus.hasClientProfile
    });
    
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Crear Nuevo Pedido</h2>
          <UserActivationStatus showDetailedStatus={true} allowManualActions={false} />
        </div>

        {validationResult?.errors && (
          <div className="mt-6 space-y-3">
            {validationResult.errors.map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-start">
                  <span className="text-red-500 mr-2 mt-0.5">❌</span>
                  <div className="flex-1">
                    <span className="text-red-700 font-medium block">{error.message}</span>
                    {error.action === 'COMPLETE_PROFILE' && (
                      <button
                        onClick={() => navigate(error.redirectTo)}
                        className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Completar perfil de cliente
                      </button>
                    )}
                    {error.action === 'CONTACT_SUPPORT' && (
                      <button
                        onClick={() => alert('Contacta con el administrador para activar tu cuenta')}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Contactar administrador
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {validationResult?.warnings && validationResult.warnings.length > 0 && (
          <div className="mt-4 space-y-3">
            {validationResult.warnings.map((warning, index) => (
              <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start">
                  <span className="text-yellow-500 mr-2 mt-0.5">⚠️</span>
                  <div className="flex-1">
                    <span className="text-yellow-700 font-medium block">{warning.message}</span>
                    {warning.estimatedTime && (
                      <span className="text-yellow-600 text-sm">
                        Tiempo estimado: {warning.estimatedTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={() => navigate('/dashboard/orders')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Volver a órdenes
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Verificar nuevamente
          </button>
        </div>
      </div>
    );
  }

  console.log('✅ CreateOrderForm - Usuario autorizado, renderizando formulario completo');

  if (loadingProducts || loadingSettings) {
    console.log('🔄 CreateOrderForm - Cargando productos y configuraciones...');
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-600">Cargando productos...</p>
        </div>
      </div>
    );
  }

  console.log('🎯 CreateOrderForm - Formulario completamente cargado y listo');

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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">🏢</span>
            <h3 className="text-xl font-semibold text-gray-800">Sucursal de Entrega</h3>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona tu sucursal</label>
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
          </div>

          {selectedBranch && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dirección de la sucursal</label>
                <input
                  type="text"
                  value={branchAddress}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                  readOnly
                />
              </div>

              {deliveryZone && (
                <div className="bg-blue-50 p-4 rounded-md border-l-4 border-blue-400">
                  <div className="flex items-center mb-2">
                    <span className="text-blue-500 mr-2">🚚</span>
                    <span className="font-medium text-blue-800">
                      Zona de Entrega: {deliveryZone.name}
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 mb-2">
                    Las entregas para esta sucursal se realizan los días: {deliveryZone.name}
                  </p>
                  {selectedBranch && selectedBranch.municipality_code && (
                    <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                      <strong>Municipio:</strong> {getCityNameByDANECode(selectedBranch.municipality_code)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">📅</span>
            <h3 className="text-xl font-semibold text-gray-800">Fecha de Entrega</h3>
          </div>

          {!selectedBranch ? (
            <div className="bg-yellow-50 p-4 rounded-md border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-700">
                <span className="flex items-center">
                  <span className="text-yellow-500 mr-2">⚠️</span>
                  <span className="font-medium">Primero selecciona una sucursal para ver las fechas de entrega disponibles</span>
                </span>
              </p>
            </div>
          ) : !deliveryZone ? (
            <div className="bg-red-50 p-4 rounded-md border-l-4 border-red-400">
              <p className="text-sm text-red-700">
                <span className="flex items-center">
                  <span className="text-red-500 mr-2">❌</span>
                  <span className="font-medium">No se pudo determinar la zona de entrega para esta sucursal</span>
                </span>
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 p-4 rounded-md mb-4 border-l-4 border-blue-400">
                <p className="text-sm text-gray-700">
                  <span className="flex items-center mb-2">
                    <span className="text-blue-500 mr-2">ℹ️</span>
                    <span className="font-medium">Fechas disponibles para {deliveryZone.name}</span>
                  </span>
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">🚚</span>Información sobre tu entrega
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✨</span>
                      <span>Entregas para <strong>{deliveryZone.name}</strong></span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-amber-500 mr-2">⏰</span>
                      <span>Si haces tu pedido después de las {siteSettings.orderTimeLimit}, necesitaremos <span className="font-medium">1 día extra</span> para prepararlo con cuidado.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">📅</span>
                      <span>Solo se muestran fechas disponibles para tu zona de entrega.</span>
                    </li>
                    {selectedBranch && selectedBranch.municipality_code && (
                      <li className="flex items-start">
                        <span className="text-purple-500 mr-2">🏷️</span>
                        <span>Municipio: <strong>{getCityNameByDANECode(selectedBranch.municipality_code)}</strong></span>
                      </li>
                    )}
                  </ul>
                  <p className="mt-3 text-xs text-gray-500 italic flex items-center">
                    <span className="mr-2">🕒</span>
                    Entregamos en horario comercial. ¡Estamos aquí para ti!
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-md flex flex-col justify-center">
                  <div className="text-center mb-3">
                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Selecciona una fecha disponible
                    </span>
                  </div>
                  <DeliveryDatePicker
                    value={deliveryDate}
                    onChange={setDeliveryDate}
                    orderTimeLimit={siteSettings.orderTimeLimit}
                    availableDates={availableDeliveryDays}
                    deliveryZone={deliveryZone}
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500 italic mt-2 flex items-center">
                <span className="mr-2">🚚</span>
                <span>Las entregas se realizan en horario comercial según la zona seleccionada</span>
              </div>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Imagen Referencia
                </th>
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
              {orderDetails.map((detail, index) => {
                const selectedProduct = products.find(p => p.product_id === parseInt(detail.product_id));

                return (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {selectedProduct?.image_url ? (
                        <div className="w-16 h-16">
                          <img
                            src={selectedProduct.image_url}
                            alt={selectedProduct.name}
                            className="object-cover w-full h-full rounded-md border border-gray-300"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-md border border-gray-300">
                          <span className="text-gray-500 text-xs">Sin imagen</span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <Select
                        value={productOptionsForSelect.find(option => option.value === parseInt(detail.product_id))}
                        onChange={(option) => handleSelectChange(index, option)}
                        options={productOptionsForSelect}
                        formatOptionLabel={formatOptionLabel}
                        placeholder="Seleccionar producto"
                        className="w-full"
                        classNamePrefix="select"
                        isClearable
                        isSearchable
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuPlacement="auto"
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderColor: '#D1D5DB',
                            boxShadow: 'none',
                            minWidth: '300px',
                            width: '100%',
                            '&:hover': { borderColor: '#4F46E5' }
                          }),
                          container: (base) => ({
                            ...base,
                            width: '300px',
                            minWidth: '300px',
                            maxWidth: '400px'
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            width: '300px',
                            minWidth: '300px'
                          }),
                          menuPortal: (base) => ({
                            ...base,
                            zIndex: 9999
                          })
                        }}
                      />
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
                      {formatCurrencyCOP(detail.unit_price)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatCurrencyCOP(detail.quantity * detail.unit_price)}
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
                );
              })}
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
            Total: {formatCurrencyCOP(calculateTotal())}
          </div>
        </div>

        <div className="my-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="space-y-3">
            {/* Subtotal */}
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Subtotal:</span>
              <span className="font-semibold text-gray-800">{formatCurrencyCOP(subtotal)}</span>
            </div>

            {/* IVA */}
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">IVA (19%):</span>
              <span className="font-semibold text-gray-800">{formatCurrencyCOP(iva)}</span>
            </div>

            {/* Flete */}
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Flete:</span>
              {shipping === 0 ? (
                <span className="text-green-600 font-bold">¡Envío gratis!</span>
              ) : shipping === SHIPPING_CHARGE ? (
                <span className="text-blue-700 font-semibold">{formatCurrencyCOP(SHIPPING_CHARGE)}</span>
              ) : (
                <span className="text-red-600 font-semibold">No aplica</span>
              )}
            </div>

            {/* Línea divisoria */}
            <hr className="border-gray-300" />

            {/* Total final */}
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-800">Total a pagar:</span>
              <span className="text-xl font-bold text-gray-800">{formatCurrencyCOP(total)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mt-6 border-t pt-6">
          <div>
            <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
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
              Adjuntar Orden de Compra (opcional)
            </label>
            <OrderFileUpload
              value={orderFile}
              onChange={setOrderFile}
              buttonLabel="Orden de compra"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            className="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            onClick={handleCancelClick}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
            disabled={isSubmitting || !selectedBranch || !deliveryZone}
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

      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar pedido</h3>
            <p className="text-gray-500 mb-2">¿Estás seguro de que deseas crear este pedido?</p>

            {/* Desglose en el modal */}
            <div className="bg-gray-50 p-3 rounded-md mb-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrencyCOP(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (19%):</span>
                  <span>{formatCurrencyCOP(iva)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Flete:</span>
                  <span>{shipping === 0 ? 'Gratis' : formatCurrencyCOP(shipping || 0)}</span>
                </div>
                <hr className="my-1" />
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{formatCurrencyCOP(total)}</span>
                </div>
              </div>
            </div>
            {deliveryZone && (
              <div className="text-gray-600 text-sm mb-4">
                <p>Zona de entrega: {deliveryZone.name}</p>
                {selectedBranch && selectedBranch.municipality_code && (
                  <p>Municipio: {getCityNameByDANECode(selectedBranch.municipality_code)}</p>
                )}
              </div>
            )}

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