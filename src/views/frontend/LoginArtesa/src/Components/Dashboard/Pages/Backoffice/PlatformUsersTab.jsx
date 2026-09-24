import React, { useEffect, useState, useCallback } from 'react';
import backofficeCoreService from '../../../../services/backofficeCoreService';

const PlatformUsersTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', mail: '', rolId: 3 });
  const [creating, setCreating] = useState(false);

  const [deactivating, setDeactivating] = useState(null); // { id, reason }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await backofficeCoreService.getPlatformUsers();
    if (result.success) {
      setUsers(result.data.data || []);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    setError(null);
    const result = await backofficeCoreService.createPlatformUser({
      name: form.name,
      mail: form.mail,
      rolId: Number(form.rolId)
    });
    setCreating(false);
    if (result.success) {
      setMessage(
        result.data.invitationSent
          ? `Usuario creado. Se envió la invitación a ${form.mail}.`
          : `Usuario creado, pero la invitación no pudo enviarse. Usa "Reenviar invitación".`
      );
      setForm({ name: '', mail: '', rolId: 3 });
      setShowCreate(false);
      load();
    } else {
      setError(result.error);
    }
  };

  const handleResend = async (id) => {
    const result = await backofficeCoreService.resendInvitation(id);
    setMessage(result.success ? 'Invitación reenviada.' : null);
    setError(result.success ? null : result.error);
  };

  const handleActivate = async (id) => {
    const result = await backofficeCoreService.activatePlatformUser(id);
    if (result.success) { setMessage('Usuario reactivado.'); load(); }
    else setError(result.error);
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivating?.reason?.trim()) {
      setError('El motivo es obligatorio.');
      return;
    }
    const result = await backofficeCoreService.deactivatePlatformUser(deactivating.id, deactivating.reason.trim());
    if (result.success) {
      setMessage('Usuario inactivado.');
      setDeactivating(null);
      load();
    } else {
      setError(result.error);
    }
  };

  const handleRoleChange = async (id, newRoleId) => {
    const result = await backofficeCoreService.changePlatformUserRole(id, Number(newRoleId));
    if (result.success) { setMessage('Rol actualizado.'); load(); }
    else setError(result.error);
  };

  return (
    <div>
      {error && <div className="bo-alert bo-alert--error">{error}</div>}
      {message && <div className="bo-alert bo-alert--success">{message}</div>}

      <div className="bo-card">
        <button className="bo-btn bo-btn--primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancelar' : '+ Nuevo usuario de plataforma'}
        </button>

        {showCreate && (
          <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
            <div className="bo-form-row">
              <label>Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="bo-form-row">
              <label>Correo</label>
              <input type="email" value={form.mail} onChange={(e) => setForm({ ...form, mail: e.target.value })} required />
            </div>
            <div className="bo-form-row">
              <label>Rol</label>
              <select value={form.rolId} onChange={(e) => setForm({ ...form, rolId: e.target.value })}>
                <option value={1}>Administrador</option>
                <option value={3}>Administrador funcional</option>
              </select>
            </div>
            <button className="bo-btn bo-btn--primary" type="submit" disabled={creating}>
              {creating ? 'Creando...' : 'Crear y enviar invitación'}
            </button>
          </form>
        )}
      </div>

      <div className="bo-card">
        {loading ? <p>Cargando...</p> : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.mail}</td>
                  <td>
                    <select
                      value={u.rol_id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={![1, 3].includes(u.rol_id)}
                    >
                      <option value={1}>ADMIN</option>
                      <option value={3}>FUNCTIONAL_ADMIN</option>
                      {u.rol_id === 4 && <option value={4}>BACKOFFICE</option>}
                    </select>
                  </td>
                  <td>
                    <span className={`bo-badge ${u.is_active ? 'bo-badge--active' : 'bo-badge--inactive'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button className="bo-btn bo-btn--secondary" onClick={() => handleResend(u.id)}>Reenviar invitación</button>{' '}
                    {u.is_active ? (
                      <button className="bo-btn bo-btn--danger" onClick={() => setDeactivating({ id: u.id, reason: '' })}>
                        Inactivar
                      </button>
                    ) : (
                      <button className="bo-btn bo-btn--primary" onClick={() => handleActivate(u.id)}>Activar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deactivating && (
        <div className="bo-card">
          <h3>Confirmar inactivación</h3>
          <div className="bo-form-row">
            <label>Motivo (obligatorio)</label>
            <textarea
              value={deactivating.reason}
              onChange={(e) => setDeactivating({ ...deactivating, reason: e.target.value })}
            />
          </div>
          <button className="bo-btn bo-btn--danger" onClick={handleDeactivateConfirm}>Confirmar inactivación</button>{' '}
          <button className="bo-btn bo-btn--secondary" onClick={() => setDeactivating(null)}>Cancelar</button>
        </div>
      )}
    </div>
  );
};

export default PlatformUsersTab;
