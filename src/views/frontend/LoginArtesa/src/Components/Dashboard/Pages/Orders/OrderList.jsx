import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { orderService } from '../../../../services/orderService';
import { useAuth } from '../../../../hooks/useAuth';
import OrderStatusBadge from './OrderStatusBadge';
import { FaEdit, FaEye, FaExclamationTriangle, FaTrashAlt, FaFilter } from 'react-icons/fa';
import API from '../../../../api/config';

const OrderList = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Para manejar la edición y paginación
  const [editableOrders, setEditableOrders] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  // Configuración global y estados
  const [orderTimeLimit, setOrderTimeLimit] = useState(null);
  const [orderStatuses, setOrderStatuses] = useState({}); // Mapeo ID → Nombre

  // Filtros del panel: Queremos fecha exacta y estado
  const [filters, setFilters] = useState({ deliveryDate: '', statusId: '' });
  const [tempFilters, setTempFilters] = useState({ deliveryDate: '', statusId: '' });

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const isAdmin = user?.role === 1; // Ajustar si tu backend define '1' como Admin

  const ProductDetailsList = ({ details }) => {
    if (!details || details.length === 0) {
      return <span className="text-gray-500">No hay productos</span>;
    }

    return (
      <div className="space-y-2">
        {details.map((detail, index) => (
          <div key={index} className="text-sm">
            {/* Solo nombre del producto */}
            <span className="text-gray-800 font-medium">{detail.product_name}</span>
          </div>
        ))}
      </div>
    );
  };

  const ProductQuantitiesList = ({ details }) => {
    if (!details || details.length === 0) {
      return <span className="text-gray-500">No hay cantidades</span>;
    }

    return (
      <div className="space-y-1">
        {details.map((detail, index) => (
          <div key={index} className="text-sm text-blue-600">
            {detail.quantity} {detail.quantity === 1 ? 'unidad' : 'unidades'}
          </div>
        ))}
      </div>
    );
  };


  // 1. Cargar configuración (orderTimeLimit) y la lista de estados
  useEffect(() => {
    const fetchSettingsAndStatuses = async () => {
      try {
        // Obtener los estados de pedidos
        const statusResp = await API.get('/orders/statuses');
        if (statusResp.data.success) {
          const statusMap = {};
          statusResp.data.data.forEach(s => {
            statusMap[s.status_id] = s.name;
          });
          setOrderStatuses(statusMap);
        }

        // Configuración sitio (para orderTimeLimit)
        const configResp = await API.get('/admin/settings');
        if (configResp.data?.success) {
          setOrderTimeLimit(configResp.data.data.orderTimeLimit || '18:00');
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettingsAndStatuses();
  }, []);

  // 2. Función principal para cargar las órdenes según rol y filtros
  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setError('Usuario no identificado');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let data = [];

      if (isAdmin) {
        // Órdenes del usuario admin
        const userOrders = await orderService.getUserOrders(user.id);

        // Órdenes del día actual
        const todayISO = new Date().toISOString().split('T')[0];
        const todayOrders = await orderService.getOrdersByDeliveryDate(todayISO);

        // 1) Unimos ambos arreglos
        const combined = [...userOrders, ...todayOrders];


        // 2) Eliminamos duplicados usando un Map
        const uniqueMap = new Map();
        for (const o of combined) {
          uniqueMap.set(o.order_id, o);
        }
        // 3) data final sin duplicados
        data = Array.from(uniqueMap.values());

      } else {
        // Usuario normal: solo sus órdenes
        data = await orderService.getUserOrders(user.id);
      }

      // Filtramos las órdenes por estados "activos" (no canceladas ni cerradas):
      const active = data.filter(o => {
        const invalidStates = [6]; // 6 => Cancelado
        if (invalidStates.includes(o.status_id)) return false;
        if (['cancelado', 'canceled', 'cerrado'].includes(o.status?.toLowerCase())) return false;
        return true;
      });

      setOrders(active);

      // Para cada orden, obtener los detalles de productos
      const ordersWithDetails = await Promise.all(
        active.map(async (order) => {
          try {
            // Solicitar detalles de productos para esta orden
            const detailsResponse = await API.get(`/orders/${order.order_id}`);
            if (detailsResponse.data.success) {
              return {
                ...order,
                orderDetails: detailsResponse.data.data.details || []
              };
            }
            return order;
          } catch (error) {
            console.error(`Error fetching details for order ${order.order_id}:`, error);
            return order;
          }
        })
      );
      setOrders(ordersWithDetails);


      // Comprobamos cuáles pedidos son editables
      const editMap = {};
      for (const order of active) {
        const check = await orderService.canEditOrder(order.order_id, orderTimeLimit);
        editMap[order.order_id] = check.canEdit;
      }
      setEditableOrders(editMap);

    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Error al cargar los pedidos');
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, filters, orderTimeLimit]);

  // 3. useEffect para cargar órdenes al montar o cambiar dependencias
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Cancelar pedido
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('¿Estás seguro que deseas cancelar este pedido?')) return;
    try {
      const response = await API.put(`/orders/${orderId}/cancel`);
      if (response.data.success) {
        fetchOrders();
      } else {
        alert('Error al cancelar el pedido: ' + response.data.message);
      }
    } catch (err) {
      console.error('Error cancelando orden:', err);
      alert('Error al cancelar el pedido');
    }
  };

  // Helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Fecha no disponible';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Fecha inválida';

    // Forzar formato en UTC, ignorando zona horaria local
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC' // Esta es la clave de la solución
    }).format(d);
  };

  // Paginación
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);
  const paginate = (page) => setCurrentPage(page);

  // 4. Manejo del panel de filtros (fecha + estado)
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setTempFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilterPanel(false);
  };

  // Renderizado condicional
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
        <p className="font-medium">Error al cargar los pedidos</p>
        <p>{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <p className="text-gray-500 text-center p-6">No tienes pedidos registrados.</p>
        <div className="flex justify-center">
          <Link
            to="/dashboard/orders/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Realizar un nuevo pedido
          </Link>
        </div>
      </div>
    );
  }

  const formatColombianCurrency = (amount) => {
    if (!amount) return "$0";

    // Convertir el número a string y usar expresiones regulares para formatear
    const formattedAmount = Math.round(parseFloat(amount))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".") // Separador de miles con punto
      .replace(/(\d+)\.(\d{3})\.(\d{3})$/, "$1'$2.$3"); // Separador de millones con comilla

    return `$${formattedAmount}`;
  };

  // 5. Render principal
  return (
    <div className="bg-white p-3 sm:p-6 rounded-lg border shadow-sm w-full max-w-[98%] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
        <h2 className="text-xl font-semibold text-gray-800">Mis Pedidos</h2>

        <div className="flex gap-2 items-center w-full sm:w-auto">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="px-3 py-1.5 bg-gray-100 text-sm rounded hover:bg-gray-200 flex-1 sm:flex-none flex items-center justify-center"
          >
            <FaFilter className="mr-1.5" />
            {showFilterPanel ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
          <Link
            to="/dashboard/orders/new"
            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
          >
            Nuevo Pedido
          </Link>
        </div>
      </div>

      {/* Filtros: fecha y estado */}
      {showFilterPanel && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-40 flex justify-end"
          onClick={() => setShowFilterPanel(false)}
        >
          <div
            className="w-full max-w-xs h-full bg-white shadow-xl p-4 pt-4 relative"
            style={{ marginTop: '110px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowFilterPanel(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-50"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold text-gray-800 mb-4">Filtrar pedidos</h2>

            <div className="space-y-4">
              {/* Fecha exacta */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha de entrega</label>
                <input
                  type="date"
                  name="deliveryDate"
                  value={tempFilters.deliveryDate}
                  onChange={handleFilterChange}
                  className="w-full border px-3 py-2 rounded-md mt-1"
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <select
                  name="statusId"
                  value={tempFilters.statusId}
                  onChange={handleFilterChange}
                  className="w-full border px-3 py-2 rounded-md mt-1"
                >
                  <option value="">-- Todos --</option>
                  {/* Mapeamos los estados disponibles */}
                  {Object.entries(orderStatuses).map(([id, name]) => (
                    <option key={id} value={id}>
                      {`${id} - ${name}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido condicional - Cargando/Error/Sin pedidos */}
      {isLoading && (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
          <p className="font-medium">Error al cargar los pedidos</p>
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div>
          <p className="text-gray-500 text-center p-6">No tienes pedidos registrados.</p>
          <div className="flex justify-center">
            <Link
              to="/dashboard/orders/new"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Realizar un nuevo pedido
            </Link>
          </div>
        </div>
      )}


      {/* Tabla de pedidos */}
      {!isLoading && !error && orders.length > 0 && (
        <>
          <div className="block md:hidden">
            {currentOrders.map((order) => (
              <div key={order.order_id} className="mb-4 bg-white rounded-lg shadow-sm p-3 border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-600 font-bold">#{order.order_id}</span>
                  <OrderStatusBadge status={orderStatuses[order.status_id] || order.status || 'pendiente'} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-500 block">Fecha:</span>
                    <span className="font-medium">{formatDate(order.order_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Entrega:</span>
                    <span className="font-medium">{formatDate(order.delivery_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Total:</span>
                    <span className="font-semibold">{formatColombianCurrency(order.total_amount)}</span>
                  </div>
                  {isAdmin && (
                    <div>
                      <span className="text-gray-500 block">Usuario:</span>
                      <span className="font-medium">{order.user_name || order.user_email}</span>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <span className="text-gray-500 block mb-1">Productos:</span>
                  {order.orderDetails ? (
                    <div className="space-y-1">
                      {order.orderDetails.map((detail, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-gray-800 font-medium truncate max-w-[70%]">{detail.product_name}</span>
                          <span className="text-blue-600">{detail.quantity} {detail.quantity === 1 ? 'unidad' : 'unidades'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>No hay productos</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  <Link
                    to={`/dashboard/orders/${order.order_id}`}
                    className="bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 text-indigo-600 rounded flex items-center text-xs flex-grow justify-center"
                  >
                    <FaEye className="mr-1" />
                    Ver
                  </Link>

                  {editableOrders[order.order_id] ? (
                    <Link
                      to={`/dashboard/orders/${order.order_id}/edit`}
                      className="bg-blue-50 hover:bg-blue-100 px-3 py-1.5 text-blue-600 rounded flex items-center text-xs flex-grow justify-center"
                    >
                      <FaEdit className="mr-1" />
                      Editar
                    </Link>
                  ) : (
                    <span className="text-gray-400 bg-gray-100 px-3 py-1.5 rounded flex items-center text-xs flex-grow justify-center">
                      <FaExclamationTriangle className="mr-1 text-yellow-500" />
                      No editable
                    </span>
                  )}

                  {!['cancelado', 'canceled'].includes(order.status?.toLowerCase()) &&
                    !['3', '4', '5', '7', '8'].includes(order.status_id?.toString()) && (
                      <button
                        onClick={() => handleCancelOrder(order.order_id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded flex items-center text-xs flex-grow justify-center"
                      >
                        <FaTrashAlt className="mr-1" />
                        Cancelar
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Tabla de pedidos - Versión desktop */}
          <div className="hidden md:block w-full overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[8%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">ID</th>
                  {isAdmin && (
                    <th className="w-[12%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Usuario</th>
                  )}
                  <th className="w-[10%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Fecha</th>
                  <th className="w-[10%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Entrega</th>
                  <th className="w-[22%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Productos</th>
                  <th className="w-[8%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Cantidad</th>
                  <th className="w-[10%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Total</th>
                  <th className="w-[10%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Estado</th>
                  <th className="w-[20%] px-3 py-3 text-xs font-medium text-gray-500 uppercase text-center">Acciones</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {currentOrders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50">
                    <td className="px-3 py-4 border-b text-sm text-blue-600 font-bold text-center">
                      <Link to={`/dashboard/orders/${order.order_id}`}>#{order.order_id}</Link>
                    </td>

                    {isAdmin && (
                      <td className="px-3 py-4 border-b text-sm text-gray-500 text-center">
                        {order.user_name || order.user_email}
                      </td>
                    )}

                    <td className="px-3 py-4 border-b text-sm text-gray-500 text-center">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="px-3 py-4 border-b text-sm text-gray-500 text-center">
                      {formatDate(order.delivery_date)}
                    </td>
                    <td className="px-3 py-4 border-b text-sm">
                      {order.orderDetails ? (
                        <div className="space-y-1">
                          {order.orderDetails.map((detail, index) => (
                            <div
                              key={index}
                              className="text-gray-800 font-medium text-xs overflow-hidden text-ellipsis block max-w-full"
                              title={detail.product_name}
                            >
                              {detail.product_name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>No hay productos</span>
                      )}
                    </td>
                    <td className="px-3 py-4 border-b text-sm">
                      {order.orderDetails ? (
                        <div className="space-y-1">
                          {order.orderDetails.map((detail, index) => (
                            <div key={index} className="text-blue-600 text-center">
                              {detail.quantity}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-center block">No hay cantidades</span>
                      )}
                    </td>
                    <td className="px-3 py-4 border-b text-sm text-gray-900 text-right font-semibold">
                      {formatColombianCurrency(order.total_amount)}
                    </td>
                    <td className="px-3 py-4 border-b text-sm text-center">
                      <OrderStatusBadge status={orderStatuses[order.status_id] || order.status || 'pendiente'} />
                    </td>
                    <td className="px-3 py-4 border-b text-sm font-medium text-center">
                      <div className="flex justify-center items-center space-x-1 lg:space-x-2">
                        <Link
                          to={`/dashboard/orders/${order.order_id}`}
                          className="bg-indigo-50 hover:bg-indigo-100 px-2 lg:px-3 py-1 text-indigo-600 rounded flex items-center text-xs"
                        >
                          <FaEye className="mr-1" />
                          <span className="hidden lg:inline">Ver</span>
                        </Link>

                        {editableOrders[order.order_id] ? (
                          <Link
                            to={`/dashboard/orders/${order.order_id}/edit`}
                            className="bg-blue-50 hover:bg-blue-100 px-2 lg:px-3 py-1 text-blue-600 rounded flex items-center text-xs"
                          >
                            <FaEdit className="mr-1" />
                            <span className="hidden lg:inline">Editar</span>
                          </Link>
                        ) : (
                          <span className="text-gray-400 bg-gray-100 px-2 lg:px-3 py-1 rounded flex items-center cursor-not-allowed text-xs">
                            <FaExclamationTriangle className="mr-1 text-yellow-500" />
                            <span className="hidden lg:inline">No editable</span>
                          </span>
                        )}

                        {!['cancelado', 'canceled'].includes(order.status?.toLowerCase()) &&
                          !['3', '4', '5', '7', '8'].includes(order.status_id?.toString()) && (
                            <button
                              onClick={() => handleCancelOrder(order.order_id)}
                              className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 lg:px-3 py-1 rounded flex items-center text-xs"
                            >
                              <FaTrashAlt className="mr-1" />
                              <span className="hidden lg:inline">Cancelar</span>
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
  {/* Paginación */ }
  {orders.length > ordersPerPage && (
        <div className="flex justify-center mt-4 overflow-x-auto py-2">
          <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => paginate(currentPage > 1 ? currentPage - 1 : 1)}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 disabled:opacity-50"
            >
              <span className="sr-only">Anterior</span>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
              </svg>
            </button>

            {[...Array(Math.ceil(orders.length / ordersPerPage)).keys()].map(num => (
              <button
                key={num + 1}
                onClick={() => paginate(num + 1)}
                className={`w-8 h-8 flex items-center justify-center border border-gray-300 bg-white text-sm font-medium ${
                  currentPage === num + 1
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {num + 1}
              </button>
            ))}

            <button
              onClick={() => paginate(currentPage < Math.ceil(orders.length / ordersPerPage) ? currentPage + 1 : currentPage)}
              disabled={currentPage === Math.ceil(orders.length / ordersPerPage)}
              className="w-8 h-8 flex items-center justify-center rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 disabled:opacity-50"
            >
              <span className="sr-only">Siguiente</span>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10l-3.293-3.293a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
              </svg>
            </button>
          </nav>
        </div>
      )}
{/* Mensaje informativo - version adaptativa */}
<div className="mt-6 bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
        <div className="flex items-start">
          <div className="flex-shrink-0 hidden sm:block">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="sm:ml-3 text-sm text-blue-700">
            <h3 className="font-medium text-blue-800">Información sobre edición de pedidos</h3>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm">
              Solo puedes editar pedidos en estado "Abierto" y antes de las {orderTimeLimit}, dos días antes de la fecha
              de entrega.
            </p>
            <p className="mt-1 text-xs sm:text-sm">Si necesitas modificar un pedido fuera de este tiempo, contacta a atención al cliente.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderList;