import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { roleHasPermission, PERMISSIONS } from '../../../../constants/backofficePermissions';
import API from '../../../../api/config';
import PlatformUsersTab from './PlatformUsersTab';
import ClientsTab from './ClientsTab';
import SettingsTab from './SettingsTab';
import SyncTab from './SyncTab';
import './BackofficePage.scss';

// Núcleo del BackOffice (clase A + platform-users/clients/settings/sync nuevos).
// Nada de gestión de pedidos (clase C) ni CRUD de sucursales (clase B2) — eso sigue
// pausado en feature/backoffice-module.
const TABS = [
  { key: 'platform-users', label: 'Usuarios de plataforma', permission: PERMISSIONS.PLATFORM_USERS_MANAGE },
  { key: 'clients', label: 'Clientes', permission: PERMISSIONS.CLIENTS_VIEW },
  { key: 'settings', label: 'Configuración', permission: PERMISSIONS.SETTINGS_MANAGE },
  { key: 'sync', label: 'Sincronizaciones', permission: PERMISSIONS.SAP_SYNC_VIEW }
];

const BackofficePage = () => {
  const { user } = useAuth();
  const roleId = Number(user?.role ?? user?.rol);

  const hasAnyBackofficeAccess = [1, 3, 4].includes(roleId);

  const availableTabs = TABS.filter((tab) => roleHasPermission(roleId, tab.permission));
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.key || null);

  // ADMIN (id 1, u otro ADMIN con client_profiles de pruebas) puede tener también un
  // perfil de cliente: ofrecerle un enlace directo al portal, sin cambiar su rol.
  const [hasClientProfile, setHasClientProfile] = useState(false);
  useEffect(() => {
    if (roleId !== 1 || !user?.id) return;
    let cancelled = false;
    API.get(`/client-profiles/user/${user.id}`)
      .then((res) => { if (!cancelled && res.data?.data) setHasClientProfile(true); })
      .catch(() => { /* sin perfil, no pasa nada */ });
    return () => { cancelled = true; };
  }, [roleId, user?.id]);

  if (!hasAnyBackofficeAccess) {
    return (
      <div className="backoffice-page backoffice-page--denied">
        <h2>Acceso denegado</h2>
        <p>No tienes permisos para acceder al BackOffice.</p>
      </div>
    );
  }

  if (availableTabs.length === 0) {
    return (
      <div className="backoffice-page backoffice-page--denied">
        <h2>Sin capacidades asignadas</h2>
        <p>Tu rol no tiene ninguna capacidad habilitada en el BackOffice todavía.</p>
      </div>
    );
  }

  const currentTab = availableTabs.find((t) => t.key === activeTab) || availableTabs[0];

  return (
    <div className="backoffice-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="backoffice-page__title">BackOffice</h1>
        {hasClientProfile && (
          <a href="/dashboard" className="bo-btn bo-btn--secondary">Ver portal de cliente</a>
        )}
      </div>

      <div className="backoffice-page__tabs" role="tablist">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={currentTab.key === tab.key}
            className={`backoffice-page__tab ${currentTab.key === tab.key ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="backoffice-page__content">
        {currentTab.key === 'platform-users' && <PlatformUsersTab />}
        {currentTab.key === 'clients' && <ClientsTab />}
        {currentTab.key === 'settings' && <SettingsTab />}
        {currentTab.key === 'sync' && <SyncTab />}
      </div>
    </div>
  );
};

export default BackofficePage;
