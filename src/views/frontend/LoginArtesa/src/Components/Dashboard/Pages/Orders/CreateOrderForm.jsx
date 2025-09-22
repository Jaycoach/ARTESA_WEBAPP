import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Select from 'react-select';
import { useAuth } from '../../../../hooks/useAuth';
import { useUserActivation } from '../../../../hooks/useUserActivation';
import { orderService } from '../../../../services/orderService';
import UserActivationStatus from '../../../UserActivationStatus';
import { AUTH_TYPES } from '../../../../constants/AuthTypes';
import API, { BranchOrdersAPI, getProductsAPI, isBranchUser, debugTokens } from '../../../../api/config';
import DeliveryDatePicker from './DeliveryDatePicker';
import OrderFileUpload from './OrderFileUpload';
import Notification from '../../../../Components/ui/Notification';
import { useNavigate } from 'react-router-dom';
import usePriceList from '../../../../hooks/usePriceList';
import { throttle } from 'lodash';
import useProductImage, { errorCache } from '../../../../hooks/useProductImage';

const adjustDateForTimezone = (dateString) => {
  // Crear fecha sin problemas de zona horaria
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const ProductImageSmall = React.memo(({ productId, alt, className = "w-8 h-8", shouldLoad = true }) => {
  const { imageUrl, loading, error } = useProductImage(productId, 'thumbnail', shouldLoad);

  // Debug específico para productos problemáticos - MENOS VERBOSO
  useEffect(() => {
    if (productId && shouldLoad) {
      // Solo loggear errores que no sean 404 conocidos o problemas frecuentes
      if (error && !['Cached 404', 'Image not found', 'No image available'].includes(error)) {
        console.log(`📸 ProductImageSmall Debug [${productId}]:`, {
          shouldLoad,
          loading,
          hasImageUrl: !!imageUrl,
          error: error || 'none',
          imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'null'
        });
      }
    }
  }, [productId, shouldLoad, loading, imageUrl, error]);

  // Estado placeholder para productos sin shouldLoad
  if (!shouldLoad) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center rounded-md border border-gray-200 ${className}`}>
        <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  // Estado de carga
  if (loading) {
    return (
      <div className={`bg-gray-100 animate-pulse flex items-center justify-center rounded-md border border-gray-200 ${className}`}>
        <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  // Estado de error o sin imagen - MEJORADO Y SILENCIOSO
  if (!imageUrl || error) {
    // Solo loggear errores verdaderos, no 404s esperados
    if (error && error !== 'Cached 404' && error !== 'Image not found' && error !== 'No image available' && error !== 'Temporary error') {
      console.warn(`ProductImageSmall [${productId}]: ${error}`);
    }
    
    return (
      <div className={`bg-gray-100 flex items-center justify-center rounded-md border border-gray-200 ${className}`} title={`Producto ${productId} - Sin imagen disponible`}>
        <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  // Estado exitoso con imagen
  return (
    <img
      src={imageUrl}
      alt={alt}
      className={`object-cover rounded-md border border-gray-200 ${className}`}
      onError={(e) => {
        // Ocultar imagen rota y mostrar placeholder
        e.target.style.display = 'none';
        const parent = e.target.parentNode;
        if (parent && !parent.querySelector('.fallback-placeholder')) {
          parent.innerHTML = `
            <div class="fallback-placeholder ${className.replace('w-', 'w-').replace('h-', 'h-')} bg-gray-100 flex items-center justify-center rounded-md border border-gray-200">
              <svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
              </svg>
            </div>
          `;
        }
      }}
    />
  );
});

const CreateOrderForm = ({ onOrderCreated }) => {
  const { user, branch, authType, isAuthenticated, refreshAuth } = useAuth();
  const {
    userPriceListCode,
    priceCache,
    loading: pricesLoading,
    fetchMultiplePrices,
    getProductPrice
  } = usePriceList();
  
  const { userStatus } = useUserActivation();
  const navigate = useNavigate();

  // Estados de validación simplificados basados en useUserActivation
  const isValidating = userStatus.loading;
  const canAccessForm = userStatus.canCreateOrders && !userStatus.loading && isAuthenticated;

  // Estados para manejo de imágenes visibles
  const [visibleOptions, setVisibleOptions] = useState(new Set());
  const [selectedProductImages, setSelectedProductImages] = useState(new Set()); // NUEVO
  const [allProductImages, setAllProductImages] = useState(new Set());
  const menuListRef = useRef(null);
  const throttledSetVisibleOptions = useCallback(
    throttle((productId) => {
      setVisibleOptions(prev => new Set([...prev, productId]));
    }, 100),
    [setVisibleOptions] 
  );

  // Resultado de validación
  const validationResult = {
    errors: !userStatus.canCreateOrders && !userStatus.loading ? [{
      type: 'ACCESS_DENIED',
      message: userStatus.statusMessage || 'No puedes crear pedidos en este momento',
      action: !userStatus.hasClientProfile ? 'COMPLETE_PROFILE' : 'CONTACT_SUPPORT',
      redirectTo: '/dashboard/profile/client-info'
    }] : [],
    warnings: []
  };

  const [products, setProducts] = useState([]);
  const [orderDetails, setOrderDetails] = useState([{ product_id: '', quantity: 1, unit_price: 0 }]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderFile, setOrderFile] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [siteSettings, setSiteSettings] = useState({ orderTimeLimit: '18:00' });
  const [branchInfo, setBranchInfo] = useState(null);
  const [loadingBranchInfo, setLoadingBranchInfo] = useState(false);
  const fetchProductsCalledRef = useRef(false);
  const fetchBranchesCalledRef = useRef(false);

  const cleanupInvisibleImages = useCallback(() => {
    setVisibleOptions(prev => {
      // Mantener solo productos seleccionados y algunos elementos del viewport
      const selectedIds = orderDetails
        .map(detail => parseInt(detail.product_id))
        .filter(id => !isNaN(id));
      
      const keepVisible = new Set([
        ...selectedIds,
        ...Array.from(prev).slice(-10) // Mantener últimos 10 visibles
      ]);
      
      return keepVisible;
    });
  }, [orderDetails]);

  // useEffect de limpieza
  useEffect(() => {
    // Limpiar caché cada 2 minutos en lugar de 30 segundos para mejor rendimiento
    const cleanupInterval = setInterval(cleanupInvisibleImages, 120000); // 2 minutos
    
    // Limpiar cache de errores cada 10 minutos para permitir reintentos ocasionales
    const errorCacheCleanup = setInterval(() => {
      if (errorCache.size > 50) {
        errorCache.clear();
        console.log('🧹 Cache de errores de imágenes limpiado');
      }
    }, 600000); // 10 minutos

    return () => {
      clearInterval(cleanupInterval);
      clearInterval(errorCacheCleanup);
    };
  }, [cleanupInvisibleImages]);

  // Cargar configuración del sitio
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        console.log('🔍 Obteniendo configuración de API...');
        const response = await API.get('/admin/settings');
        
        if (response.data && response.data.success) {
          const settingsData = response.data.data || {};
          console.log('✅ Configuración desde API:', settingsData);
          
          setSiteSettings(prev => ({
            ...prev,
            ...settingsData,
            orderTimeLimit: settingsData.orderTimeLimit || '18:00'
          }));
        } else {
          console.warn('⚠️ Respuesta API sin éxito, usando valor por defecto');
        }
      } catch (error) {
        console.error('❌ Error obteniendo configuración:', error);
        // Mantener valor por defecto
        console.log('🔄 Usando valor por defecto: 18:00');
      }
    };

    fetchSettings();
  }, []);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchAddress, setBranchAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryZone, setDeliveryZone] = useState(null);
  const [availableDeliveryDays, setAvailableDeliveryDays] = useState([]);
  const isFetchingProducts = useRef(false);
  const isFetchingBranches = useRef(false);
  const [search, setSearch] = useState('');
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };
  const IVA_RATE = 0.19;
  const IMPUESTO_SALUDABLE_RATE = 0.10; // 10% impuesto saludable
  const MIN_ORDER_AMOUNT = 50000;
  const SHIPPING_CHARGE = 10000;
  const SHIPPING_LIMIT = 50000;
  const SHIPPING_FREE_LIMIT = 80000;

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
    // Normalizar fecha actual para evitar problemas de zona horaria
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    today.setHours(0, 0, 0, 0);
    
    // Calcular días mínimos de manera más permisiva
    let additionalDays = 2; // Mínimo 2 días calendario
    const currentDay = today.getDay();

    // Solo agregar días extra si es muy tarde o fin de semana
    const currentHour = new Date().getHours();
    const [limitHour] = orderTimeLimit.split(':').map(Number);
    
    if (currentHour >= limitHour && currentDay >= 1 && currentDay <= 5) {
      additionalDays = 3; // 1 día extra si es después de la hora límite en día hábil
    }

    if (currentDay === 6) { // Sábado
      additionalDays = 3; // Entregar el martes
    } else if (currentDay === 0) { // Domingo
      additionalDays = 3; // Entregar el miércoles
    }

    const availableDates = [];
    const maxDaysToCheck = 45; // Aumentar el rango

    for (let i = additionalDays; i <= maxDaysToCheck; i++) {
      const checkDate = new Date(normalizedToday.getFullYear(), normalizedToday.getMonth(), normalizedToday.getDate() + i);
      const dayOfWeek = checkDate.getDay();

      if (zone.days.includes(dayOfWeek)) {
        const normalizedDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
        availableDates.push(normalizedDate);
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
  /*useEffect(() => {
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

              // Filtrar productos con precios válidos (custom prices)
              const validCustomProducts = productsWithCustomPrices.filter(product => {
                const price = product.has_custom_price && product.custom_price_info
                  ? product.custom_price_info.price
                  : parseFloat(product.effective_price || product.price_list1 || 0);
                return price > 0;
              });
              setProducts(validCustomProducts);
            } catch (priceError) {
              
              // Filtrar productos con precios válidos (precio por defecto - fallback)
              const validDefaultProducts = fetchedProducts.filter(product => {
                const price = parseFloat(product.effective_price || product.price_list1 || 0);
                return price > 0;
              });
              
              setProducts(validDefaultProducts);
            }
          } else {
            // Filtrar productos con precios válidos (precio por defecto)
            const validProducts = fetchedProducts.filter(product => {
              const price = parseFloat(product.effective_price || product.price_list1 || 0);
              return price > 0;
            });
            setProducts(validProducts);
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
  }, [canAccessForm, userPriceListCode, fetchMultiplePrices]);*/
  useEffect(() => {
    if (!canAccessForm) return;

    const fetchProducts = async () => {
      console.log('🚀 Iniciando fetchProducts - CARGANDO TODOS LOS PRODUCTOS:', {
        authType,
        timestamp: new Date().toISOString()
      });
      setLoadingProducts(true);

      try {
        // DETERMINAR CÓDIGO DE LISTA DE PRECIOS
        let priceListCode = '1';

        if (authType === AUTH_TYPES.BRANCH) {
          try {
            console.log('🏢 Obteniendo price_list_code para usuario BRANCH...');
            const branchResponse = await API.get('/branch-auth/profile');
            if (branchResponse.data.success && branchResponse.data.data.price_list_code) {
              priceListCode = branchResponse.data.data.price_list_code;
            }
          } catch (error) {
            console.warn('⚠️ Error obteniendo price_list_code, usando fallback:', error.message);
          }
        }

        console.log(`🎯 Usando lista de precios: ${priceListCode}`);

        // CARGAR TODOS LOS PRODUCTOS CON PAGINACIÓN COMPLETA
        let allProducts = [];
        let currentPage = 1;
        let totalPages = 1;
        let totalProductCount = 0;

        do {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '50',
            orderBy: 'product_code',
            orderDirection: 'ASC'
          });

          const endpoint = `/price-lists/${priceListCode}/products?${params.toString()}`;
          console.log(`📡 Cargando página ${currentPage}/${totalPages}:`, endpoint);

          const response = await API.get(endpoint);

          if (response.data.success && Array.isArray(response.data.data)) {
            const pageProducts = response.data.data;
            allProducts = [...allProducts, ...pageProducts];

            // ACTUALIZAR INFORMACIÓN DE PAGINACIÓN
            if (response.data.pagination) {
              totalPages = response.data.pagination.totalPages;
              totalProductCount = response.data.pagination.totalCount;
              console.log(`✅ Página ${currentPage}/${totalPages} cargada: ${pageProducts.length} productos (Total: ${allProducts.length}/${totalProductCount})`);
            }

            currentPage++;
          } else {
            throw new Error(response.data.message || 'Error en respuesta del API');
          }

          // SEGURIDAD: Evitar bucle infinito
          if (currentPage > 20) {
            console.warn('⚠️ Límite de seguridad alcanzado (20 páginas)');
            break;
          }

        } while (currentPage <= totalPages);

        console.log(`🎉 CARGA COMPLETA: ${allProducts.length} productos cargados de ${totalProductCount} disponibles`);

        // MAPEO DE TODOS LOS PRODUCTOS
        const mappedProducts = allProducts.map((plProduct, index) => {
          const priceValue = parseFloat(plProduct.price) || 0;

          return {
            product_id: plProduct.product_id || (index + 1),
            name: plProduct.local_product_name || plProduct.product_name,
            description: plProduct.local_product_description || plProduct.product_name,
            sap_code: plProduct.product_code,
            code: plProduct.product_code,
            
            tax_code_ar: plProduct.tax_code_ar || null,

            // PRECIOS
            price: priceValue,
            price_list1: priceValue,
            effective_price: priceValue,
            unit_price: priceValue,

            // INFORMACIÓN ADICIONAL
            price_list_code: plProduct.price_list_code,
            price_list_name: plProduct.price_list_name,
            currency: plProduct.currency || 'COP',
            image_url: null,
            has_custom_price: true,
            custom_price_info: {
              price: priceValue,
              currency: plProduct.currency || 'COP',
              updated_at: plProduct.updated_at
            },
            price_source: 'price_list',
            has_impuesto_saludable: false,
            updated_at: plProduct.updated_at,
            sap_last_sync: plProduct.sap_last_sync,

            // DATOS ORIGINALES
            _original: plProduct
          };
        });

        // FILTRAR PRODUCTOS CON PRECIOS VÁLIDOS
        const validProducts = mappedProducts.filter(product => {
          const price = parseFloat(product.price);
          return price > 0;
        });

        //Obtener información fiscal de productos
        try {
          console.log('🔍 Obteniendo información fiscal de productos...');
          const productIds = validProducts.map(p => p.product_id).join(',');
          const taxResponse = await API.get(`/products?ids=${productIds}&fields=product_id,tax_code_ar,sap_code`);
          
          if (taxResponse.data.success && Array.isArray(taxResponse.data.data)) {
            const taxInfoMap = {};
            taxResponse.data.data.forEach(product => {
              taxInfoMap[product.product_id] = product.tax_code_ar;
            });
            
            // Actualizar productos con información fiscal
            validProducts.forEach(product => {
              if (taxInfoMap[product.product_id]) {
                product.tax_code_ar = taxInfoMap[product.product_id];
                console.log(`✅ Tax code asignado: Producto ${product.product_id} (${product.name}) -> ${product.tax_code_ar}`);
              }
            });
          }
        } catch (taxError) {
          console.warn('⚠️ No se pudo obtener información fiscal adicional:', taxError);
        }

        setProducts(validProducts);

        console.log(`✅ PRODUCTOS FINALES CARGADOS: ${validProducts.length} productos válidos con precios > 0`);
        console.log(`📊 ESTADÍSTICAS:`);
        console.log(`   - Total obtenido del API: ${allProducts.length}`);
        console.log(`   - Productos con precios válidos: ${validProducts.length}`);
        console.log(`   - Lista de precios: ${priceListCode} (${allProducts[0]?.price_list_name || 'N/A'})`);

        if (validProducts.length === 0) {
          showNotification('No se encontraron productos con precios válidos', 'warning');
        } else {
          showNotification(`${validProducts.length} productos cargados exitosamente`, 'success');
        }

      } catch (error) {
        console.error('❌ Error cargando TODOS los productos:', error);
        showNotification('Error al cargar productos: ' + error.message, 'error');
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [canAccessForm, authType]);

    useEffect(() => {
  }, [products]);

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
    console.log('🔍 VERIFICANDO CONDICIONES FECHAS:', {
      deliveryZone: deliveryZone?.name,
      orderTimeLimit: siteSettings?.orderTimeLimit,
      siteSettingsCompleto: siteSettings,
      deliveryDate: deliveryDate
    });

    if (deliveryZone && siteSettings?.orderTimeLimit) {
      const dates = calculateAvailableDeliveryDates(deliveryZone, siteSettings.orderTimeLimit);
      setAvailableDeliveryDays(dates);

      console.log('🔍 FECHAS CALCULADAS:', {
        fechasGeneradas: dates.length,
        primerasFechas: dates.slice(0, 3).map(d => d.toISOString().split('T')[0]),
        zone: deliveryZone.name
      });

      if (deliveryDate) {
        // Usar función de normalización de zona horaria
        const selectedDate = adjustDateForTimezone(deliveryDate);
        
        const isDateAvailable = dates.some(date => {
          const normalizedAvailable = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const normalizedSelected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
          return normalizedAvailable.getTime() === normalizedSelected.getTime();
        });
        
        if (!isDateAvailable) {
          console.log('⚠️ Fecha seleccionada no válida, limpiando...');
          setDeliveryDate('');
        }
      }
    } else {
      console.log('❌ Condiciones no cumplidas para calcular fechas');
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

  useEffect(() => {
  // Condición: usuario autenticado, tipo BRANCH y aún no hay sucursal seleccionada
  const shouldLoadBranchInfo =
    authType === AUTH_TYPES.BRANCH &&
    isAuthenticated &&
    !selectedBranch;

  if (shouldLoadBranchInfo) {
    const loadBranchInfo = async () => {
      try {
        // Llamada API idéntica a Products para asegurar consistencia
        const response = await API.get('/branch-auth/profile');
        if (response.data.success) {
          const branchData = response.data.data;

          // Construir objeto branchOption idéntico
          const branchOption = {
            value: branchData.branch_id,
            label: branchData.branch_name,
            address: branchData.address,
            municipality_code: branchData.municipality_code,
            city: branchData.city || "",
            municipality_name: getCityNameByDANECode(branchData.municipality_code),
            data: branchData // opcional, si lo usas en selects
          };

          setSelectedBranch(branchOption);
          setBranchAddress(branchData.address || '');
          setDeliveryAddress(branchData.address || '');

          // Zona de entrega
          const zone = getDeliveryZoneByDANECode(
            branchData.municipality_code,
            branchData.city || ""
          );
          setDeliveryZone(zone);

          setDeliveryDate('');
          if (zone) {
            const dates = calculateAvailableDeliveryDates(
              zone,
              siteSettings?.orderTimeLimit || '18:00'
            );
            setAvailableDeliveryDays(dates);
            // Si tienes función para setMunicipalityCode:
            if (typeof setMunicipalityCode === "function") {
              setMunicipalityCode(branchData.municipality_code);
            }
          } else {
            setAvailableDeliveryDays([]);
          }
        }
      } catch (error) {
        console.error('❌ Error cargando info de sucursal:', error);
        showNotification('Error al cargar información de sucursal', 'error');
      }
    };
    loadBranchInfo();
  }
  // solo dispara cuando relevante, igual que Products
}, [authType, isAuthenticated, selectedBranch, siteSettings, getCityNameByDANECode, getDeliveryZoneByDANECode, calculateAvailableDeliveryDates]);

  const handleDeliveryAddressChange = (e) => {
    setDeliveryAddress(e.target.value);
  };

  const calculateSubtotal = () => {
    return orderDetails.reduce((total, item) => {
      const itemTotal = item.quantity * item.unit_price;
      return total + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
  };

  const calculateShipping = (subtotal, totalTaxes) => {
    // Validar monto mínimo sin impuestos
    if (subtotal < MIN_ORDER_AMOUNT) {
      return null; // No se permite el pedido
    }
    
    // Calcular el subtotal con impuestos para determinar el flete
    const subtotalWithTaxes = subtotal + totalTaxes;
    
    if (subtotalWithTaxes >= SHIPPING_FREE_LIMIT) {
      return 0; // Envío gratis
    }
    
    if (subtotalWithTaxes >= SHIPPING_LIMIT) {
      // Aplicar flete de $10,000 + IVA del flete
      const baseShipping = 10000;
      const shippingIVA = baseShipping * IVA_RATE;
      return baseShipping + shippingIVA; // $10,000 + 19% = $11,900
    }
    
    return null; // No aplica (pedido menor a $50,000)
  };

  const calculateIVA = (subtotal) => {
    return subtotal * IVA_RATE;
  };

  const calculateImpuestoSaludable = (subtotal) => {
    return subtotal * IMPUESTO_SALUDABLE_RATE;
  };

  const calculateTaxByProduct = (orderDetails) => {
    let ivaTotal = 0;
    let impuestoSaludableTotal = 0;
    
    console.log('📊 === INICIO CÁLCULO DE IMPUESTOS ===');
    
    orderDetails.forEach(detail => {
      const itemSubtotal = detail.quantity * detail.unit_price;
      const product = products.find(p => p.product_id === parseInt(detail.product_id));
      
      if (product) {
        const taxCode = product.tax_code_ar;
        
        console.log(`📦 Producto: ${product.name} (ID: ${product.product_id})`);
        console.log(`   - Código fiscal: ${taxCode || 'NO DEFINIDO'}`);
        console.log(`   - Subtotal: $${itemSubtotal.toFixed(2)}`);
        
        if (taxCode === 'IVAG03') {
          // Sin impuestos para productos con IVAG03 (0%)
          console.log(`   ✅ IVAG03 detectado - SIN IMPUESTOS`);
        } else if (taxCode === 'IMSB+IVA') {
          // 39% impuesto saludable + 19% IVA
          const impSaludable = itemSubtotal * 0.39;
          const iva = itemSubtotal * IVA_RATE;
          impuestoSaludableTotal += impSaludable;
          ivaTotal += iva;
          console.log(`   ✅ IMSB+IVA detectado - Imp. Saludable: $${impSaludable.toFixed(2)}, IVA: $${iva.toFixed(2)}`);
        } else {
          // IVA normal (19%) para otros casos
          const iva = itemSubtotal * IVA_RATE;
          ivaTotal += iva;
          console.log(`   ⚠️ Aplicando IVA por defecto (19%): $${iva.toFixed(2)}`);
        }
      } else {
        // Fallback: IVA normal si no se encuentra el producto
        const iva = itemSubtotal * IVA_RATE;
        ivaTotal += iva;
        console.log(`   ❌ Producto no encontrado en array, aplicando IVA por defecto: $${iva.toFixed(2)}`);
      }
    });
    
    console.log('📊 === RESUMEN DE IMPUESTOS ===');
    console.log(`   - IVA Total: $${ivaTotal.toFixed(2)}`);
    console.log(`   - Impuesto Saludable Total: $${impuestoSaludableTotal.toFixed(2)}`);
    
    return { ivaTotal, impuestoSaludableTotal };
  };

  const subtotal = calculateSubtotal();
  const { ivaTotal, impuestoSaludableTotal } = calculateTaxByProduct(orderDetails);
  const totalTaxes = ivaTotal + impuestoSaludableTotal;
  const shipping = calculateShipping(subtotal, totalTaxes);
  const total = shipping !== null ? subtotal + totalTaxes + shipping : subtotal + totalTaxes;

  const formatProductName = (product) => {
    const price = product.has_custom_price && product.custom_price_info 
      ? product.custom_price_info.price 
      : parseFloat(product.effective_price || product.price_list1 || product.price_list || product.price || 0);
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
          newDetails[index].original_price = parseFloat(selectedProduct.effective_price || selectedProduct.price_list1 || selectedProduct.price_list || selectedProduct.price || 0);
        } else {
          const defaultPrice = parseFloat(selectedProduct.effective_price || selectedProduct.price_list1 || selectedProduct.price_list || selectedProduct.price || 0);
          newDetails[index].unit_price = defaultPrice;
          newDetails[index].price_source = 'default';
          newDetails[index].original_price = defaultPrice;
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

    const { ivaTotal, impuestoSaludableTotal } = calculateTaxByProduct(orderDetails);
    const totalTaxes = ivaTotal + impuestoSaludableTotal;
    const shipping = calculateShipping(subtotal, totalTaxes);

    return shipping !== null ? subtotal + totalTaxes + shipping : subtotal + totalTaxes;
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

    // Crear fecha a partir del string sin problemas de zona horaria
    //const [year, month, day] = deliveryDate.split('-').map(Number);
    //const selectedDate = new Date(year, month - 1, day); // month - 1 porque los meses en Date van de 0-11
    //const isDateAvailable = availableDeliveryDays.some(date => {
      //const normalizedAvailable = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      //const normalizedSelected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      //return normalizedAvailable.getTime() === normalizedSelected.getTime();
    //});

    //if (!isDateAvailable) {
      //showNotification(`La fecha seleccionada no está disponible para entregas en ${deliveryZone.name}`, 'error');
      //return;
    //}

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

      console.log('=== INICIANDO DEBUG handleConfirmCreateOrder ===');
      const { ivaTotal, impuestoSaludableTotal } = calculateTaxByProduct(orderDetails);
      const totalTaxes = ivaTotal + impuestoSaludableTotal;
      const totalAmount = parseFloat(calculateTotal());

      const isBranchUser = authType === AUTH_TYPES.BRANCH;

      let orderData;

      if (isBranchUser) {
        // 🏢 PAYLOAD PARA USUARIO BRANCH - usar datos COMPLETOS del localStorage
        const branchDataStorage = localStorage.getItem('branchData');
        const priceListStorage = localStorage.getItem('priceListProfile');

        if (!branchDataStorage) {
          throw new Error('No se encontraron datos de sucursal');
        }

        const branchInfo = JSON.parse(branchDataStorage);
        const priceListInfo = priceListStorage ? JSON.parse(priceListStorage) : {};

        // ✅ VALIDACIÓN EXTRA: Verificar contexto antes de proceder
        if (!branchInfo || !branchInfo.user_id || !branchInfo.client_id) {
          console.error('❌ CONTEXTO INVÁLIDO - Forzando recarga de datos...', {
            hasBranchInfo: !!branchInfo,
            hasUserId: !!branchInfo?.user_id,
            hasClientId: !!branchInfo?.client_id
          });
          
          // Intentar recargar el contexto
          try {
            const profileResponse = await API.get('/branch-auth/profile');
            if (profileResponse.data.success && profileResponse.data.data) {
              const updatedBranchInfo = {
                ...profileResponse.data.data,
                type: 'branch'
              };
              
              // Actualizar localStorage
              localStorage.setItem('branchData', JSON.stringify(updatedBranchInfo));
              
              console.log('✅ Contexto recargado exitosamente');
              
              // Usar los datos actualizados
              Object.assign(branchInfo, updatedBranchInfo);
            } else {
              throw new Error('No se pudieron recargar los datos');
            }
          } catch (refreshError) {
            console.error('❌ Error recargando contexto:', refreshError);
            throw new Error('Datos de usuario incompletos. Por favor, cierra sesión e inicia sesión nuevamente.');
          }
        }

        console.log('🏢 Datos completos de Branch disponibles:', {
          branch_id: branchInfo.branch_id,
          user_id: branchInfo.user_id,
          client_id: branchInfo.client_id,
          user_name: branchInfo.user_name,
          user_cardcode_sap: branchInfo.user_cardcode_sap
        });

        // VALIDAR QUE TODOS LOS DATOS CRÍTICOS ESTÉN PRESENTES
        if (!branchInfo.user_id || !branchInfo.client_id || !branchInfo.branch_id) {
          console.error('❌ ERROR CRÍTICO: Datos faltantes en branchData:', {
            hasUserId: !!branchInfo.user_id,
            hasClientId: !!branchInfo.client_id,
            hasBranchId: !!branchInfo.branch_id,
            fullBranchInfo: branchInfo
          });
          
          // Intentar una última recarga antes de fallar
          if (refreshAuth && typeof refreshAuth === 'function') {
            console.log('🔄 Intentando refresh de autenticación...');
            const refreshSuccess = await refreshAuth();
            if (refreshSuccess) {
              const updatedBranchData = JSON.parse(localStorage.getItem('branchData') || '{}');
              if (updatedBranchData.user_id && updatedBranchData.client_id) {
                Object.assign(branchInfo, updatedBranchData);
                console.log('✅ Datos actualizados después del refresh');
              }
            }
          }
          
          // Verificar una vez más después del intento de refresh
          if (!branchInfo.user_id || !branchInfo.client_id || !branchInfo.branch_id) {
            throw new Error('Datos de usuario incompletos. Por favor, cierra sesión e inicia sesión nuevamente.');
          }
        }

        // VALIDAR QUE TODOS LOS DATOS CRÍTICOS ESTÉN PRESENTES
        if (!branchInfo.user_id) {
          console.error('❌ ERROR CRÍTICO: user_id no encontrado en branchData:', branchInfo);
          throw new Error('Datos de usuario incompletos. Por favor, cierra sesión e inicia sesión nuevamente.');
        }

        orderData = {
          // IDENTIFICACIÓN COMPLETA (BRANCH + USER)
          branch_id: branchInfo.branch_id,
          client_id: branchInfo.client_id,
          user_id: branchInfo.user_id, // ← USAR EL user_id REAL DEL CONTEXTO
          order_type: 'BRANCH_ORDER',

          // INFORMACIÓN FINANCIERA
          total_amount: totalAmount,
          subtotal_amount: subtotal,
          iva_amount: ivaTotal,
          shipping_amount: shipping || 0,

          // INFORMACIÓN DE ENTREGA
          delivery_date: deliveryDate,
          notes: orderNotes,
          comments: orderNotes,
          delivery_zone: deliveryZone ? deliveryZone.key : null,
          delivery_zone_name: deliveryZone ? deliveryZone.name : branchInfo.city,
          municipality_dane_code: branchInfo.municipality_code,

          // LISTA DE PRECIOS
          price_list_code: priceListInfo.price_list_code || '1',
          has_custom_pricing: !!(priceListInfo.price_list_code && priceListInfo.price_list_code !== '1'),

          // INFORMACIÓN COMPLETA DE BRANCH
          branch_name: branchInfo.branch_name || branchInfo.branchname,
          branch_address: branchInfo.address,
          branch_email: branchInfo.email_branch || branchInfo.email,
          branch_phone: branchInfo.phone,
          company_name: branchInfo.company_name,
          nit_number: branchInfo.nit_number,
          ship_to_code: branchInfo.ship_to_code,

          // INFORMACIÓN DEL USUARIO PRINCIPAL ASOCIADO
          user_name: branchInfo.user_name,
          user_email: branchInfo.user_email,
          user_cardcode_sap: branchInfo.user_cardcode_sap,
          user_cardtype_sap: branchInfo.user_cardtype_sap,

          // DETALLES DE PRODUCTOS
         products: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id || 0),
          quantity: parseInt(detail.quantity || 0),
          unit_price: parseFloat(detail.unit_price || 0),

            // Branch como origen Y destino
            branch_id: branchInfo.branch_id,
            branch_name: branchInfo.branch_name || branchInfo.branchname,
            branch_address: branchInfo.address,
            delivery_address: branchInfo.address,
            shipping_fee: shipping || 0,
            municipality_dane_code: branchInfo.municipality_code,

            // Información del usuario principal
            user_id: branchInfo.user_id,
            client_id: branchInfo.client_id
          }))
        };

        console.log('🏢 Payload BRANCH COMPLETO construido:', {
          branch_id: orderData.branch_id,
          user_id: orderData.user_id, // ← VERIFICAR QUE ESTÉ PRESENTE
          client_id: orderData.client_id,
          company_name: orderData.company_name,
          totalItems: orderData.products.length
        });

      } else {
        // 👤 PAYLOAD USUARIO PRINCIPAL - ESTRUCTURA CORREGIDA
        orderData = {
          user_id: user.id,
          total_amount: totalAmount,
          delivery_date: deliveryDate,
          notes: orderNotes,
          comments: orderNotes,
          
          // ✅ INFORMACIÓN DE SUCURSAL OBLIGATORIA
          branch_id: selectedBranch ? selectedBranch.value : null,
          branch_address: branchAddress,
          delivery_zone: deliveryZone ? deliveryZone.key : null,
          delivery_zone_name: deliveryZone ? deliveryZone.name : null,
          municipality_dane_code: selectedBranch ? selectedBranch.municipality_code : null,
          
          // PRECIOS
          price_list_code: userPriceListCode || 'GENERAL',
          has_custom_pricing: userPriceListCode && userPriceListCode !== 'GENERAL',
          subtotal_amount: subtotal,
          iva_amount: ivaTotal,
          shipping_amount: shipping || 0,
          
          // ✅ DETALLES CON BRANCH_ID INCLUIDO
          details: orderDetails.map(detail => ({
            product_id: parseInt(detail.product_id || 0),
            quantity: parseInt(detail.quantity || 0),
            branch_id: selectedBranch ? selectedBranch.value : null,  // ✅ ASEGURAR QUE ESTÉ PRESENTE
            branch_name: selectedBranch ? selectedBranch.label : '',
            unit_price: parseFloat(detail.unit_price || 0),
            price_source: detail.price_source || 'default',
          }))
        };

        console.log('👤 Payload USER construido:', orderData);
      }

      let formData = null;
      if (orderFile) {
        formData = new FormData();
        formData.append('orderFile', orderFile);

        if (isBranchUser) {
          const branchInfo = JSON.parse(localStorage.getItem('branchData'));
          formData.append('branch_id', branchInfo.branch_id.toString());
          formData.append('user_id', branchInfo.user_id.toString());
        } else {
          formData.append('user_id', user.id.toString());
        }

        formData.append('orderData', JSON.stringify(orderData));
      }

      let result;
      if (formData) {
        result = await orderService.createOrder(formData, true);
      } else {
        result = await orderService.createOrder(orderData, false);
      }

      if (result.success) {
        showNotification('Pedido creado exitosamente', 'success');
        // Reset form...
        setOrderDetails([{ product_id: '', quantity: 1, unit_price: 0 }]);
        setDeliveryDate('');
        setOrderFile(null);
        setOrderNotes('');

        if (!isBranchUser) {
          setSelectedBranch(null);
          setBranchAddress('');
          setDeliveryAddress('');
          setDeliveryZone(null);
        }

        if (onOrderCreated) onOrderCreated(result.data);
      } else {
        throw new Error(result.message || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      
      // Manejo específico para errores de fecha
      if (error.response?.status === 400 && error.response?.data?.message?.includes('fecha de entrega')) {
        showNotification(
          `Error de fecha: ${error.response.data.message}. Selecciona otra fecha disponible.`,
          'error'
        );
        // Limpiar la fecha seleccionada para forzar nueva selección
        setDeliveryDate('');
      } else {
        showNotification(error.message || 'Ocurrió un error al procesar tu pedido', 'error');
      }
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
    
    if (!products || products.length === 0) {
      return [];
    }

    const options = products.map(product => {
    // CORREGIR: usar la misma lógica de fallbacks que en handleSelectChange
    const price = parseFloat(
      product.price || 
      product.effective_price || 
      product.price_list1 || 
      product.price_list || 
      product.unit_price || 
      0
    );

    return {
      value: product.product_id,
      label: (product.name || product.local_product_name || product.product_name || 'Producto sin nombre').trim(),
      image: product.image_url,
      price: price,
      productData: product
    };
  });
  return options;
  }, [products]);

  const handleSelectChange = (index, option) => {
    const newDetails = [...orderDetails];
    if (option) {
      newDetails[index].product_id = option.value;
      const selectedProduct = products.find(p => p.product_id === parseInt(option.value));

      // AGREGAR A PRODUCTOS SELECCIONADOS PARA CARGAR IMAGEN - CON TOLERANCIA A ERRORES
      setSelectedProductImages(prev => new Set([...prev, parseInt(option.value)]));
      setAllProductImages(prev => new Set([...prev, parseInt(option.value)]));

      // Verificar si la imagen existe antes de forzar carga
      if (!errorCache.has(`${option.value}-thumbnail`)) {
        setTimeout(() => {
          setVisibleOptions(prev => new Set([...prev, parseInt(option.value)]));
        }, 50);
      }

      if (selectedProduct) {
        // CORREGIR: usar la cadena completa de fallbacks de precios
        const productPrice = parseFloat(
          selectedProduct.price || 
          selectedProduct.effective_price || 
          selectedProduct.price_list1 || 
          selectedProduct.price_list || 
          selectedProduct.unit_price || 
          0
        );

        newDetails[index].unit_price = productPrice;
        newDetails[index].price_source = selectedProduct.price_source || 'price_list';
        newDetails[index].original_price = productPrice;

        console.log('✅ Producto seleccionado:', {
          name: selectedProduct.name,
          price: productPrice,
          source: selectedProduct.price_source || 'price_list',
          hasImageError: errorCache.has(`${option.value}-thumbnail`)
        });
      }
    } else {
      // LIMPIAR cuando se deselecciona - mejorado
      if (newDetails[index].product_id) {
        const oldProductId = parseInt(newDetails[index].product_id);
        setSelectedProductImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(oldProductId);
          return newSet;
        });
        
        // Limpiar también de visibleOptions con delay
        setTimeout(() => {
          setVisibleOptions(prev => {
            const updated = new Set(prev);
            updated.delete(oldProductId);
            return updated;
          });
        }, 1000);
      }
      
      newDetails[index].product_id = '';
      newDetails[index].unit_price = 0;
      newDetails[index].price_source = '';
      newDetails[index].original_price = 0;
    }

    setOrderDetails(newDetails);
  };

  const formatOptionLabel = ({ value, label, image, price, productData }) => {
    // Determinar si debe cargar imagen basado en cache de errores y disponibilidad
    const hasErrorCached = errorCache && errorCache.has(`${value}-thumbnail`);
    const shouldLoadImage = (
      visibleOptions.has(value) || 
      selectedProductImages.has(value) || 
      allProductImages.has(value) ||
      productOptionsForSelect.findIndex(opt => opt.value === value) < 5
    ) && !hasErrorCached;

    // Validación adicional para productos con nombres largos
    const displayLabel = label || productData?.name || 'Producto sin nombre';
    const truncatedLabel = displayLabel.length > 50 
      ? displayLabel.substring(0, 47) + '...' 
      : displayLabel;

    return (
      <div className="flex items-center py-1" data-product-id={value}>
        <ProductImageSmall
          productId={value}
          alt={label}
          className="w-8 h-8 mr-3"
          shouldLoad={shouldLoadImage}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 leading-tight truncate">
            {truncatedLabel}
          </div>
          {price && price > 0 && (
            <div className="text-xs text-gray-500">{formatCurrencyCOP(price)}</div>
          )}
        </div>
      </div>
    );
  };

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

  // Componente customizado para manejar la lista del Select con lazy loading
  // Componente customizado para manejar la lista del Select con scroll limitado y lazy loading optimizado
  const MenuList = useCallback((props) => {
    const { children, ...otherProps } = props;
    const observer = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
      if (!listRef.current) return;

      if (observer.current) {
        observer.current.disconnect();
      }

      observer.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const productId = entry.target.getAttribute('data-product-id');
              if (productId && !isNaN(productId)) {
                const numProductId = parseInt(productId);
                // Debounce más agresivo para evitar sobrecarga
                setTimeout(() => {
                  throttledSetVisibleOptions(numProductId);
                }, 200);
              }
            }
          });
        },
        {
          root: listRef.current,
          rootMargin: '50px', // Aumentar margen para mejor precarga
          threshold: 0.1
        }
      );

      // Delay para asegurar que el DOM esté listo
      setTimeout(() => {
        const options = listRef.current?.querySelectorAll('[data-product-id]');
        options?.forEach(option => {
          if (observer.current) {
            observer.current.observe(option);
          }
        });
      }, 100);

      return () => {
        if (observer.current) {
          observer.current.disconnect();
          observer.current = null;
        }
      };
    }, []);

    return (
      <div 
        ref={listRef} 
        {...otherProps}
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          ...otherProps.style
        }}
      >
        {children}
      </div>
    );
  }, [throttledSetVisibleOptions]);

  // Verificación de estado de carga
  if (isValidating) {
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

  // Verificación de acceso
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
                        className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
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

  // Verificación final de estados de carga
  if (loadingProducts || loadingSettings) {
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-600">Cargando productos...</p>
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
                      {detail.product_id && parseInt(detail.product_id) > 0 ? (
                        <ProductImageSmall
                          productId={parseInt(detail.product_id)}
                          alt={selectedProduct?.name || 'Producto'}
                          className="w-16 h-16"
                          shouldLoad={true}
                        />
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
                        noOptionsMessage={() => 'No se encontraron productos'}
                        loadingMessage={() => 'Cargando productos...'}
                        isLoading={products.length === 0}
                        components={{
                          MenuList: MenuList
                        }}
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
                            minWidth: '300px',
                            maxHeight: '240px', // NUEVO: Limitar altura total del menú
                          }),
                          menuList: (base) => ({  // NUEVO: Estilos específicos para la lista
                            ...base,
                            maxHeight: '200px',   // Altura interna del scroll
                            overflowY: 'auto',    // Scroll vertical
                            padding: '4px 0',     // Padding mínimo
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
            {ivaTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">IVA (19%):</span>
                <span className="font-semibold text-gray-800">{formatCurrencyCOP(ivaTotal)}</span>
              </div>
            )}

            {/* Impuesto Saludable */}
            {impuestoSaludableTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">
                  Impuesto Saludable (39%) + IVA:
                </span>
                <span className="font-semibold text-gray-800">{formatCurrencyCOP(impuestoSaludableTotal)}</span>
              </div>
            )}

            {/* Flete */}
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Flete:</span>
              {shipping === 0 ? (
                <span className="text-green-600 font-bold">¡Envío gratis!</span>
              ) : shipping > 0 ? (
                <span className="text-blue-700 font-semibold">{formatCurrencyCOP(shipping)}</span>
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
                {ivaTotal > 0 && (
                  <div className="flex justify-between">
                    <span>IVA (19%):</span>
                    <span>{formatCurrencyCOP(ivaTotal)}</span>
                  </div>
                )}
                {impuestoSaludableTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Impuesto Saludable (39%):</span>
                    <span>{formatCurrencyCOP(impuestoSaludableTotal)}</span>
                  </div>
                )}
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