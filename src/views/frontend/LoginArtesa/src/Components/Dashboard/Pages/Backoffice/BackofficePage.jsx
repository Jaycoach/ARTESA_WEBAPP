import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import backofficeService from '../../../../services/backofficeService';
import {
  FaSearch, FaCheck, FaTimes, FaKey, FaShoppingCart, FaSync,
  FaUsers, FaBuilding, FaTrash, FaClipboardList, FaFilter
} from 'react-icons/fa';
import './BackofficePage.scss';

const BackofficePage = () => {
  const { user } = useAuth();
  const userRole = user ? parseInt(user.role) : null;
  const hasBackofficePermission = backofficeService.hasBackofficePermission(user);

  const [activeTab, setActiveTab] = useState('clients');

  if (!hasBackofficePermission) {
    return (
      <div className="backoffice-page">
        <div className="access-denied">
          <p className="font-bold">Acceso denegado</p>
          <p>No tiene permisos para acceder a esta página. Rol requerido: ADMIN o BACKOFFICE. Su rol: {userRole || 'No definido'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backoffice-page">
      <h1 className="backoffice-title">BackOffice</h1>

      <div className="backoffice-tabs">
        <button
          className={activeTab === 'clients' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('clients')}
        >
          <FaUsers /> Clientes y sucursales
        </button>
        <button
          className={activeTab === 'order' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('order')}
        >
          <FaShoppingCart /> Crear pedido a nombre de un cliente
        </button>
        <button
          className={activeTab === 'daily' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('daily')}
        >
          <FaClipboardList /> Pedidos del día
        </button>
      </div>

      {activeTab === 'clients' && <ClientsTab />}
      {activeTab === 'order' && <CreateOrderTab />}
      {activeTab === 'daily' && <DailyOrdersTab />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Tab: Clientes y sucursales                                          */
/* ------------------------------------------------------------------ */

const ClientsTab = () => {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const loadClients = useCallback(async (searchTerm) => {
    setLoading(true);
    setError(null);
    try {
      const response = await backofficeService.getClients(searchTerm);
      setClients(response.data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients('');
  }, [loadClients]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadClients(search);
  };

  const toggleBranches = async (clientId) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      setBranches([]);
      return;
    }

    setExpandedClientId(clientId);
    setBranchesLoading(true);
    setBranches([]);
    try {
      const response = await backofficeService.getClientBranches(clientId);
      setBranches(response.data || []);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Error al cargar sucursales' });
    } finally {
      setBranchesLoading(false);
    }
  };

  const handleToggleActive = async (client) => {
    const confirmMsg = client.is_active
      ? `¿Inactivar al cliente "${client.razonSocial}"?`
      : `¿Activar al cliente "${client.razonSocial}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (client.is_active) {
        await backofficeService.deactivateClient(client.user_id);
      } else {
        await backofficeService.activateClient(client.user_id);
      }
      setActionMessage({ type: 'success', text: `Cliente "${client.razonSocial}" actualizado exitosamente` });
      loadClients(search);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Error al actualizar el cliente' });
    }
  };

  const handleResetPassword = async (branch) => {
    if (!window.confirm(`¿Resetear la contraseña de la sucursal "${branch.branch_name}"? Se generará una nueva contraseña y se enviará por correo.`)) {
      return;
    }
    try {
      const response = await backofficeService.resetBranchPassword(branch.branch_id);
      setActionMessage({ type: 'success', text: response.message || 'Contraseña restablecida exitosamente' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Error al resetear la contraseña' });
    }
  };

  return (
    <div className="backoffice-tab-content">
      <form className="search-bar" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Buscar por razón social, NIT o CardCode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit"><FaSearch /> Buscar</button>
      </form>

      {actionMessage && (
        <div className={`action-message ${actionMessage.type}`}>
          {actionMessage.text}
          <button className="close-btn" onClick={() => setActionMessage(null)}><FaTimes /></button>
        </div>
      )}

      {error && <div className="action-message error">{error}</div>}
      {loading && <p>Cargando clientes...</p>}

      {!loading && (
        <table className="backoffice-table">
          <thead>
            <tr>
              <th>Razón social</th>
              <th>NIT</th>
              <th>CardCode</th>
              <th>Ciudad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <React.Fragment key={client.client_id}>
                <tr>
                  <td>
                    <button className="link-btn" onClick={() => toggleBranches(client.client_id)}>
                      <FaBuilding /> {client.razonSocial}
                    </button>
                  </td>
                  <td>{client.nit}</td>
                  <td>{client.cardcode_sap}</td>
                  <td>{client.ciudad}</td>
                  <td>
                    <span className={client.is_active ? 'status active' : 'status inactive'}>
                      {client.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={client.is_active ? 'btn-danger' : 'btn-success'}
                      onClick={() => handleToggleActive(client)}
                    >
                      {client.is_active ? <><FaTimes /> Inactivar</> : <><FaCheck /> Activar</>}
                    </button>
                  </td>
                </tr>
                {expandedClientId === client.client_id && (
                  <tr className="branches-row">
                    <td colSpan={6}>
                      {branchesLoading && <p>Cargando sucursales...</p>}
                      {!branchesLoading && branches.length === 0 && <p>Este cliente no tiene sucursales registradas.</p>}
                      {!branchesLoading && branches.length > 0 && (
                        <table className="backoffice-subtable">
                          <thead>
                            <tr>
                              <th>Sucursal</th>
                              <th>Ciudad</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {branches.map(branch => (
                              <tr key={branch.branch_id}>
                                <td>{branch.branch_name}</td>
                                <td>{branch.city}</td>
                                <td>
                                  <button className="btn-secondary" onClick={() => handleResetPassword(branch)}>
                                    <FaKey /> Resetear contraseña
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={6}>No se encontraron clientes.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Tab: Crear pedido a nombre de un cliente                             */
/* ------------------------------------------------------------------ */

const CreateOrderTab = () => {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // { product_id: { product, quantity, priceInfo } }
  const [comments, setComments] = useState('');
  const [customerPoNumber, setCustomerPoNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastOrderSummary, setLastOrderSummary] = useState(null);
  const [clientOrders, setClientOrders] = useState([]);
  const [clientOrdersLoading, setClientOrdersLoading] = useState(false);

  // El toast es fijo en la pantalla (no depende del scroll, a diferencia del banner
  // inline "message") — se necesita porque tras crear la orden el carrito se vacía y
  // el contenido de la página se encoge, así que un aviso solo-inline puede quedar
  // fuera de la vista si el usuario estaba con scroll hacia abajo en el botón de envío.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    backofficeService.getClients('').then(res => setClients(res.data || [])).catch(err => {
      setMessage({ type: 'error', text: err.message || 'Error al cargar clientes' });
    });
  }, []);

  const loadClientOrders = useCallback((clientId) => {
    if (!clientId) {
      setClientOrders([]);
      return;
    }
    setClientOrdersLoading(true);
    backofficeService.getOrders({ client_id: clientId, order_origin: 'backoffice' })
      .then(res => setClientOrders(res.data || []))
      .catch(err => setMessage({ type: 'error', text: err.message || 'Error al cargar las órdenes del cliente' }))
      .finally(() => setClientOrdersLoading(false));
  }, []);

  useEffect(() => {
    setSelectedBranchId('');
    setBranches([]);
    setCart({});
    setLastOrderSummary(null);
    loadClientOrders(selectedClientId);
    if (!selectedClientId) return;

    backofficeService.getClientBranches(selectedClientId)
      .then(res => setBranches(res.data || []))
      .catch(err => setMessage({ type: 'error', text: err.message || 'Error al cargar sucursales' }));
  }, [selectedClientId, loadClientOrders]);

  useEffect(() => {
    if (!selectedClientId) {
      setProducts([]);
      return;
    }
    setLoading(true);
    backofficeService.getProducts()
      .then(async (res) => {
        const activeProducts = (res.data || []).filter(p => p.is_active);
        setProducts(activeProducts);

        const productCodes = activeProducts.map(p => p.sap_code).filter(Boolean);
        if (productCodes.length === 0) return;

        const pricesRes = await backofficeService.getClientProductPrices(selectedClientId, productCodes);
        const priceMap = new Map((pricesRes.data || []).map(p => [p.sap_code || p.code, p]));

        setProducts(prev => prev.map(p => ({ ...p, priceInfo: priceMap.get(p.sap_code) || null })));
      })
      .catch(err => setMessage({ type: 'error', text: err.message || 'Error al cargar el catálogo' }))
      .finally(() => setLoading(false));
  }, [selectedClientId]);

  const addToCart = (product) => {
    setCart(prev => ({
      ...prev,
      [product.product_id]: {
        product,
        quantity: (prev[product.product_id]?.quantity || 0) + 1
      }
    }));
  };

  const updateQuantity = (productId, quantity) => {
    const qty = Math.max(0, parseInt(quantity, 10) || 0);
    setCart(prev => {
      if (qty === 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...prev[productId], quantity: qty } };
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const cartItems = Object.values(cart);
  const cartSubtotal = cartItems.reduce((sum, item) => {
    const unitPrice = parseFloat(item.product.priceInfo?.effective_price || item.product.priceInfo?.price || 0);
    return sum + unitPrice * item.quantity;
  }, 0);

  // Desglose de impuestos por categoría, igual que CreateOrderForm.jsx: se usa el
  // tax_breakdown que ya devuelve el backend (getClientProductPrices -> Order.
  // getProductPricesWithTaxByClientId) — nunca se recalculan tasas en el frontend.
  const { ivaTotal, impuestoSaludableTotal, otroTotal } = cartItems.reduce((acc, item) => {
    const unitPrice = parseFloat(item.product.priceInfo?.effective_price || item.product.priceInfo?.price || 0);
    const lineSubtotal = unitPrice * item.quantity;
    const breakdown = item.product.priceInfo?.tax_breakdown || [];
    breakdown.forEach(component => {
      const amount = lineSubtotal * (parseFloat(component.rate) || 0);
      if (component.category === 'IVA') acc.ivaTotal += amount;
      else if (component.category === 'IMPUESTO_SALUDABLE') acc.impuestoSaludableTotal += amount;
      else acc.otroTotal += amount;
    });
    return acc;
  }, { ivaTotal: 0, impuestoSaludableTotal: 0, otroTotal: 0 });

  const cartTotal = cartSubtotal + ivaTotal + impuestoSaludableTotal + otroTotal;

  const handleSubmit = async () => {
    if (!selectedClientId || !selectedBranchId) {
      setMessage({ type: 'error', text: 'Selecciona un cliente y una sucursal' });
      return;
    }
    if (cartItems.length === 0) {
      setMessage({ type: 'error', text: 'Agrega al menos un producto a la orden' });
      return;
    }

    const client = clients.find(c => String(c.client_id) === String(selectedClientId));
    if (!client) {
      setMessage({ type: 'error', text: 'Cliente no encontrado' });
      return;
    }

    const details = cartItems.map(item => ({
      product_id: item.product.product_id,
      quantity: item.quantity,
      unit_price: parseFloat(item.product.priceInfo?.effective_price || item.product.priceInfo?.price || 0)
    }));

    const branch = branches.find(b => String(b.branch_id) === String(selectedBranchId));
    // Se capturan los valores del carrito ANTES de limpiarlo, para poder mostrar el
    // resumen de la orden recién creada (subtotal/IVA/Imp. Saludable/total) aunque
    // el carrito ya esté vacío al momento de renderizar el resumen.
    const summarySnapshot = {
      subtotal: cartSubtotal,
      ivaTotal,
      impuestoSaludableTotal,
      otroTotal,
      total: cartTotal,
      clientName: client.razonSocial,
      branchName: branch?.branch_name || ''
    };

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await backofficeService.createOrderForClient({
        user_id: client.user_id,
        branch_id: selectedBranchId,
        total_amount: cartTotal,
        details,
        comments,
        customer_po_number: customerPoNumber || undefined
      });
      const orderId = response.data?.order_id;
      setToast({ text: `Orden #${orderId} creada exitosamente a nombre de ${client.razonSocial}` });
      setLastOrderSummary({ orderId, ...summarySnapshot });
      setCart({});
      setComments('');
      setCustomerPoNumber('');
      loadClientOrders(selectedClientId);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Error al crear la orden' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="backoffice-tab-content">
      {toast && (
        <div className="backoffice-toast success">
          <FaCheck /> {toast.text}
          <button className="close-btn" onClick={() => setToast(null)}><FaTimes /></button>
        </div>
      )}

      {message && (
        <div className={`action-message ${message.type}`}>
          {message.text}
          <button className="close-btn" onClick={() => setMessage(null)}><FaTimes /></button>
        </div>
      )}

      {lastOrderSummary && (
        <div className="order-summary-card">
          <div className="order-summary-header">
            <h3>Orden #{lastOrderSummary.orderId} creada</h3>
            <button className="close-btn" onClick={() => setLastOrderSummary(null)}><FaTimes /></button>
          </div>
          <p><strong>Cliente:</strong> {lastOrderSummary.clientName}</p>
          <p><strong>Sucursal:</strong> {lastOrderSummary.branchName}</p>
          <div className="order-summary-breakdown">
            <div><span>Subtotal</span><span>${lastOrderSummary.subtotal.toLocaleString('es-CO')}</span></div>
            {lastOrderSummary.ivaTotal > 0 && (
              <div><span>IVA</span><span>${lastOrderSummary.ivaTotal.toLocaleString('es-CO')}</span></div>
            )}
            {lastOrderSummary.impuestoSaludableTotal > 0 && (
              <div><span>Impuesto Saludable</span><span>${lastOrderSummary.impuestoSaludableTotal.toLocaleString('es-CO')}</span></div>
            )}
            {lastOrderSummary.otroTotal > 0 && (
              <div><span>Otros impuestos</span><span>${lastOrderSummary.otroTotal.toLocaleString('es-CO')}</span></div>
            )}
            <div className="total"><span>Total</span><span>${lastOrderSummary.total.toLocaleString('es-CO')}</span></div>
          </div>
        </div>
      )}

      <div className="order-selectors">
        <label>
          Cliente
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="">Selecciona un cliente...</option>
            {clients.map(c => (
              <option key={c.client_id} value={c.client_id}>{c.razonSocial} ({c.nit})</option>
            ))}
          </select>
        </label>

        <label>
          Sucursal
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={!selectedClientId || branches.length === 0}
          >
            <option value="">Selecciona una sucursal...</option>
            {branches.map(b => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
            ))}
          </select>
        </label>
      </div>

      {selectedClientId && (
        <>
          <div className="client-orders-summary">
            <h3>Órdenes BackOffice de este cliente</h3>
            {clientOrdersLoading && <p>Cargando órdenes...</p>}
            {!clientOrdersLoading && clientOrders.length === 0 && <p>Este cliente no tiene órdenes creadas desde BackOffice todavía.</p>}
            {!clientOrdersLoading && clientOrders.length > 0 && (
              <table className="backoffice-subtable">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Sucursal</th>
                    <th>Estado</th>
                    <th>Total</th>
                    <th>Fecha</th>
                    <th>Creada por</th>
                  </tr>
                </thead>
                <tbody>
                  {clientOrders.map(o => (
                    <tr key={o.order_id}>
                      <td>#{o.order_id}</td>
                      <td>{o.branch_name}</td>
                      <td>{o.status_name}</td>
                      <td>${parseFloat(o.total_amount || 0).toLocaleString('es-CO')}</td>
                      <td>{new Date(o.created_at).toLocaleDateString('es-CO')}</td>
                      <td>{o.placed_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {loading && <p>Cargando catálogo...</p>}

          {!loading && (
            <table className="backoffice-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código SAP</th>
                  <th>Precio con impuestos</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.product_id}>
                    <td>{p.name}</td>
                    <td>{p.sap_code}</td>
                    <td>
                      {p.priceInfo
                        ? `$${parseFloat(p.priceInfo.effective_price || p.priceInfo.price || 0).toLocaleString('es-CO')}`
                        : 'No disponible'}
                    </td>
                    <td>
                      <button className="btn-secondary" onClick={() => addToCart(p)} disabled={!p.priceInfo}>
                        <FaShoppingCart /> Agregar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Carrito</h3>
          {cartItems.length === 0 && <p>No hay productos agregados.</p>}
          {cartItems.length > 0 && (
            <table className="backoffice-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map(item => {
                  const unitPrice = parseFloat(item.product.priceInfo?.effective_price || item.product.priceInfo?.price || 0);
                  return (
                    <tr key={item.product.product_id}>
                      <td>{item.product.name}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.product.product_id, e.target.value)}
                        />
                      </td>
                      <td>${(unitPrice * item.quantity).toLocaleString('es-CO')}</td>
                      <td>
                        <button className="btn-danger" onClick={() => removeFromCart(item.product.product_id)}>
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Subtotal</td>
                  <td colSpan={2}>${cartSubtotal.toLocaleString('es-CO')}</td>
                </tr>
                {ivaTotal > 0 && (
                  <tr>
                    <td colSpan={2}>IVA</td>
                    <td colSpan={2}>${ivaTotal.toLocaleString('es-CO')}</td>
                  </tr>
                )}
                {impuestoSaludableTotal > 0 && (
                  <tr>
                    <td colSpan={2}>Impuesto Saludable</td>
                    <td colSpan={2}>${impuestoSaludableTotal.toLocaleString('es-CO')}</td>
                  </tr>
                )}
                {otroTotal > 0 && (
                  <tr>
                    <td colSpan={2}>Otros impuestos</td>
                    <td colSpan={2}>${otroTotal.toLocaleString('es-CO')}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2}><strong>Total</strong></td>
                  <td colSpan={2}><strong>${cartTotal.toLocaleString('es-CO')}</strong></td>
                </tr>
              </tfoot>
            </table>
          )}

          <div className="order-extra-fields">
            <label>
              Número de orden de compra del cliente (opcional)
              <input type="text" value={customerPoNumber} onChange={(e) => setCustomerPoNumber(e.target.value)} />
            </label>
            <label>
              Comentarios (opcional)
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} />
            </label>
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><FaSync className="spin" /> Creando orden...</> : 'Crear orden a nombre del cliente'}
          </button>
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Tab: Pedidos del día (faceted search)                                */
/* ------------------------------------------------------------------ */

const TODAY = () => new Date().toISOString().split('T')[0];

const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: '1', label: 'Abierto' },
  { value: '2', label: 'Confirmado' },
  { value: '3', label: 'En Producción' },
  { value: '4', label: 'Entregado completo' },
  { value: '5', label: 'Cerrado' },
  { value: '6', label: 'Cancelado' },
  { value: '7', label: 'Entregado parcial' }
];

const DailyOrdersTab = () => {
  const [dateFrom, setDateFrom] = useState(TODAY());
  const [dateTo, setDateTo] = useState(TODAY());
  const [orderOrigin, setOrderOrigin] = useState('');
  const [statusId, setStatusId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    backofficeService.getOrders({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      order_origin: orderOrigin || undefined,
      status_id: statusId || undefined
    })
      .then(res => setOrders(res.data || []))
      .catch(err => setError(err.message || 'Error al cargar las órdenes'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, orderOrigin, statusId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Filtro de cliente/sucursal: en el propio navegador, sobre lo ya traído del backend
  // (los demás facets sí van al backend porque cambian qué filas existen; este es solo
  // texto libre sobre el resultado ya cargado, como el buscador tipo Google que se pidió).
  const filteredOrders = clientSearch.trim()
    ? orders.filter(o =>
        (o.client_name || '').toLowerCase().includes(clientSearch.trim().toLowerCase()) ||
        (o.branch_name || '').toLowerCase().includes(clientSearch.trim().toLowerCase())
      )
    : orders;

  const totals = filteredOrders.reduce((acc, o) => {
    acc.count += 1;
    acc.total += parseFloat(o.total_amount || 0);
    return acc;
  }, { count: 0, total: 0 });

  return (
    <div className="backoffice-tab-content">
      <div className="daily-orders-filters">
        <label>
          Desde
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label>
          Origen
          <select value={orderOrigin} onChange={(e) => setOrderOrigin(e.target.value)}>
            <option value="">Todos</option>
            <option value="backoffice">BackOffice</option>
            <option value="self_service">Autoservicio (cliente)</option>
          </select>
        </label>
        <label>
          Estado
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            {ORDER_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="search-label">
          <FaFilter /> Cliente / sucursal
          <input
            type="text"
            placeholder="Filtrar por nombre..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
        </label>
        <button className="btn-secondary" onClick={loadOrders}><FaSync /> Actualizar</button>
      </div>

      {error && <div className="action-message error">{error}</div>}
      {loading && <p>Cargando órdenes...</p>}

      {!loading && (
        <>
          <p className="daily-orders-count">{totals.count} órdenes — total ${totals.total.toLocaleString('es-CO')}</p>
          <table className="backoffice-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Sucursal</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Total</th>
                <th>SAP</th>
                <th>Fecha</th>
                <th>Creada por</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(o => (
                <tr key={o.order_id}>
                  <td>#{o.order_id}</td>
                  <td>{o.client_name}</td>
                  <td>{o.branch_name}</td>
                  <td>{o.order_origin === 'backoffice' ? 'BackOffice' : 'Autoservicio'}</td>
                  <td>{o.status_name}</td>
                  <td>${parseFloat(o.total_amount || 0).toLocaleString('es-CO')}</td>
                  <td>{o.sap_synced ? `Sí (${o.sap_doc_entry ?? ''})` : 'No'}</td>
                  <td>{new Date(o.created_at).toLocaleString('es-CO')}</td>
                  <td>{o.placed_by_name || '—'}</td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr><td colSpan={9}>No se encontraron órdenes con estos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default BackofficePage;
