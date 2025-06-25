import React, { useState, useCallback } from 'react';
import {
  FaEye, FaDownload, FaIdCard, FaFileInvoice, FaFileAlt, FaSearch,
  FaChevronDown, FaChevronUp, FaUser, FaBuilding,
  FaUniversity, FaPhone, FaSpinner, FaExclamationTriangle, FaSync
} from 'react-icons/fa';
import { useClientProfile } from '../../../../hooks/useClientProfile';
import { getEnvironmentInfo } from '../../../../utils/environment';

const ClientList = () => {
  const {
    data: singleClient,
    clients,
    loading,
    error,
    isAdmin,
    downloadDocument,
    getDocumentAvailability,
    isDownloading,
    reloadData
  } = useClientProfile();

  const envInfo = getEnvironmentInfo();

  // Estados locales para UI
  const [expandedRows, setExpandedRows] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'ascending' });

  // **COMPONENTE**: Botón de descarga optimizado
  const DownloadButton = ({ client, documentType, documentName, icon: Icon, color, label }) => {
    const availability = getDocumentAvailability(client);
    const isDocumentDownloading = isDownloading(client, documentType);
    const documentAvailable = availability[documentType];

    return (
      <button
        onClick={() => downloadDocument(client, documentType, documentName)}
        disabled={!documentAvailable || isDocumentDownloading}
        className={`px-4 py-2 rounded-lg flex items-center justify-center w-full transition-colors font-medium ${
          !documentAvailable || isDocumentDownloading
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : `bg-${color}-600 text-white hover:bg-${color}-700 active:bg-${color}-800`
        }`}
        title={!documentAvailable ? `${label} no disponible` : `Descargar ${label}`}
      >
        {isDocumentDownloading ? (
          <>
            <FaSpinner className="mr-2 animate-spin" />
            Descargando...
          </>
        ) : (
          <>
            <Icon className="mr-2" />
            {documentAvailable ? 'Descargar' : 'No disponible'}
          </>
        )}
      </button>
    );
  };

  // Funciones de UI (simplificadas)
  const toggleRowExpansion = useCallback((clientId) => {
    setExpandedRows(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  }, []);

  const filteredClients = isAdmin ? clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (client.nombre || '').toLowerCase().includes(searchLower) ||
      (client.email || '').toLowerCase().includes(searchLower) ||
      (client.nit_number || '').toLowerCase().includes(searchLower) ||
      (client.razonSocial || '').toLowerCase().includes(searchLower)
    );
  }) : [];

  const sortedClients = [...filteredClients].sort((a, b) => {
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    const result = aValue.localeCompare(bValue);
    return sortConfig.direction === 'ascending' ? result : -result;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);

  const requestSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  }, []);

  // Estados de carga y error
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Cargando información de clientes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FaExclamationTriangle className="mr-2" />
            <span>{error}</span>
          </div>
          <button 
            onClick={reloadData}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
          >
            <FaSync />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // **RENDERIZADO PARA USUARIO NO ADMIN**
  if (!isAdmin && singleClient) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--primary-color)' }}>
          Mi perfil de cliente
        </h2>

        {/* Debug info en desarrollo */}
        {envInfo.isDevelopment && (
          <div className="mb-4 p-2 bg-blue-100 border border-blue-300 rounded text-xs">
            🚀 Entorno: {envInfo.mode?.toUpperCase()} | API: {envInfo.apiUrl}
            <br />
            🆔 Client ID: {singleClient.client_id} | User ID: {singleClient.user_id}
          </div>
        )}

        {/* Información del cliente */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <FaUser className="text-lg text-blue-500" />
            <span className="font-semibold">Nombre:</span>
            <span>{singleClient.nombre || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaBuilding className="text-lg text-amber-500" />
            <span className="font-semibold">Razón Social:</span>
            <span>{singleClient.razonSocial || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaIdCard className="text-lg text-green-500" />
            <span className="font-semibold">NIT:</span>
            <span>
              {singleClient.nit_number 
                ? `${singleClient.nit_number}-${singleClient.verification_digit}` 
                : 'N/A'
              }
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaFileAlt className="text-lg text-purple-500" />
            <span className="font-semibold">Email:</span>
            <span>{singleClient.email || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaPhone className="text-lg text-red-500" />
            <span className="font-semibold">Teléfono:</span>
            <span>{singleClient.telefono || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaUniversity className="text-lg text-indigo-500" />
            <span className="font-semibold">Dirección:</span>
            <span>
              {singleClient.direccion 
                ? `${singleClient.direccion}, ${singleClient.ciudad || ''}, ${singleClient.pais || ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '')
                : 'N/A'
              }
            </span>
          </div>
        </div>

        {/* Sección de documentos */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--primary-color)' }}>
            Documentos Disponibles
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cédula */}
            <div className="border rounded-lg p-4 text-center bg-blue-50">
              <FaIdCard className="mx-auto text-3xl text-blue-500 mb-3" />
              <h4 className="font-medium mb-3">Cédula de Identidad</h4>
              <DownloadButton
                client={singleClient}
                documentType="cedula"
                documentName="cedula"
                icon={FaDownload}
                color="blue"
                label="Cédula"
              />
            </div>
            
            {/* RUT */}
            <div className="border rounded-lg p-4 text-center bg-green-50">
              <FaFileInvoice className="mx-auto text-3xl text-green-500 mb-3" />
              <h4 className="font-medium mb-3">Registro Único Tributario</h4>
              <DownloadButton
                client={singleClient}
                documentType="rut"
                documentName="rut"
                icon={FaDownload}
                color="green"
                label="RUT"
              />
            </div>
            
            {/* Anexos */}
            <div className="border rounded-lg p-4 text-center bg-amber-50">
              <FaFileAlt className="mx-auto text-3xl text-amber-500 mb-3" />
              <h4 className="font-medium mb-3">Documentos Adicionales</h4>
              <DownloadButton
                client={singleClient}
                documentType="anexos"
                documentName="anexos"
                icon={FaDownload}
                color="amber"
                label="Anexos"
              />
            </div>
          </div>
        </div>

        {/* Botón de actualizar */}
        <div className="mt-6 text-center">
          <button
            onClick={reloadData}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-2 mx-auto"
          >
            <FaSync />
            Actualizar Información
          </button>
        </div>
      </div>
    );
  }

  // **RENDERIZADO PARA ADMIN** (tabla simplificada por espacio)
  return (
    <div className="client-list-container p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Lista de Clientes {isAdmin && '(Vista Administrador)'}
        </h1>
        <button
          onClick={reloadData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <FaSync />
          Actualizar
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-600">
          {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''} encontrado{filteredClients.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabla optimizada */}
      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button className="flex items-center space-x-1" onClick={() => requestSort('nombre')}>
                  <span>Nombre</span>
                  {sortConfig.key === 'nombre' && (
                    sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Empresa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                NIT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documentos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map((client) => {
              const availability = getDocumentAvailability(client);
              const availableCount = Object.values(availability).filter(Boolean).length;
              
              return (
                <tr key={client.client_id || client.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {client.nombre || client.user_name || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {client.email || 'Sin email'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.razonSocial || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.nit_number 
                      ? `${client.nit_number}-${client.verification_digit}` 
                      : 'N/A'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        availableCount === 3 ? 'bg-green-100 text-green-800' :
                        availableCount > 0 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {availableCount}/3 documentos
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => toggleRowExpansion(client.client_id || client.user_id)}
                      className="text-sky-600 hover:bg-sky-100 p-2 rounded-md transition-colors flex items-center"
                    >
                      <FaEye className="mr-1" /> 
                      {expandedRows[client.client_id || client.user_id] ? "Ocultar" : "Ver detalles"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación simplificada */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default ClientList;