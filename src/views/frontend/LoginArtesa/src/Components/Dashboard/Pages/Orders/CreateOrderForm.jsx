import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Select from 'react-select';
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
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchAddress, setBranchAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryZone, setDeliveryZone] = useState(null);
  const [availableDeliveryDays, setAvailableDeliveryDays] = useState([]);
  const [userValidated, setUserValidated] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const navigate = useNavigate();

  const MIN_ORDER_AMOUNT = 50000;
  const SHIPPING_CHARGE = 10000;
  const SHIPPING_LIMIT = 50000;
  const SHIPPING_FREE_LIMIT = 80000;

  // CORREGIDA: Configuración de zonas con códigos DANE
  const DELIVERY_ZONES = {
    'MIERCOLES_SABADO': {
      name: 'Miércoles y Sábado',
      days: [3, 6], // 3 = Miércoles, 6 = Sábado
      municipalities: [
        '25175', // CHÍA
        '25126', // CAJICÁ
        '25758', // SOPÓ
        '25899', // ZIPAQUIRÁ
        '25214', // COTA
        '25322', // GUASCA
        '25295', // GACHANCIPÁ
        '25799'  // TENJO
      ],
      cities: ['Chía', 'Cajicá', 'Sopó', 'Zipaquirá', 'Cota', 'Guasca', 'Gachancipá', 'Tenjo']
    },
    'LUNES_JUEVES': {
      name: 'Lunes y Jueves',
      days: [1, 4], // 1 = Lunes, 4 = Jueves
      municipalities: [
        '25754'  // SOACHA
      ],
      cities: ['Soacha']
    },
    'MARTES_VIERNES': {
      name: 'Martes y Viernes',
      days: [2, 5], // 2 = Martes, 5 = Viernes
      municipalities: [
        '25473', // MOSQUERA
        '25430', // MADRID
        '25286', // FUNZA
        '25214'  // SIBERIA-COTA (mismo código que COTA)
      ],
      cities: ['Mosquera', 'Madrid', 'Funza', 'Siberia']
    },
    'LUNES_SABADO': {
      name: 'Lunes a Sábado',
      days: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
      municipalities: [
        '11001'  // BOGOTÁ D.C
      ],
      cities: ['Bogotá', 'Bogotá D.C']
    }
  };

  // CORREGIDA: Función para determinar la zona de entrega basada en código DANE
  const getDeliveryZoneByDANECode = (daneCode, cityName = '') => {
    if (!daneCode && !cityName) return null;
    
    // Primero intentar buscar por código DANE (más preciso)
    if (daneCode) {
      const normalizedDANE = daneCode.toString().trim();
      
      for (const [zoneKey, zoneData] of Object.entries(DELIVERY_ZONES)) {
        if (zoneData.municipalities.includes(normalizedDANE)) {
          return { key: zoneKey, ...zoneData };
        }
      }
    }
    
    // Si no encuentra por código DANE, intentar por nombre de ciudad (fallback)
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

  // NUEVA: Función para obtener el nombre de la ciudad por código DANE
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

  // Función para calcular fechas de entrega disponibles según la zona
  const calculateAvailableDeliveryDates = (zone, orderTimeLimit = '18:00') => {
    if (!zone) return [];
    
    const today = new Date();
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const [limitHour, limitMinute] = orderTimeLimit.split(':').map(Number);
    
    // Determinar si el pedido se hace después del horario límite
    const isAfterLimit = currentHour > limitHour || 
                        (currentHour === limitHour && currentMinute > limitMinute);
    
    // Determinar días adicionales según el día actual y horario
    let additionalDays = 2; // Días base de preparación
    
    const currentDay = today.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    
    // Si es después del horario límite, agregar un día extra
    if (isAfterLimit) {
      additionalDays += 1;
    }
    
    // Lógica especial para fines de semana
    if (currentDay === 6) { // Sábado
      if (isAfterLimit) {
        additionalDays = 4; // Entrega el miércoles
      } else {
        additionalDays = 3; // Entrega el martes
      }
    } else if (currentDay === 0) { // Domingo
      additionalDays = 3; // Entrega el miércoles
    }
    
    const availableDates = [];
    const maxDaysToCheck = 30; // Buscar fechas en los próximos 30 días
    
    for (let i = additionalDays; i <= maxDaysToCheck; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      const dayOfWeek = checkDate.getDay();
      
      // Verificar si este día está disponible para la zona
      if (zone.days.includes(dayOfWeek)) {
        availableDates.push(new Date(checkDate));
      }
    }
    
    return availableDates;
  };

  useEffect(() => {
    const validateUser = async () => {
      console.log('Validando usuario:', user);
      
      // Verificar si el usuario existe
      if (!user) {
        console.log('Usuario no encontrado, redirigiendo al login');
        setValidationError('Debes iniciar sesión para crear pedidos');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        return;
      }

      // Verificar si el usuario tiene ID
      if (!user.id) {
        console.log('Usuario sin ID válido:', user);
        setValidationError('Error en la sesión de usuario. Por favor, cierra sesión y vuelve a ingresar');
        setTimeout(() => {
          navigate('/dashboard/orders');
        }, 3000);
        return;
      }

      // VALIDACIÓN PRINCIPAL: Verificar si el usuario está activo
      if (user.is_active === false || user.is_active === 0 || user.is_active === '0') {
        console.log('Usuario inactivo detectado:', {
          userId: user.id,
          isActive: user.is_active,
          userStatus: user.status
        });
        
        setValidationError('Tu cuenta no está activa. No puedes crear pedidos en este momento. Contacta al administrador para activar tu cuenta.');
        showNotification('Tu cuenta no está activa. Contacta al administrador para activar tu cuenta.', 'error');
        
        setTimeout(() => {
          navigate('/dashboard/orders');
        }, 4000);
        return;
      }

      // NUEVA: Verificación adicional del estado del usuario
      if (user.status && (user.status === 'inactive' || user.status === 'suspended' || user.status === 'blocked')) {
        console.log('Usuario con estado inválido:', {
          userId: user.id,
          status: user.status
        });
        
        setValidationError(`Tu cuenta está ${user.status}. No puedes crear pedidos.`);
        showNotification(`Tu cuenta está ${user.status}. Contacta al administrador.`, 'error');
        
        setTimeout(() => {
          navigate('/dashboard/orders');
        }, 4000);
        return;
      }

      // Si todas las validaciones pasan
      console.log('Usuario validado correctamente:', {
        userId: user.id,
        isActive: user.is_active,
        status: user.status
      });
      
      setUserValidated(true);
      setValidationError(null);
    };

    validateUser();
  }, [user, navigate]);

  // Cargar configuración del sitio (solo si el usuario está validado)
  useEffect(() => {
    if (!userValidated) return;
    
    const fetchSettings = async () => {
      try {
        console.log("Obteniendo configuración del sitio...");
        const response = await API.get('/admin/settings');
        console.log("Respuesta de configuración:", response.data);

        if (response.data && response.data.success) {
          console.log("Configuración obtenida:", response.data.data);
          setSiteSettings(response.data.data);
        } else {
          console.warn("No se pudo obtener la configuración correctamente:", response.data);
        }
      } catch (error) {
        console.error('Error fetching site settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [userValidated]);

  // Cargar productos disponibles (solo si el usuario está validado)
  useEffect(() => {
    if (!userValidated) return;
    
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const response = await API.get('/products');
        if (response.data.success && Array.isArray(response.data.data)) {
          const fetchedProducts = response.data.data.map(p => ({
            ...p,
            image_url: p.image_url || null
          }));
          setProducts(fetchedProducts);
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
  }, [userValidated]);

  // Cargar sucursales (solo si el usuario está validado)
  useEffect(() => {
    if (!userValidated || !user || !user.id) return;
    
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
  }, [user, userValidated]);

  // NUEVO: Función para formatear opciones de sucursales con nombres de municipios
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

  // ACTUALIZADO: branchOptions con nombre del municipio
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

  // Efecto para actualizar fechas disponibles cuando cambia la zona o configuración
  useEffect(() => {
    if (deliveryZone && siteSettings.orderTimeLimit) {
      const dates = calculateAvailableDeliveryDates(deliveryZone, siteSettings.orderTimeLimit);
      setAvailableDeliveryDays(dates);
      
      // Limpiar fecha seleccionada si no está disponible para la nueva zona
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

  // CORREGIDA: Función para manejar cambio de sucursal
  const handleBranchChange = (option) => {
    if (option) {
      setSelectedBranch(option);
      setBranchAddress(option.address || '');
      setDeliveryAddress(option.address || '');
      
      // CORREGIDO: Usar municipality_code que viene de la API
      const zone = getDeliveryZoneByDANECode(
        option.municipality_code, // Campo correcto de la API
        option.city || ''
      );
      setDeliveryZone(zone);
      
      // Limpiar fecha de entrega para que el usuario seleccione una nueva
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

  const getProductPrice = (product) => {
    if (!product) return 0;
    return product.price || product.priceList1 || product.price_list1 || 0;
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

  const subtotal = calculateSubtotal();
  const shipping = calculateShipping(subtotal);
  const total = shipping !== null ? subtotal + shipping : subtotal;

  const formatProductName = (product) => {
    const price = getProductPrice(product);
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
        newDetails[index].unit_price = selectedProduct.price_list1;
      }
    }

    setOrderDetails(newDetails);
  };

  const calculateTotal = () => {
    return orderDetails.reduce((total, item) => {
      const itemTotal = item.quantity * item.unit_price;
      return total + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };

  // CORREGIDA: Validación en handleSubmit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      showNotification('Debes iniciar sesión para crear un pedido', 'error');
      return;
    }

    if (!user.id) {
      showNotification('No se puede identificar tu usuario. Por favor, cierra sesión y vuelve a ingresar', 'error');
      console.error('Error: user.id no disponible', user);
      return;
    }

    // VALIDACIÓN REFORZADA: Verificar estado activo del usuario
    if (user.is_active === false || user.is_active === 0 || user.is_active === '0') {
      showNotification('Tu cuenta no está activa. No puedes crear pedidos.', 'error');
      console.error('Intento de crear orden con usuario inactivo:', {
        userId: user.id,
        isActive: user.is_active
      });
      return;
    }

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

    // NUEVA: Validación de zona de entrega
    if (!deliveryZone) {
      showNotification('No se pudo determinar la zona de entrega para la sucursal seleccionada.', 'error');
      return;
    }

    // NUEVA: Validar que la fecha seleccionada esté disponible para la zona
    const selectedDate = new Date(deliveryDate);
    const isDateAvailable = availableDeliveryDays.some(date => 
      date.toDateString() === selectedDate.toDateString()
    );

    if (!isDateAvailable) {
      showNotification(`La fecha seleccionada no está disponible para entregas en ${deliveryZone.name}`, 'error');
      return;
    }

    if (subtotal < MIN_ORDER_AMOUNT) {
      showNotification(`El monto mínimo para crear un pedido es ${formatCurrencyCOP(MIN_ORDER_AMOUNT)}.`, 'error');
      return;
    }
    
    if (shipping === null) {
      showNotification('El monto mínimo para aplicar flete es $59.000. Por favor, ajusta tu pedido.', 'error');
      return;
    }

    setShowConfirmationModal(true);
  };

 const handleConfirmCreateOrder = async () => {
    try {
      setIsSubmitting(true);
      setShowConfirmationModal(false);

      const totalAmount = parseFloat(calculateTotal());

      // VALIDACIÓN FINAL antes de enviar
      if (!user || !user.id) {
        showNotification('Error: No se pudo identificar el ID de usuario', 'error');
        console.error('Error: ID de usuario no disponible al crear orden', user);
        setIsSubmitting(false);
        return;
      }

      // VALIDACIÓN CRÍTICA: Verificar usuario activo una vez más
      if (user.is_active === false || user.is_active === 0 || user.is_active === '0') {
        showNotification('Tu usuario no está activo. No puedes crear pedidos', 'error');
        console.error('Usuario inactivo intentando crear orden:', {
          userId: user.id,
          isActive: user.is_active,
          timestamp: new Date().toISOString()
        });
        setIsSubmitting(false);
        return;
      }

      const orderData = {
        user_id: user.id,
        total_amount: totalAmount,
        delivery_date: deliveryDate,
        notes: orderNotes,
        delivery_zone: deliveryZone ? deliveryZone.key : null,
        delivery_zone_name: deliveryZone ? deliveryZone.name : null,
        municipality_dane_code: selectedBranch ? selectedBranch.municipality_code : null,
        details: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id || 0),
          quantity: parseInt(detail.quantity || 0),
          branch_id: selectedBranch ? selectedBranch.value : null,
          branch_name: selectedBranch ? selectedBranch.label : '',
          branch_address: branchAddress,
          delivery_address: branchAddress,
          shipping_fee: shipping,
          unit_price: parseFloat(detail.unit_price || 0),
          municipality_dane_code: selectedBranch ? selectedBranch.municipality_code : null
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
        newDetails[index].unit_price = selectedProduct.price_list1;
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

 //// NUEVO: Renderizado condicional para errores de validación
  if (validationError) {
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-red-200 shadow-sm">
        <div className="text-center">
          <div className="mb-4">
            <span className="text-6xl">🚫</span>
          </div>
          <h2 className="text-xl font-semibold text-red-800 mb-4">Acceso Restringido</h2>
          <p className="text-red-600 mb-6">{validationError}</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate('/dashboard/orders')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Volver a Órdenes
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // NUEVO: Renderizado condicional para usuario no validado
  if (!userValidated) {
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

        {/* Sección de selección de sucursal */}
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
              placeholder="Selecciona una sucursal"
              isClearable
              className="w-full"
              styles={{
                control: (base) => ({
                  ...base,
                  borderColor: '#D1D5DB',
                  boxShadow: 'none',
                  '&:hover': { borderColor: '#4F46E5' }
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
              
              {/* ACTUALIZADA: Información de zona de entrega con código DANE */}
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
                      <strong>Código DANE:</strong> {selectedBranch.municipality_code} - 
                      <strong> Ciudad:</strong> {getCityNameByDANECode(selectedBranch.municipality_code)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ACTUALIZADA: Sección de Fecha de Entrega */}
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
              {selectedBranch && (
                <p className="text-xs text-red-600 mt-2">
                  Código DANE: {selectedBranch.municipality_code || 'No disponible'}
                </p>
              )}
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
                        <span>Código DANE: <strong>{selectedBranch.municipality_code}</strong></span>
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

        {/* Sección de productos */}
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
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-semibold text-gray-700">Flete:</span>{" "}
              {shipping === 0 ? (
                <span className="text-green-600 font-bold">¡Envío gratis!</span>
              ) : shipping === SHIPPING_CHARGE ? (
                <span className="text-blue-700 font-semibold">{formatCurrencyCOP(SHIPPING_CHARGE)} (aplica por subtotal entre $59.000 y $79.999)</span>
              ) : (
                <span className="text-red-600 font-semibold">No aplica (pedido insuficiente para envío)</span>
              )}
            </div>
            <div className="text-xl font-bold text-gray-800">
              Total a pagar: {formatCurrencyCOP(total)}
            </div>
          </div>
        </div>

        {/* Notas y Adjuntos */}
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

      {/* Modales de confirmación */}
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
            <p className="text-gray-700 font-medium mb-2">Total: {formatCurrencyCOP(calculateTotal())}</p>
            {deliveryZone && (
              <div className="text-gray-600 text-sm mb-4">
                <p>Zona de entrega: {deliveryZone.name}</p>
                {selectedBranch && selectedBranch.municipality_code && (
                  <p>Código DANE: {selectedBranch.municipality_code}</p>
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