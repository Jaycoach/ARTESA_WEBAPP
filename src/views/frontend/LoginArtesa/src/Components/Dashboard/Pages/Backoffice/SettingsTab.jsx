import React, { useEffect, useState } from 'react';
import backofficeCoreService from '../../../../services/backofficeCoreService';
import { useAuth } from '../../../../hooks/useAuth';
import { roleHasPermission, PERMISSIONS } from '../../../../constants/backofficePermissions';

const SettingsTab = () => {
  const { user } = useAuth();
  const roleId = Number(user?.role ?? user?.rol);
  const canManageBranchLogin = roleHasPermission(roleId, PERMISSIONS.BRANCH_LOGIN_MANAGE);

  const [orderTimeLimit, setOrderTimeLimit] = useState('18:00');
  const [bannerFile, setBannerFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [branchId, setBranchId] = useState('');
  const [branchEmail, setBranchEmail] = useState('');
  const [branchPassword, setBranchPassword] = useState('');

  useEffect(() => {
    (async () => {
      const result = await backofficeCoreService.getSettings();
      if (result.success) {
        setOrderTimeLimit(result.data.data?.orderTimeLimit || '18:00');
      } else {
        setError(result.error);
      }
      setLoading(false);
    })();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.append('orderTimeLimit', orderTimeLimit);
    if (bannerFile) formData.append('homeBannerImage', bannerFile);
    const result = await backofficeCoreService.updateSettings(formData);
    setSaving(false);
    if (result.success) setMessage('Configuración guardada.');
    else setError(result.error);
  };

  const handleEnableLogin = async () => {
    if (!branchId) { setError('Indica el ID de la sucursal.'); return; }
    const result = await backofficeCoreService.enableBranchLogin(branchId, {
      email: branchEmail,
      password: branchPassword
    });
    if (result.success) setMessage('Login de sucursal habilitado.');
    else setError(result.error);
  };

  const handleDisableLogin = async () => {
    if (!branchId) { setError('Indica el ID de la sucursal.'); return; }
    const result = await backofficeCoreService.disableBranchLogin(branchId);
    if (result.success) setMessage('Login de sucursal deshabilitado.');
    else setError(result.error);
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      {error && <div className="bo-alert bo-alert--error">{error}</div>}
      {message && <div className="bo-alert bo-alert--success">{message}</div>}

      <div className="bo-card">
        <h3>Hora de cierre y banner</h3>
        <form onSubmit={handleSaveSettings}>
          <div className="bo-form-row">
            <label>Hora de cierre (HH:MM)</label>
            <input
              type="time"
              value={orderTimeLimit}
              onChange={(e) => setOrderTimeLimit(e.target.value)}
              required
            />
          </div>
          <div className="bo-form-row">
            <label>Banner (opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
          </div>
          <button className="bo-btn bo-btn--primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </form>
      </div>

      {canManageBranchLogin && (
        <div className="bo-card">
          <h3>Login de sucursal</h3>
          <div className="bo-form-row">
            <label>ID de sucursal</label>
            <input value={branchId} onChange={(e) => setBranchId(e.target.value)} />
          </div>
          <div className="bo-form-row">
            <label>Correo (para habilitar)</label>
            <input value={branchEmail} onChange={(e) => setBranchEmail(e.target.value)} />
          </div>
          <div className="bo-form-row">
            <label>Contraseña (para habilitar)</label>
            <input type="password" value={branchPassword} onChange={(e) => setBranchPassword(e.target.value)} />
          </div>
          <button className="bo-btn bo-btn--primary" onClick={handleEnableLogin}>Habilitar login</button>{' '}
          <button className="bo-btn bo-btn--danger" onClick={handleDisableLogin}>Deshabilitar login</button>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
