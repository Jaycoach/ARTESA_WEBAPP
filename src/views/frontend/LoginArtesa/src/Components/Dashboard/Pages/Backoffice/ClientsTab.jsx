import React, { useEffect, useState, useCallback } from 'react';
import backofficeCoreService from '../../../../services/backofficeCoreService';
import { useAuth } from '../../../../hooks/useAuth';
import { roleHasPermission, PERMISSIONS } from '../../../../constants/backofficePermissions';

const ClientsTab = () => {
  const { user } = useAuth();
  const roleId = Number(user?.role ?? user?.rol);
  const canManageStatus = roleHasPermission(roleId, PERMISSIONS.CLIENTS_MANAGE_STATUS);

  const [subTab, setSubTab] = useState('with-profile');
  const [clients, setClients] = useState([]);
  const [withoutProfile, setWithoutProfile] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [confirming, setConfirming] = useState(null); // { userId, name }
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [clientsRes, withoutRes] = await Promise.all([
      backofficeCoreService.getClients(),
      backofficeCoreService.getClientsWithoutProfile()
    ]);
    if (clientsRes.success) setClients(clientsRes.data.data || []);
    else setError(clientsRes.error);
    if (withoutRes.success) setWithoutProfile(withoutRes.data.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDeactivateModal = async (userId, name) => {
    setConfirming({ userId, name });
    setReason('');
    setPreview(null);
    const result = await backofficeCoreService.getDeactivationPreview(userId);
    if (result.success) setPreview(result.data.data);
  };

  const confirmDeactivate = async () => {
    if (!reason.trim()) { setError('El motivo es obligatorio.'); return; }
    const result = await backofficeCoreService.deactivateClient(confirming.userId, reason.trim());
    if (result.success) {
      setMessage('Cliente inactivado.');
      setConfirming(null);
      load();
    } else {
      setError(result.error);
    }
  };

  const handleActivate = async (userId) => {
    const result = await backofficeCoreService.activateClient(userId);
    if (result.success) { setMessage('Cliente reactivado.'); load(); }
    else setError(result.error);
  };

  return (
    <div>
      {error && <div className="bo-alert bo-alert--error">{error}</div>}
      {message && <div className="bo-alert bo-alert--success">{message}</div>}

      <div className="backoffice-page__tabs" style={{ marginBottom: 12 }}>
        <button
          className={`backoffice-page__tab ${subTab === 'with-profile' ? 'is-active' : ''}`}
          onClick={() => setSubTab('with-profile')}
        >Con perfil</button>
        <button
          className={`backoffice-page__tab ${subTab === 'without-profile' ? 'is-active' : ''}`}
          onClick={() => setSubTab('without-profile')}
        >Registros sin perfil ({withoutProfile.length})</button>
      </div>

      <div className="bo-card">
        {loading ? <p>Cargando...</p> : subTab === 'with-profile' ? (
          <table className="bo-table">
            <thead><tr><th>Empresa</th><th>Contacto</th><th>Correo</th><th>Estado</th>{canManageStatus && <th>Acciones</th>}</tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.user_id}>
                  <td>{c.razonSocial}</td>
                  <td>{c.nombre}</td>
                  <td>{c.email}</td>
                  <td>
                    <span className={`bo-badge ${c.is_active ? 'bo-badge--active' : 'bo-badge--inactive'}`}>
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {canManageStatus && (
                    <td>
                      {c.is_active ? (
                        <button className="bo-btn bo-btn--danger" onClick={() => openDeactivateModal(c.user_id, c.razonSocial)}>
                          Inactivar
                        </button>
                      ) : (
                        <button className="bo-btn bo-btn--primary" onClick={() => handleActivate(c.user_id)}>Activar</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="bo-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th>{canManageStatus && <th>Acciones</th>}</tr></thead>
            <tbody>
              {withoutProfile.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.mail}</td>
                  <td>
                    <span className={`bo-badge ${u.is_active ? 'bo-badge--active' : 'bo-badge--inactive'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {canManageStatus && (
                    <td>
                      {u.is_active ? (
                        <button className="bo-btn bo-btn--danger" onClick={() => openDeactivateModal(u.id, u.name)}>
                          Inactivar
                        </button>
                      ) : (
                        <button className="bo-btn bo-btn--primary" onClick={() => handleActivate(u.id)}>Activar</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirming && (
        <div className="bo-card">
          <h3>Inactivar a {confirming.name}</h3>
          {preview ? (
            <div className="bo-alert bo-alert--warning">
              Pedidos pendientes: <strong>{preview.pending_orders}</strong> (de esos, sin sincronizar
              con SAP: <strong>{preview.pending_orders_not_synced}</strong>). Sucursales: <strong>{preview.branches}</strong>{' '}
              (con login habilitado: <strong>{preview.branches_login_enabled}</strong>). Los pedidos NO se cancelan.
            </div>
          ) : <p>Cargando vista previa...</p>}
          <div className="bo-form-row">
            <label>Motivo (obligatorio)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="bo-btn bo-btn--danger" onClick={confirmDeactivate}>Confirmar inactivación</button>{' '}
          <button className="bo-btn bo-btn--secondary" onClick={() => setConfirming(null)}>Cancelar</button>
        </div>
      )}
    </div>
  );
};

export default ClientsTab;
