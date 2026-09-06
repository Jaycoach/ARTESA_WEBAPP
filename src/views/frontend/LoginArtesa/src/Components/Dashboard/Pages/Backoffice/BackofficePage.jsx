import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import backofficeService from '../../../../services/backofficeService';
import {
  FaSearch, FaCheck, FaTimes, FaKey, FaShoppingCart, FaSync,
  FaUsers, FaBuilding, FaTrash
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
      </div>

      {activeTab === 'clients' && <ClientsTab />}
      {activeTab === 'order' && <CreateOrderTab />}
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

  useEffect(() => {
    backofficeService.getClients('').then(res => setClients(res.data || [])).catch(err => {
      setMessage({ type: 'error', text: err.message || 'Error al cargar clientes' });
    });
  }, []);

  useEffect(() => {
    setSelectedBranchId('');
    setBranches([]);
    setCart({});
    if (!selectedClientId) return;

    backofficeService.getClientBranches(selectedClientId)
      .then(res => setBranches(res.data || []))
      .catch(err => setMessage({ type: 'error', text: err.message || 'Error al cargar sucursales' }));
  }, [selectedClientId]);

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
  const cartTotal = cartItems.reduce((sum, item) => {
    const unitPrice = parseFloat(item.product.priceInfo?.effective_price || item.product.priceInfo?.price || 0);
    return sum + unitPrice * item.quantity;
  }, 0);

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
      setMessage({ type: 'success', text: `Orden #${response.data?.order_id} creada exitosamente a nombre de ${client.razonSocial}` });
      setCart({});
      setComments('');
      setCustomerPoNumber('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Error al crear la orden' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="backoffice-tab-content">
      {message && (
        <div className={`action-message ${message.type}`}>
          {message.text}
          <button className="close-btn" onClick={() => setMessage(null)}><FaTimes /></button>
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

export default BackofficePage;
