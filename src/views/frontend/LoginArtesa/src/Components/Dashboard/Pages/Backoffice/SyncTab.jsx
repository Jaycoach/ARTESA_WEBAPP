import React, { useEffect, useState, useCallback } from 'react';
import backofficeCoreService from '../../../../services/backofficeCoreService';
import { useAuth } from '../../../../hooks/useAuth';
import { roleHasPermission, PERMISSIONS } from '../../../../constants/backofficePermissions';

const SyncTab = () => {
  const { user } = useAuth();
  const roleId = Number(user?.role ?? user?.rol);
  const canExecute = roleHasPermission(roleId, PERMISSIONS.SAP_SYNC_EXECUTE);

  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [statusRes, pendingRes] = await Promise.all([
      backofficeCoreService.getSyncStatus(),
      backofficeCoreService.getPendingClients()
    ]);
    if (statusRes.success) setStatus(statusRes.data.data);
    if (pendingRes.success) setPending(pendingRes.data.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (label, fn) => {
    setRunning(label);
    setError(null);
    setMessage(null);
    const result = await fn();
    setRunning(null);
    if (result.success) {
      setMessage(`${label}: iniciada/completada exitosamente.`);
      load();
    } else {
      setError(`${label}: ${result.error}`);
    }
  };

  return (
    <div>
      {error && <div className="bo-alert bo-alert--error">{error}</div>}
      {message && <div className="bo-alert bo-alert--success">{message}</div>}

      <div className="bo-card">
        <h3>Estado</h3>
        {loading ? <p>Cargando...</p> : (
          <pre style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(status, null, 2)}</pre>
        )}
        <p>Clientes pendientes de activación: <strong>{pending.length}</strong></p>
      </div>

      {canExecute && (
        <div className="bo-card">
          <h3>Disparar sincronización manual</h3>
          <button className="bo-btn bo-btn--primary" disabled={!!running}
            onClick={() => run('Sincronizar todos los clientes', backofficeCoreService.syncAllClients)}>
            {running === 'Sincronizar todos los clientes' ? 'Ejecutando...' : 'Sincronizar clientes'}
          </button>{' '}
          <button className="bo-btn bo-btn--primary" disabled={!!running}
            onClick={() => run('Sincronizar sucursales', backofficeCoreService.syncBranches)}>
            {running === 'Sincronizar sucursales' ? 'Ejecutando...' : 'Sincronizar sucursales'}
          </button>{' '}
          <button className="bo-btn bo-btn--primary" disabled={!!running}
            onClick={() => run('Sincronizar productos', backofficeCoreService.syncProducts)}>
            {running === 'Sincronizar productos' ? 'Ejecutando...' : 'Sincronizar productos'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SyncTab;
