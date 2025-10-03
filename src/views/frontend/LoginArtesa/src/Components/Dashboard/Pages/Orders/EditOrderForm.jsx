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

          // ✅ PARA BRANCH: Solo permitir cancelación si el estado lo permite
          if (authType === AUTH_TYPES.BRANCH) {
            const cancelableStatuses = [1, 2, 3]; // Abierto, En Proceso, En Producción
            if (!cancelableStatuses.includes(orderData.status_id)) {
              setCanEdit(false);
              setEditNotAllowedReason(`No se puede cancelar un pedido en estado: ${orderData.status_name || orderData.status}`);
              return;
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

            // Validar hora límite (solo para usuarios principales)
            const orderDate = new Date(orderData.order_date);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

            if (orderDay.getTime() < today.getTime()) {
              const [limitHours, limitMinutes] = siteSettings.orderTimeLimit.split(':').map(Number);
              const limitTime = new Date();
              limitTime.setHours(limitHours, limitMinutes, 0, 0);

              if (now > limitTime) {
                setCanEdit(false);
                setEditNotAllowedReason(`No se puede editar después de las ${siteSettings.orderTimeLimit}`);
                return;
              }
            }
          }

          // ✅ CONFIGURAR DATOS SOLO PARA USUARIOS PRINCIPALES
          if (authType !== AUTH_TYPES.BRANCH) {
            setDeliveryDate(orderData.delivery_date?.split('T')[0] || '');
            setOrderNotes(orderData.notes || '');

            if (authType !== AUTH_TYPES.BRANCH) {
              setDeliveryDate(orderData.delivery_date?.split('T')[0] || '');
              setOrderNotes(orderData.notes || '');

              if (orderData.details && orderData.details.length > 0) {
                setOrderDetails(orderData.details.map(detail => ({
                  product_id: detail.product_id.toString(),
                  quantity: detail.quantity,
                  unit_price: detail.unit_price
                })));
              }
            } else {
              // ✅ PARA BRANCH: Los datos se mapean en el useEffect separado
              console.log('🏢 [BRANCH] Datos del pedido cargados, productos se mapearán automáticamente');
            }
          }

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
    // ✅ SOLO EJECUTAR PARA USUARIOS PRINCIPALES
    if (authType !== AUTH_TYPES.BRANCH) {
      const fetchProducts = async () => {
        console.log('🚀 Iniciando fetchProducts - CARGANDO TODOS LOS PRODUCTOS:', {
          authType,
          timestamp: new Date().toISOString()
        });
        setLoadingProducts(true);

        try {
          // DETERMINAR CÓDIGO DE LISTA DE PRECIOS (igual que CreateOrderForm)
          let priceListCode = '1';

          // ✅ CORREGIR: Para usuarios principales, obtener su price_list_code
          if (authType === AUTH_TYPES.USER && user?.id) {
            try {
              console.log('👤 Obteniendo price_list_code para usuario PRINCIPAL...');
              const userResponse = await API.get('/auth/profile');
              if (userResponse.data.success && userResponse.data.data.price_list_code) {
                priceListCode = userResponse.data.data.price_list_code;
              }
            } catch (error) {
              console.warn('⚠️ Error obteniendo price_list_code de usuario, usando fallback:', error.message);
            }
          }

          console.log(`🎯 Usando lista de precios: ${priceListCode}`);

          // CARGAR TODOS LOS PRODUCTOS CON PAGINACIÓN COMPLETA (igual que CreateOrderForm)
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

          // MAPEO DE TODOS LOS PRODUCTOS (igual que CreateOrderForm)
          const mappedProducts = allProducts.map((plProduct, index) => {
            const priceValue = parseFloat(plProduct.price) || 0;

            return {
              product_id: plProduct.product_id || (index + 1),
              name: plProduct.local_product_name || plProduct.product_name,
              description: plProduct.local_product_description || plProduct.product_name,
              sap_code: plProduct.product_code,
              code: plProduct.product_code,

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

          setProducts(validProducts);

          if (validProducts.length === 0) {
            showNotification('No se encontraron productos con precios válidos para tu lista de precios', 'warning');
          } else {
            console.log(`✅ Productos listos para edición: ${validProducts.length} productos cargados`);
          }

          console.log(`✅ PRODUCTOS FINALES CARGADOS: ${validProducts.length} productos válidos con precios > 0`);

        } catch (error) {
          console.error('❌ Error cargando productos para edición:', error);
          showNotification('Error al cargar productos: ' + error.message, 'error');
          setProducts([]);
        } finally {
          setLoadingProducts(false);
        }
      };

      fetchProducts();
    } else {
      console.log('🏢 [BRANCH] Omitiendo carga de productos - no necesarios para cancelación');
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

  const handleAddProduct = () => {
    setOrderDetails([...orderDetails, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

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

  // Función para actualizar fecha de entrega y notas desde sucursal
  const handleSubmitBranchUpdate = async (e) => {
    e.preventDefault();

    if (!deliveryDate) {
      showNotification('Por favor selecciona una fecha de entrega', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);

      console.log('🏢 [BRANCH] Actualizando pedido:', {
        orderId,
        deliveryDate,
        notes: orderNotes
      });

      const updateData = {
        delivery_date: deliveryDate,
        notes: orderNotes
      };

      const response = await API.put(`/branch-orders/${orderId}`, updateData);

      if (response.data && response.data.success) {
        showNotification('Pedido actualizado exitosamente', 'success');

        if (onOrderUpdated) onOrderUpdated(response.data.data);

        setTimeout(() => {
          navigate(`${getRoutePrefix()}/orders/${orderId}`);
        }, 2000);
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
          unit_price: productPrice, // ← CAMBIAR ESTA LÍNEA
          name: selectedProduct.name
        };
      } else {
        newDetails[index] = {
          ...newDetails[index],
          product_id: value
        };
      }
    } else {
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
              Gestión de Pedido #{orderId}
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
                  Cuenta de Sucursal - Opciones Disponibles
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p className="font-semibold">Como sucursal, puedes:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Cambiar el estado del pedido a <strong>Cancelado</strong> si está en estado Abierto, En Proceso o En Producción</li>
                    <li>Modificar la fecha de entrega del pedido</li>
                    <li>Agregar comentarios y notas adicionales</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    <strong>Nota:</strong> No puedes modificar los productos incluidos en el pedido. Para cambios en productos, contacta con el administrador.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario para modificar fecha de entrega */}
          <form onSubmit={handleSubmitBranchUpdate} className="space-y-4">
            <div>
              <label htmlFor="deliveryDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Entrega
              </label>
              <input
                type="date"
                id="deliveryDate"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Puedes modificar la fecha de entrega del pedido
              </p>
            </div>

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

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Actualizando...' : 'Guardar Cambios'}
              </button>

              <button
                type="button"
                onClick={() => navigate(`${getRoutePrefix()}/orders/${orderId}`)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>

          {/* Información del pedido */}
          {order && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Información del Pedido</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Estado actual:</span>
                  <span className="ml-2 text-gray-900">{order.status_name || order.status}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Fecha de creación:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(order.order_date).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Subtotal:</span>
                  <span className="ml-2 text-gray-900">
                    ${parseFloat(order.subtotal || order.total_amount).toLocaleString('es-CO')}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">IVA:</span>
                  <span className="ml-2 text-gray-900">
                    ${parseFloat(order.tax_amount || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Total:</span>
                  <span className="ml-2 text-gray-900 font-semibold">
                    ${parseFloat(order.total_amount).toLocaleString('es-CO')}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Fecha de entrega:</span>
                  <span className="ml-2 text-gray-900">
                    {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('es-ES') : 'No especificada'}
                  </span>
                </div>
              </div>

              {/* ✅ NUEVA SECCIÓN: Productos del pedido para Branch */}
              {orderDetails && orderDetails.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-2">Productos en el Pedido</h4>
                  <div className="bg-white rounded-lg border">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {orderDetails.map((product, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">
                                <div className="font-medium">{product.name}</div>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500 text-center">
                                {product.quantity}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500 text-right">
                                ${parseFloat(product.unit_price).toLocaleString('es-CO')}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                ${(product.quantity * product.unit_price).toLocaleString('es-CO')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botón de cancelación o mensaje de no edición */}
          {loading ? (
            <div className="flex justify-center items-center h-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : !canEdit ? (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md">
              <p className="font-medium">Cancelación no permitida</p>
              <p>{editNotAllowedReason}</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <FaTimes className="mx-auto h-12 w-12 text-red-400 mb-4" />
                <h3 className="text-lg font-medium text-red-900 mb-2">
                  ¿Desea cancelar este pedido?
                </h3>
                <p className="text-sm text-red-700 mb-6">
                  Esta acción cambiará el estado del pedido a <strong>Cancelado</strong> y no se puede deshacer.
                </p>
                <div className="flex justify-center space-x-4">
                  <button
                    type="button"
                    onClick={() => navigate(`${getRoutePrefix()}/orders/${orderId}`)}
                    className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    No, volver
                  </button>
                  <button
                    onClick={handleCancelOrderBranch}
                    disabled={isSubmitting}
                    className={`px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                      isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting ? 'Cancelando...' : 'Sí, cancelar pedido'}
                  </button>
                </div>
              </div>
            </div>
          )}
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