import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { AUTH_TYPES } from '../../../../constants/AuthTypes';
import { orderService } from '../../../../services/orderService';
import API from '../../../../api/config';
import DeliveryDatePicker from './DeliveryDatePicker';
import OrderFileUpload from './OrderFileUpload';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import Notification from '../../../../Components/ui/Notification';

const EditOrderForm = ({ onOrderUpdated }) => {
  const navigate = useNavigate();
  const { user, branch, authType, isAuthenticated } = useAuth();
  const { orderId } = useParams();

  const getRoutePrefix = () => {
    return authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
  };
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [orderDetails, setOrderDetails] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderFile, setOrderFile] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [siteSettings, setSiteSettings] = useState({ orderTimeLimit: '18:00' });
  const [canEdit, setCanEdit] = useState(true);
  const [editNotAllowedReason, setEditNotAllowedReason] = useState('');
  // ✅ NUEVOS ESTADOS PARA ZONA DE ENTREGA Y FECHAS DISPONIBLES
  const [deliveryZone, setDeliveryZone] = useState(null);
  const [availableDeliveryDays, setAvailableDeliveryDays] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  // Agregar este estado junto a los demás estados
  const [customerPoNumber, setCustomerPoNumber] = useState('');

  // Cargar configuración del sitio
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        console.log("Obteniendo configuración del sitio...");
        const response = await API.get('/admin/settings');
        console.log("Respuesta de configuración:", response.data);

        if (response.data && response.data.success) {
          const settingsData = response.data.data || {};
          if (!settingsData.orderTimeLimit) {
            // Si no hay valor, usar la hora de trabajo estándar como predeterminada pero emitir advertencia
            console.warn('No se encontró orderTimeLimit en la configuración, usando hora predeterminada');
            settingsData.orderTimeLimit = '17:00'; // Un valor diferente para mostrar que es por defecto
          }
          console.log("Configuración cargada:", settingsData);
          setSiteSettings(settingsData);
        }
      } catch (error) {
        console.error('Error fetching site settings:', error);
      }
    };

    fetchSettings();
  }, []);

  // ✅ CARGAR ZONA DE ENTREGA PARA BRANCHES
  useEffect(() => {
    const loadBranchDeliveryZone = async () => {
      // Solo ejecutar para branches
      if (authType !== AUTH_TYPES.BRANCH || !branch) return;

      try {
        console.log('🏢 [BRANCH] Cargando zona de entrega para el branch...');
        
        // Obtener información completa del branch
        const response = await API.get('/branch-auth/profile');
        
        if (response.data.success) {
          const branchData = response.data.data;
          
          console.log('🏢 [BRANCH] Datos del branch:', {
            branch_id: branchData.branch_id,
            branch_name: branchData.branch_name,
            municipality_code: branchData.municipality_code,
            city: branchData.city
          });

          // Construir objeto de sucursal
          const branchInfo = {
            value: branchData.branch_id,
            label: branchData.branch_name,
            address: branchData.address,
            municipality_code: branchData.municipality_code,
            city: branchData.city || "",
            municipality_name: getCityNameByDANECode(branchData.municipality_code)
          };

          setSelectedBranch(branchInfo);

          // Determinar zona de entrega
          const zone = getDeliveryZoneByDANECode(
            branchData.municipality_code,
            branchData.city || ""
          );

          if (zone) {
            setDeliveryZone(zone);
            
            // Calcular fechas disponibles
            const dates = calculateAvailableDeliveryDates(
              zone,
              siteSettings?.orderTimeLimit || '18:00'
            );
            setAvailableDeliveryDays(dates);

            console.log('✅ [BRANCH] Zona de entrega configurada:', {
              zone: zone.name,
              daysOfWeek: zone.days,
              availableDatesCount: dates.length,
              firstAvailableDates: dates.slice(0, 3).map(d => d.toISOString().split('T')[0])
            });
          } else {
            console.warn('⚠️ [BRANCH] No se pudo determinar la zona de entrega');
            setDeliveryZone(null);
            setAvailableDeliveryDays([]);
          }
        }
      } catch (error) {
        console.error('❌ [BRANCH] Error cargando zona de entrega:', error);
        setDeliveryZone(null);
        setAvailableDeliveryDays([]);
      }
    };

    loadBranchDeliveryZone();
  }, [authType, branch, siteSettings]);

  // Cargar el pedido actual
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) {
        showNotification('ID de pedido no proporcionado', 'error');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Intentando obtener orden con ID:', orderId);

        // ✅ USAR ENDPOINT ESPECÍFICO SEGÚN CONTEXTO
        let result;
        if (authType === AUTH_TYPES.BRANCH) {
          console.log('🏢 [BRANCH] Obteniendo detalles de orden');
          const response = await API.get(`/branch-orders/${orderId}`);
          result = {
            success: response.data?.success || false,
            data: response.data?.data || null
          };
        } else {
          console.log('👤 [USER] Obteniendo detalles de orden');
          result = await orderService.getOrderById(orderId);
        }

        if (result && result.success) {
          const orderData = result.data;
          setOrder(orderData);

          // ✅ DEBUG: Mostrar estructura completa del pedido
          console.log('🔍 [DEBUG] Estructura completa del pedido:', {
            order: orderData,
            hasDetails: !!orderData.details,
            detailsLength: orderData.details?.length || 0,
            hasOrderDetails: !!orderData.orderDetails,
            orderDetailsLength: orderData.orderDetails?.length || 0,
            sampleDetail: orderData.details?.[0] || orderData.orderDetails?.[0]
          });

          // ✅ VERIFICACIÓN DE PERMISOS SEGÚN CONTEXTO
          const currentUserId = authType === AUTH_TYPES.BRANCH ? branch?.branch_id : user?.id;
          const orderUserId = authType === AUTH_TYPES.BRANCH ? orderData.branch_id : orderData.user_id;

          if (orderUserId !== currentUserId) {
            setCanEdit(false);
            setEditNotAllowedReason('No tienes permiso para editar este pedido');
            return;
          }

          // ✅ PARA BRANCH: Misma validación que USER (pueden editar, no solo cancelar)
          if (authType === AUTH_TYPES.BRANCH) {
            const nonModifiableStates = [4, 5, 6]; // Entregado, Cerrado, Cancelado
            if (nonModifiableStates.includes(orderData.status_id)) {
              setCanEdit(false);
              setEditNotAllowedReason(`No se puede modificar un pedido en estado: ${orderData.status_name || orderData.status}`);
              return;
            }
            
            // Para branches, también validar hora límite similar a usuarios principales
            const deliveryDate = new Date(orderData.delivery_date);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const deliveryDay = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate());

            const diffTime = deliveryDay.getTime() - today.getTime();
            const daysUntilDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysUntilDelivery < 0) {
              setCanEdit(false);
              setEditNotAllowedReason('La fecha de entrega ya pasó - no se puede editar');
              return;
            }

            if (daysUntilDelivery <= 2) {
              const [limitHours, limitMinutes] = siteSettings.orderTimeLimit.split(':').map(Number);
              
              if (now.getHours() > limitHours || (now.getHours() === limitHours && now.getMinutes() >= limitMinutes)) {
                setCanEdit(false);
                setEditNotAllowedReason(`No se puede editar después de las ${siteSettings.orderTimeLimit} cuando faltan ${daysUntilDelivery} días o menos para la entrega`);
                return;
              }
            }
          } else {
            // ✅ VALIDACIONES PARA USUARIOS PRINCIPALES
            if (['completado', 'completed', 'entregado', 'delivered', 'cancelado', 'canceled'].includes(
              orderData.status?.toLowerCase()
            )) {
              setCanEdit(false);
              setEditNotAllowedReason(`No se puede editar un pedido con estado: ${orderData.status}`);
              return;
            }

            // ✅ VALIDAR HORA LÍMITE BASADA EN FECHA DE ENTREGA
            const deliveryDate = new Date(orderData.delivery_date);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const deliveryDay = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate());

            // Calcular días hasta la entrega
            const diffTime = deliveryDay.getTime() - today.getTime();
            const daysUntilDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            console.log('🔍 Validación de edición:', {
              deliveryDate: deliveryDay.toLocaleDateString('es-ES'),
              daysUntilDelivery,
              orderTimeLimit: siteSettings.orderTimeLimit
            });

            // Si la fecha de entrega ya pasó
            if (daysUntilDelivery < 0) {
              setCanEdit(false);
              setEditNotAllowedReason('La fecha de entrega ya pasó - no se puede editar');
              return;
            }

            // Si faltan 2 días o menos, verificar hora límite
            if (daysUntilDelivery <= 2) {
              const [limitHours, limitMinutes] = siteSettings.orderTimeLimit.split(':').map(Number);
              
              if (now.getHours() > limitHours || (now.getHours() === limitHours && now.getMinutes() >= limitMinutes)) {
                setCanEdit(false);
                setEditNotAllowedReason(`No se puede editar después de las ${siteSettings.orderTimeLimit} cuando faltan ${daysUntilDelivery} días o menos para la entrega`);
                return;
              }
            }
          }

          // ✅ CONFIGURAR DATOS SEGÚN TIPO DE USUARIO
          if (authType === AUTH_TYPES.BRANCH) {
            // Para BRANCH: configurar fecha de entrega y comentarios
            setDeliveryDate(orderData.delivery_date?.split('T')[0] || '');
            setOrderNotes(orderData.comments || ''); // BRANCH usa 'comments' en lugar de 'notes'
            console.log('🏢 [BRANCH] Datos del pedido configurados, productos se mapearán en useEffect separado');
          } else {
            // Para USER: configurar todos los datos
            setDeliveryDate(orderData.delivery_date?.split('T')[0] || '');
            setOrderNotes(orderData.notes || '');

            if (orderData.details && orderData.details.length > 0) {
              setOrderDetails(orderData.details.map(detail => ({
                product_id: detail.product_id.toString(),
                quantity: detail.quantity,
                unit_price: detail.unit_price
              })));
            }
          }

          // Agregar esta línea:
          setCustomerPoNumber(orderData.customer_po_number || '');
        } else {
          throw new Error('No se pudo obtener los detalles del pedido');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        showNotification(error.message || 'Error al cargar los detalles del pedido', 'error');
        setCanEdit(false);
        setEditNotAllowedReason('Error al cargar los detalles del pedido');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, user, branch, authType, siteSettings.orderTimeLimit]);

  // Cargar productos disponibles
  useEffect(() => {
    // Cargar productos para todos los usuarios
    if (authType === AUTH_TYPES.USER || authType === AUTH_TYPES.BRANCH) {
      const fetchProducts = async () => {
        console.log('🚀 Iniciando fetchProducts - CARGANDO TODOS LOS PRODUCTOS:', {
          authType,
          timestamp: new Date().toISOString()
        });
        setLoadingProducts(true);

        try {
          let allProducts = [];
          let totalProductCount = 0;

          // Para BRANCH, obtener productos de su catálogo heredado
          if (authType === AUTH_TYPES.BRANCH) {
            try {
              console.log('🏢 Obteniendo productos para branch desde catálogo heredado');
              const response = await API.get('/branch-orders/products');
              
              if (response.data.success && response.data.data?.products) {
                allProducts = response.data.data.products.map(product => ({
                  product_id: product.product_id,
                  name: product.name || product.product_name,
                  description: product.description,
                  sap_code: product.sap_code,
                  price: parseFloat(product.inherited_price || product.custom_price || 0),
                  price_list1: parseFloat(product.inherited_price || product.custom_price || 0),
                  effective_price: parseFloat(product.inherited_price || product.custom_price || 0),
                }));
                
                totalProductCount = allProducts.length;
                
                console.log(`✅ Productos branch cargados: ${allProducts.length}`);
              }
            } catch (error) {
              console.warn('⚠️ Error obteniendo productos para branch:', error.message);
            }
          } else {
            // Para usuarios principales, cargar desde price-lists
            let priceListCode = '1';
            
            try {
              console.log('👤 Obteniendo price_list_code para usuario PRINCIPAL...');
              const userResponse = await API.get('/auth/profile');
              if (userResponse.data.success && userResponse.data.data.price_list_code) {
                priceListCode = userResponse.data.data.price_list_code;
              }
            } catch (error) {
              console.warn('⚠️ Error obteniendo price_list_code de usuario, usando fallback:', error.message);
            }

            console.log(`🎯 Usando lista de precios: ${priceListCode}`);

            // CARGAR TODOS LOS PRODUCTOS CON PAGINACIÓN COMPLETA
            let currentPage = 1;
            let totalPages = 1;

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

                if (response.data.pagination) {
                  totalPages = response.data.pagination.totalPages;
                  totalProductCount = response.data.pagination.totalCount;
                  console.log(`✅ Página ${currentPage}/${totalPages} cargada: ${pageProducts.length} productos (Total: ${allProducts.length}/${totalProductCount})`);
                }

                currentPage++;
              } else {
                throw new Error(response.data.message || 'Error en respuesta del API');
              }

              if (currentPage > 20) {
                console.warn('⚠️ Límite de seguridad alcanzado (20 páginas)');
                break;
              }

            } while (currentPage <= totalPages);
          }

          console.log(`🎉 CARGA COMPLETA: ${allProducts.length} productos cargados de ${totalProductCount} disponibles`);

          // MAPEO DE PRODUCTOS (solo para usuarios principales, branch ya viene mapeado)
          let mappedProducts = allProducts;
          
          if (authType === AUTH_TYPES.USER) {
            mappedProducts = allProducts.map((plProduct, index) => {
              const priceValue = parseFloat(plProduct.price) || 0;

              return {
                product_id: plProduct.product_id || (index + 1),
                name: plProduct.local_product_name || plProduct.product_name,
                description: plProduct.local_product_description || plProduct.product_name,
                sap_code: plProduct.product_code,
                code: plProduct.product_code,
                price: priceValue,
                price_list1: priceValue,
                effective_price: priceValue,
                unit_price: priceValue,
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
                _original: plProduct
              };
            });
          }

          // FILTRAR PRODUCTOS CON PRECIOS VÁLIDOS
          const validProducts = mappedProducts.filter(product => {
            const price = parseFloat(product.price);
            return price > 0;
          });

          setProducts(validProducts);

          if (validProducts.length === 0) {
            showNotification('No se encontraron productos con precios válidos para tu lista de precios', 'warning');
          } else {
            console.log(`✅ Productos listos para edición: ${validProducts.length} productos cargados`);
          }

        } catch (error) {
          console.error('❌ Error cargando productos para edición:', error);
          showNotification('Error al cargar productos: ' + error.message, 'error');
          setProducts([]);
        } finally {
          setLoadingProducts(false);
        }
      };

      fetchProducts();
    }
  }, [authType, user?.id]);

  useEffect(() => {
    // ✅ MAPEAR DATOS SEGÚN CONTEXTO
    if (order) {
      if (authType === AUTH_TYPES.BRANCH) {
        // ✅ Para Branch: usar 'products' del endpoint branch-orders
        if (order.products && order.products.length > 0) {
          console.log('🏢 [BRANCH] Mapeando productos desde field "products":', order.products);
          setOrderDetails(order.products.map(product => ({
            product_id: product.product_id.toString(),
            quantity: product.quantity,
            unit_price: product.unit_price,
            name: product.product_name || product.product_description || 'Producto sin nombre',
            line_total: product.line_total
          })));
        }
      } else {
        // ✅ Para Usuario Principal: usar 'details' como antes
        if (order.details && order.details.length > 0) {
          console.log('👤 [USER] Mapeando productos desde field "details":', order.details);
          const mappedDetails = order.details.map(detail => ({
            product_id: detail.product_id.toString(),
            quantity: detail.quantity,
            unit_price: parseFloat(detail.unit_price) || 0,
            name: detail.product_name || detail.name || 'Producto sin nombre'
          }));
          setOrderDetails(mappedDetails);
          
          console.log('✅ [USER] Detalles mapeados:', mappedDetails);
          
        } else if (order.orderDetails && order.orderDetails.length > 0) {
          // ✅ FALLBACK: Si viene como orderDetails
          console.log('👤 [USER] Mapeando productos desde field "orderDetails":', order.orderDetails);
          const mappedOrderDetails = order.orderDetails.map(detail => ({
            product_id: detail.product_id.toString(),
            quantity: detail.quantity,
            unit_price: parseFloat(detail.unit_price) || 0,
            name: detail.product_name || detail.name || 'Producto sin nombre'
          }));
          setOrderDetails(mappedOrderDetails);
          
          console.log('✅ [USER] OrderDetails mapeados:', mappedOrderDetails);
          
        } else {
          console.warn('👤 [USER] No se encontraron detalles del pedido en campos: details, orderDetails');
          console.log('👤 [USER] Estructura completa del pedido:', order);
          setOrderDetails([]);
        }
      }
    }
  }, [order, authType]);

  useEffect(() => {
    // ✅ ACTUALIZAR PRECIOS SOLO SI ES NECESARIO Y HAY PRODUCTOS CARGADOS
    if (authType !== AUTH_TYPES.BRANCH && products.length > 0 && orderDetails.length > 0) {
      console.log('🔄 Verificando necesidad de actualizar precios...', {
        productsCount: products.length,
        orderDetailsCount: orderDetails.length,
        sampleProduct: products[0],
        sampleOrderDetail: orderDetails[0]
      });

      let needsUpdate = false;
      
      const updatedDetails = orderDetails.map(detail => {
        const product = products.find(p => p.product_id.toString() === detail.product_id.toString());
        
        if (product) {
          const currentPrice = parseFloat(detail.unit_price) || 0;
          const productPrice = parseFloat(product.price || product.price_list1 || product.effective_price || 0);
          
          console.log(`📊 Comparando precios para producto ${product.name}:`, {
            currentPrice,
            productPrice,
            needsUpdate: currentPrice === 0 || Math.abs(currentPrice - productPrice) > 0.01
          });
          
          if (currentPrice === 0 || Math.abs(currentPrice - productPrice) > 0.01) {
            needsUpdate = true;
            return {
              ...detail,
              unit_price: productPrice,
              name: product.name || detail.name
            };
          }
        } else {
          console.warn(`⚠️ Producto no encontrado en catálogo:`, detail.product_id);
        }
        
        return detail;
      });
      
      if (needsUpdate) {
        console.log('🔄 Actualizando precios de productos:', updatedDetails);
        setOrderDetails(updatedDetails);
      } else {
        console.log('✅ No es necesario actualizar precios');
      }
    }
  }, [products, authType]); // Solo depende de products y authType

  const handleCancelOrderBranch = async () => {
    if (!window.confirm('¿Estás seguro que deseas cancelar este pedido? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setIsSubmitting(true);

      console.log('🏢 [BRANCH] Cancelando orden:', orderId);

      // Endpoint específico para branch orders o estándar con status 6
      const response = await API.put(`/branch-orders/${orderId}/status`, {
        status_id: 6, // ← Cambiar 'status' por 'status_id'
        note: 'Cancelado desde sucursal'
      });

      if (response.data && response.data.success) {
        showNotification('Pedido cancelado exitosamente', 'success');

        // Notificar al componente padre si existe
        if (onOrderUpdated) onOrderUpdated(response.data.data);

        // Redireccionar después de 2 segundos
        setTimeout(() => {
          navigate(`${getRoutePrefix()}/orders/${orderId}`);
        }, 2000);
      } else {
        throw new Error(response.data?.message || 'Error al cancelar el pedido');
      }

    } catch (error) {
      console.error('❌ [BRANCH] Error cancelando orden:', error);
      showNotification(
        error.response?.data?.message || 'Error al cancelar el pedido. Contacte al administrador.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función para actualizar orden completa desde sucursal (incluyendo productos)
  const handleSubmitBranchUpdate = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!deliveryDate) {
      showNotification('Por favor selecciona una fecha de entrega', 'warning');
      return;
    }

    // Validar que haya al menos un producto
    if (!orderDetails || orderDetails.length === 0) {
      showNotification('Debe haber al menos un producto en el pedido', 'warning');
      return;
    }

    // Validar cada producto
    for (let i = 0; i < orderDetails.length; i++) {
      const detail = orderDetails[i];
      if (!detail.product_id || detail.product_id === '') {
        showNotification(`Producto ${i + 1}: Debe seleccionar un producto`, 'warning');
        return;
      }
      if (!detail.quantity || parseInt(detail.quantity) <= 0) {
        showNotification(`Producto ${i + 1}: La cantidad debe ser mayor a 0`, 'warning');
        return;
      }
      if (!detail.unit_price || parseFloat(detail.unit_price) <= 0) {
        showNotification(`Producto ${i + 1}: El precio debe ser mayor a 0`, 'warning');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      console.log('🏢 [BRANCH] Actualizando pedido completo:', {
        orderId,
        deliveryDate,
        comments: orderNotes,
        productsCount: orderDetails.length
      });

      // Preparar datos de actualización
      const updateData = {
        delivery_date: deliveryDate,
        comments: orderNotes,
        customer_po_number: customerPoNumber.trim(),
        products: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id),
          quantity: parseInt(detail.quantity),
          unit_price: parseFloat(detail.unit_price)
        }))
      };

      console.log('📦 [BRANCH] Datos a enviar:', updateData);

      const response = await API.put(`/branch-orders/${orderId}`, updateData);

      if (response.data && response.data.success) {
        showNotification('Pedido actualizado exitosamente', 'success');

        if (onOrderUpdated) onOrderUpdated(response.data.data);

        navigate(`${getRoutePrefix()}/orders/${orderId}`, { 
          state: { updated: true } 
        });
      } else {
        throw new Error(response.data?.message || 'Error al actualizar el pedido');
      }

    } catch (error) {
      console.error('❌ [BRANCH] Error actualizando pedido:', error);
      showNotification(
        error.response?.data?.message || 'Error al actualizar el pedido. Contacte al administrador.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
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

  // Función para agregar un nuevo producto a la orden
  const handleAddProduct = () => {
    const newProduct = {
      product_id: '',
      quantity: 1,
      unit_price: 0,
      name: '',
      sap_code: ''
    };
    
    setOrderDetails([...orderDetails, newProduct]);
    showNotification('Producto agregado. Selecciona un producto de la lista.', 'info');
  };

  const handleProductChange = (index, field, value) => {
    const newDetails = [...orderDetails];

    if (field === 'product_id') {
      const selectedProduct = products.find(p => p.product_id === parseInt(value));
      if (selectedProduct) {
        // ✅ USAR EL PRECIO CORRECTO DE LA NUEVA ESTRUCTURA
        const productPrice = parseFloat(
          selectedProduct.price || 
          selectedProduct.price_list1 || 
          selectedProduct.effective_price || 
          0
        );
        
        newDetails[index] = {
          ...newDetails[index],
          product_id: value,
          unit_price: productPrice,
          name: selectedProduct.name
        };
      } else {
        newDetails[index] = {
          ...newDetails[index],
          product_id: value
        };
      }
    } else if (field !== 'unit_price') {
      // ✅ BLOQUEAR cambios en unit_price
      newDetails[index] = {
        ...newDetails[index],
        [field]: value
      };
    }

    setOrderDetails(newDetails);
  };

  const calculateTotal = () => {
    const total = orderDetails.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const itemTotal = quantity * unitPrice;
      return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
    
    return total.toFixed(2);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };

  // ✅ FUNCIONES HELPER PARA ZONA DE ENTREGA (igual que en CreateOrderForm)
  const DELIVERY_ZONES = {
    BOGOTA: {
      name: 'Bogotá',
      days: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
      municipalities: ['11001'],
      cities: ['bogota', 'bogotá d.c', 'bogota d.c']
    },
    SABANA_NORTE: {
      name: 'Sabana Norte',
      days: [2, 4], // Martes y Jueves
      municipalities: ['25053', '25099', '25214', '25322', '25295', '25799'],
      cities: ['cajicá', 'cajica', 'chía', 'chia', 'zipaquirá', 'zipaquira', 'cota', 'guasca', 'gachancipá', 'gachancipa', 'tenjo']
    },
    SABANA_OCCIDENTE: {
      name: 'Sabana Occidente',
      days: [3, 5], // Miércoles y Viernes
      municipalities: ['25754', '25473', '25430', '25286'],
      cities: ['soacha', 'mosquera', 'madrid', 'funza']
    }
  };

  const getCityNameByDANECode = (daneCode) => {
    const municipalityMap = {
      '25053': 'Cajicá',
      '25099': 'Zipaquirá',
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

  const calculateAvailableDeliveryDates = (zone, orderTimeLimit = '18:00') => {
    if (!zone) return [];

    const today = new Date();
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    today.setHours(0, 0, 0, 0);
    
    let additionalDays = 2;
    const currentDay = today.getDay();
    const currentHour = new Date().getHours();
    const [limitHour] = orderTimeLimit.split(':').map(Number);
    
    if (currentHour >= limitHour && currentDay >= 1 && currentDay <= 5) {
      additionalDays = 3;
    }

    if (currentDay === 6) {
      additionalDays = 3;
    } else if (currentDay === 0) {
      additionalDays = 3;
    }

    const availableDates = [];
    const maxDaysToCheck = 45;

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

  const handleUpdateOrder = async (e) => {
    e.preventDefault();

    if (!canEdit) {
      showNotification(editNotAllowedReason, 'error');
      return;
    }

    if (isSubmitting) return;
    
    setIsSubmitting(true);

    try {
      console.log(`🔄 [${authType.toUpperCase()}] Iniciando actualización de orden:`, orderId);

      // ✅ VALIDACIONES MEJORADAS
      if (!deliveryDate) {
        throw new Error('La fecha de entrega es requerida');
      }

      if (orderDetails.length === 0) {
        throw new Error('Debe agregar al menos un producto al pedido');
      }

      // ✅ VALIDAR QUE TODOS LOS PRODUCTOS TENGAN DATOS VÁLIDOS
      const invalidProducts = orderDetails.filter(detail => {
        const productId = detail.product_id;
        const quantity = parseFloat(detail.quantity) || 0;
        const unitPrice = parseFloat(detail.unit_price) || 0;
        
        // Verificar que el producto existe en la lista
        const productExists = products.find(p => p.product_id.toString() === productId.toString());
        
        return !productId || 
              !productExists ||
              quantity <= 0 || 
              unitPrice <= 0;
      });

      if (invalidProducts.length > 0) {
        console.error('❌ Productos con datos inválidos:', invalidProducts);
        console.error('❌ Productos disponibles:', products.map(p => ({ id: p.product_id, name: p.name, price: p.price_list1 })));
        
        const detailedErrors = invalidProducts.map(product => {
          const issues = [];
          if (!product.product_id) issues.push('Sin ID de producto');
          if (!products.find(p => p.product_id.toString() === product.product_id.toString())) issues.push('Producto no encontrado en catálogo');
          if (parseFloat(product.quantity) <= 0) issues.push('Cantidad inválida');
          if (parseFloat(product.unit_price) <= 0) issues.push('Precio inválido');
          return `Producto ${product.product_id || 'sin ID'}: ${issues.join(', ')}`;
        });
        
        throw new Error(`Hay productos con problemas:\n${detailedErrors.join('\n')}`);
      }

      // ✅ CALCULAR TOTALES
      const totalAmount = orderDetails.reduce((sum, detail) => {
        const quantity = parseFloat(detail.quantity) || 0;
        const unitPrice = parseFloat(detail.unit_price) || 0;
        return sum + (quantity * unitPrice);
      }, 0);

      if (totalAmount <= 0) {
        throw new Error('El total del pedido debe ser mayor a $0');
      }

      // ✅ PREPARAR DATOS PARA LA API
      const orderData = {
        user_id: user.id,
        total_amount: totalAmount,
        delivery_date: deliveryDate,
        notes: orderNotes || '',
        customer_po_number: customerPoNumber.trim(),
        details: orderDetails.map(detail => ({
          product_id: parseInt(detail.product_id),
          quantity: parseInt(detail.quantity),
          unit_price: parseFloat(detail.unit_price)
        }))
      };

      console.log('📦 Datos de actualización preparados:', orderData);

      // ✅ MANEJAR ARCHIVO SI EXISTE
      let finalData = orderData;
      let isMultipart = false;

      if (orderFile) {
        const formData = new FormData();
        formData.append('orderFile', orderFile);
        formData.append('orderData', JSON.stringify(orderData));
        // Asegurar que customer_po_number se incluya explícitamente
        formData.append('customer_po_number', customerPoNumber.trim());
        finalData = formData;
        isMultipart = true;
        console.log('📎 Incluyendo archivo en la actualización');
      }

      // ✅ ENVIAR ACTUALIZACIÓN
      const result = await orderService.updateOrder(orderId, finalData, isMultipart);

      if (result.success) {
        showNotification('Pedido actualizado exitosamente', 'success');

        // Notificar al componente padre
        if (onOrderUpdated) onOrderUpdated(result.data);

        // Redireccionar según tipo de usuario
        const routePrefix = authType === AUTH_TYPES.BRANCH ? '/dashboard-branch' : '/dashboard';
        setTimeout(() => {
          navigate(`${routePrefix}/orders/${orderId}`);
        }, 2000);
      } else {
        throw new Error(result.message || 'Error al actualizar el pedido');
      }
    } catch (error) {
      console.error(`❌ [${authType.toUpperCase()}] Error updating order:`, error);
      showNotification(error.message || 'Ocurrió un error al actualizar tu pedido', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si están cargando los datos, mostrar indicador
  if (loading) {
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Si no se puede editar, mostrar mensaje
  if (!canEdit) {
    return (
      <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert">
          <p className="font-medium">Edición no permitida</p>
          <p>{editNotAllowedReason}</p>
          <button
            onClick={() => navigate(`/dashboard/orders/${orderId}`)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            Volver a detalles
          </button>
        </div>
      </div>
    );
  }

  // Si están cargando productos, mostrar indicador
  if (loadingProducts) {
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
      {authType === AUTH_TYPES.BRANCH ? (
      <div className="space-y-6">
        {/* Header para Branch */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Editar Pedido #{orderId}
          </h2>
          <button
            type="button"
            onClick={() => navigate(`${getRoutePrefix()}/orders/${orderId}`)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Volver a detalles
          </button>
        </div>

        {notification.show && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification({ show: false, message: '', type: '' })}
          />
        )}

        {/* Mensaje informativo para Branch */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Edición de pedido desde sucursal
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Puedes modificar productos, cantidades, fecha de entrega y comentarios de este pedido.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario completo con productos */}
        <form onSubmit={handleSubmitBranchUpdate} className="space-y-6">
          
          {/* Sección de Productos */}
          <div className="border-b pb-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Productos del Pedido</h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orderDetails.map((detail, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        {detail.product_id && products.find(p => p.product_id.toString() === detail.product_id.toString()) ? (
                          // Producto existente - solo mostrar
                          <>
                            <div className="text-sm font-medium text-gray-900">
                              {detail.name || 'Producto sin nombre'}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {detail.product_id}
                            </div>
                          </>
                        ) : (
                          // Producto nuevo o no encontrado - permitir selección
                          <select
                            value={detail.product_id}
                            onChange={(e) => handleProductChange(index, 'product_id', e.target.value)}
                            className="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                            required
                          >
                            <option value="">Seleccionar producto</option>
                            {products.map(product => (
                              <option
                                key={product.product_id}
                                value={product.product_id}
                                disabled={orderDetails.some(
                                  item => item !== detail && item.product_id === product.product_id.toString()
                                )}
                              >
                                {product.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          value={detail.quantity}
                          onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                          className="w-20 text-center border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        ${parseFloat(detail.unit_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        ${(parseFloat(detail.quantity) * parseFloat(detail.unit_price)).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(index)}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={orderDetails.length === 1}
                          title={orderDetails.length === 1 ? "No puedes eliminar el único producto" : "Eliminar producto"}
                        >
                          <FaTimes className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right font-bold text-gray-900">
                      Total del pedido:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg">
                      ${calculateTotal()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 text-sm text-gray-600">
              <p className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Puedes modificar las cantidades y precios de los productos existentes
              </p>
            </div>
          </div>

          {/* Botón para agregar más productos en Branch */}
          {!isSubmitting && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAddProduct}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Producto
              </button>
            </div>
          )}

          {/* Fecha de Entrega */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Fecha de Entrega</h4>
            
            <DeliveryDatePicker
              value={deliveryDate}
              onChange={setDeliveryDate}
              orderTimeLimit={siteSettings.orderTimeLimit}
              availableDates={availableDeliveryDays}
              deliveryZone={deliveryZone}
            />
            
            <p className="text-xs text-gray-500 mt-2">
              Solo puedes seleccionar fechas disponibles según la zona de entrega de tu sucursal
            </p>
          </div>

          {/* Comentarios */}
          <div>
            <label htmlFor="branchNotes" className="block text-sm font-medium text-gray-700 mb-1">
              Comentarios adicionales
            </label>
            <textarea
              id="branchNotes"
              rows="3"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Agrega notas o comentarios sobre este pedido..."
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>

          {/* Agregar el campo de formulario antes de la sección de comentarios */}
          <div className="space-y-4 mt-6">
            <div>
              <label htmlFor="customerPoNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Número de Orden de Compra
              </label>
              <input
                type="text"
                id="customerPoNumber"
                value={customerPoNumber}
                onChange={(e) => setCustomerPoNumber(e.target.value)}
                placeholder="Ingrese el número de orden de compra (opcional)"
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                maxLength={50}
              />
              <p className="mt-1 text-xs text-gray-500">
                Puede contener letras y números. Máximo 50 caracteres.
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Actualizando...' : 'Actualizar Pedido'}
            </button>

            <button
              type="button"
              onClick={() => navigate(`${getRoutePrefix()}/orders/${orderId}`)}
              className="py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
          </div>

          {/* Botón de cancelar pedido */}
          <div className="border-t pt-4">
            <div className="text-center">
              <button
                type="button"
                onClick={handleCancelOrderBranch}
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <FaTimes className="mr-2" />
                Cancelar Pedido Completamente
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Esta acción no se puede deshacer
              </p>
            </div>
          </div>
        </form>
      </div>
    ) : (
        <form onSubmit={handleUpdateOrder} className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Editar Pedido #{orderId}</h2>
            <button
              type="button"
              onClick={() => navigate(`${getRoutePrefix()}/orders/${orderId}`)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>

          {notification.show && (
            <Notification
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification({ show: false, message: '', type: '' })}
            />
          )}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <FaExclamationTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Recuerda: </span>
                  Solo puedes editar este pedido hasta las {siteSettings.orderTimeLimit} del mismo día de su creación.
                  {order && (
                    <span>
                      {' '}El pedido fue creado el {new Date(order.order_date).toLocaleDateString('es-ES')}.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          {/* Sección de Fecha de Entrega */}
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Fecha de Entrega</h3>
            <p className="text-sm text-gray-600 mb-3">
              Selecciona la fecha en que necesitas recibir tu pedido.
              <br />
              <span className="font-medium text-amber-700">
                Importante: Solo podrás editar este pedido hasta las {siteSettings.orderTimeLimit} del {
                  (() => {
                    const orderDate = order ? new Date(order.order_date) : new Date();
                    const nextDay = new Date(orderDate);
                    nextDay.setDate(orderDate.getDate() + 1);
                    return nextDay.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                  })()
                }.
              </span>
            </p>

            <DeliveryDatePicker
              value={deliveryDate}
              onChange={setDeliveryDate}
              orderTimeLimit={siteSettings.orderTimeLimit}
              availableDates={availableDeliveryDays}
              deliveryZone={deliveryZone}
            />
          </div>

          {/* Productos */}
          <div className="overflow-x-auto">
            {/* En la sección de productos del formulario */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
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
                            disabled={orderDetails.some(
                              item => item !== detail && item.product_id === product.product_id.toString()
                            )}
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
                        onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 1)}
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

          {/* Botón para agregar más productos */}
          {!isSubmitting && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAddProduct}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Producto
              </button>
            </div>
          )}

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

          {/* Notas y Adjuntos */}
          <div className="space-y-4 mt-6 border-t pt-6">
            <div>
              <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Comentarios de actualización
              </label>
              <textarea
                id="orderNotes"
                rows="3"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Describe los cambios realizados en este pedido..."
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              ></textarea>
              <p className="text-xs text-gray-500 mt-1">
                Este comentario se agregará al historial de actualizaciones del pedido
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archivo adjunto (opcional)
              </label>
              <OrderFileUpload
                value={orderFile}
                onChange={setOrderFile}
              />
              {order && order.file_url && !orderFile && (
                <div className="mt-2 text-sm text-gray-500">
                  Ya hay un archivo adjunto. Subir uno nuevo reemplazará el anterior.
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex justify-center items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Actualizando...
              </span>
            ) : 'Actualizar Pedido'}
          </button>
        </form>
      )}
    </div>
  );
};

export default EditOrderForm;