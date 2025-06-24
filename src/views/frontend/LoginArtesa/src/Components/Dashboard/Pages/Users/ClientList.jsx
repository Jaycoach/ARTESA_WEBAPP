import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaEye, FaDownload, FaIdCard, FaFileInvoice, FaFileAlt, FaSearch, 
  FaChevronDown, FaChevronUp, FaUser, FaBuilding, FaPiggyBank, 
  FaUniversity, FaPhone, FaSpinner, FaExclamationTriangle 
} from 'react-icons/fa';
import API from '../../../../api/config';
import { useAuth } from '../../../../hooks/useAuth';
import { getEnvironmentInfo } from '../../../../utils/environment';

const ClientList = () => {
  const { user } = useAuth();
  const envInfo = getEnvironmentInfo();

  // Estados para manejar los datos
  const [clients, setClients] = useState([]);
  const [singleClient, setSingleClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'contact_name', direction: 'ascending' });
  const [downloadingDocs, setDownloadingDocs] = useState({});

  // **CORRECCIÓN CRÍTICA**: Validación de rol corregida
  const isAdmin = user && (user.role === 1);

  // **FUNCIÓN CORREGIDA**: Descarga usando endpoint correcto
  const downloadDocument = useCallback(async (userId, documentType, documentName) => {
    const downloadKey = `${userId}-${documentType}`;
    
    try {
      setDownloadingDocs(prev => ({ ...prev, [downloadKey]: true }));

      // Mapeo de tipos de documento
      const fileTypeMap = {
        'fotocopiaCedula': 'cedula',
        'fotocopiaRut': 'rut', 
        'anexosAdicionales': 'anexos'
      };

      const fileType = fileTypeMap[documentType] || documentType;

      // **USAR ENDPOINT CORRECTO**: /api/client-profiles/user/{userId}/file/{fileType}
      const response = await API.get(
        `/client-profiles/user/${userId}/file/${fileType}`,
        {
          responseType: 'blob',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        }
      );

      // Procesar la descarga
      const contentType = response.headers['content-type'] || 'application/pdf';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      
      // Determinar extensión
      const fileExtension = contentType.includes('pdf') ? 'pdf' : 
                           contentType.includes('image') ? 'jpg' : 'file';
      
      // Crear enlace de descarga
      const link = document.createElement('a');
      link.href = url;
      link.download = `${documentName}_${userId}.${fileExtension}`;
      
      // Ejecutar descarga
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error al descargar documento:', err);
      
      // Manejo específico de errores
      if (err.response?.status === 404) {
        alert('El documento no existe o no está disponible');
      } else if (err.response?.status === 403) {
        alert('No tienes permisos para descargar este documento');
      } else {
        alert('Error al descargar el documento. Inténtalo nuevamente.');
      }
    } finally {
      setDownloadingDocs(prev => {
        const newState = { ...prev };
        delete newState[downloadKey];
        return newState;
      });
    }
  }, []);

  // **FUNCIÓN CORREGIDA**: Obtener datos usando endpoints correctos
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isAdmin) {
        // **ENDPOINT CORRECTO PARA ADMIN**: /api/client-profiles
        const response = await API.get('/client-profiles');
        const clientProfiles = response.data.data || response.data || [];
        setClients(clientProfiles);
      } else if (user?.id) {
        // **ENDPOINT CORRECTO PARA USUARIO**: /api/client-profiles/user/{userId}
        const response = await API.get(`/client-profiles/user/${user.id}`);
        const clientProfile = response.data.data || response.data;
        setSingleClient(clientProfile);
      }
    } catch (err) {
      console.error('Error al obtener datos:', err);
      setError('No se pudo cargar la información de clientes');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // **COMPONENTE MEJORADO**: Botón de descarga con estados
  const DownloadButton = ({ userId, documentType, documentName, icon: Icon, color, label, disabled }) => {
    const downloadKey = `${userId}-${documentType}`;
    const isDownloading = downloadingDocs[downloadKey];

    return (
      <button
        onClick={() => downloadDocument(userId, documentType, documentName)}
        disabled={disabled || isDownloading}
        className={`px-4 py-2 rounded-lg flex items-center justify-center w-full transition-colors ${
          disabled || isDownloading
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : `bg-${color}-600 text-white hover:bg-${color}-700`
        }`}
      >
        {isDownloading ? (
          <>
            <FaSpinner className="mr-2 animate-spin" />
            Descargando...
          </>
        ) : (
          <>
            <Icon className="mr-2" />
            {disabled ? 'No disponible' : 'Descargar'}
          </>
        )}
      </button>
    );
  };

  // Función para manejar la expansión de filas
  const toggleRowExpansion = useCallback((clientId) => {
    setExpandedRows(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  }, []);

  // **CORRECCIÓN**: Filtrado usando campos correctos de la API
  const filteredClients = isAdmin ? clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (client.contact_name || client.company_name || '').toLowerCase().includes(searchLower) ||
      (client.contact_email || '').toLowerCase().includes(searchLower) ||
      (client.nit_number || '').toLowerCase().includes(searchLower)
    );
  }) : [];

  // Ordenamiento optimizado
  const sortedClients = isAdmin ? [...filteredClients].sort((a, b) => {
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    
    if (aValue < bValue) {
      return sortConfig.direction === 'ascending' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'ascending' ? 1 : -1;
    }
    return 0;
  }) : [];

  // Cálculos de paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);

  // Cambiar página
  const paginate = useCallback((pageNumber) => setCurrentPage(pageNumber), []);

  // Ordenar por columna
  const requestSort = useCallback((key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  // Estados de carga y error
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
        <div className="flex items-center">
          <FaExclamationTriangle className="mr-2" />
          <span>{error}</span>
        </div>
        <button 
          onClick={fetchData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // --- Renderizado para NO ADMIN (perfil individual) ---
  if (!isAdmin && singleClient) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--primary-color)' }}>
          Mi perfil de cliente
        </h2>
        
        {/* Información del entorno en staging */}
        {envInfo.isStaging && (
          <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
            🚀 Entorno: {envInfo.mode.toUpperCase()} | API: {envInfo.apiUrl}
          </div>
        )}
        
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FaUser className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Nombre:</span>
            <span>{singleClient.contact_name || singleClient.company_name || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <FaIdCard className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">NIT:</span>
            <span>{singleClient.nit_number ? `${singleClient.nit_number}-${singleClient.verification_digit || ''}` : 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <FaFileAlt className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Email:</span>
            <span>{singleClient.contact_email || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <FaPhone className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Teléfono:</span>
            <span>{singleClient.contact_phone || 'N/A'}</span>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-color)' }}>
            Documentos
          </h3>
          <div className="flex flex-wrap gap-4">
            <DownloadButton
              userId={singleClient.user_id}
              documentType="fotocopiaCedula"
              documentName="cedula"
              icon={FaDownload}
              color="blue"
              label="Cédula"
              disabled={!singleClient.fotocopia_cedula}
            />
            
            <DownloadButton
              userId={singleClient.user_id}
              documentType="fotocopiaRut"
              documentName="rut"
              icon={FaDownload}
              color="green"
              label="RUT"
              disabled={!singleClient.fotocopia_rut}
            />
            
            <DownloadButton
              userId={singleClient.user_id}
              documentType="anexosAdicionales"
              documentName="anexos"
              icon={FaDownload}
              color="amber"
              label="Anexos"
              disabled={!singleClient.anexos_adicionales}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Renderizado para ADMIN (lista completa) ---
  return (
    <div className="client-list-container p-6">
      {/* Header con información del entorno */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Lista de Clientes {isAdmin && '(Vista Administrador)'}
        </h1>
        {envInfo.isStaging && (
          <div className="text-xs bg-yellow-100 px-2 py-1 rounded">
            🚀 {envInfo.mode.toUpperCase()} | {envInfo.apiUrl}
          </div>
        )}
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
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

      {/* Tabla de clientes */}
      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-100">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button className="flex items-center space-x-1" onClick={() => requestSort('contact_name')}>
                  <span>Nombre</span>
                  {sortConfig.key === 'contact_name' && (
                    sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                  )}
                </button>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button className="flex items-center space-x-1" onClick={() => requestSort('nit_number')}>
                  <span>NIT</span>
                  {sortConfig.key === 'nit_number' && (
                    sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                  )}
                </button>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button className="flex items-center space-x-1" onClick={() => requestSort('contact_email')}>
                  <span>Email</span>
                  {sortConfig.key === 'contact_email' && (
                    sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                  )}
                </button>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button className="flex items-center space-x-1" onClick={() => requestSort('contact_phone')}>
                  <span>Teléfono</span>
                  {sortConfig.key === 'contact_phone' && (
                    sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                  )}
                </button>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span>Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map((client) => (
              <React.Fragment key={client.client_id || client.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {client.contact_name || client.company_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.nit_number ? `${client.nit_number}-${client.verification_digit || ''}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.contact_email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.contact_phone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => toggleRowExpansion(client.client_id || client.id)}
                      className="text-sky-600 hover:bg-sky-100 p-2 rounded-md mr-2"
                    >
                      <FaEye /> {expandedRows[client.client_id || client.id] ? 'Ocultar' : 'Ver detalles'}
                    </button>
                  </td>
                </tr>
                
                {/* Fila expandida con información detallada */}
                {expandedRows[client.client_id || client.id] && (
                  <tr>
                    <td colSpan="5" className="border-b bg-slate-50 p-0">
                      <div className="p-6 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          
                          {/* Información Personal */}
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-4">
                              <FaUser className="text-blue-500" />
                              <h3 className="text-lg font-medium text-gray-700">Información Personal</h3>
                            </div>
                            <ul className="space-y-2 text-sm">
                              <li><span className="font-medium">Nombre:</span> {client.contact_name || 'N/A'}</li>
                              <li><span className="font-medium">Empresa:</span> {client.company_name || 'N/A'}</li>
                              <li><span className="font-medium">NIT:</span> {client.nit_number ? `${client.nit_number}-${client.verification_digit || ''}` : 'N/A'}</li>
                              <li><span className="font-medium">Dirección:</span> {client.address || 'N/A'}</li>
                              <li><span className="font-medium">Teléfono:</span> {client.contact_phone || 'N/A'}</li>
                              <li><span className="font-medium">Email:</span> {client.contact_email || 'N/A'}</li>
                            </ul>
                          </div>

                          {/* Información SAP */}
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-4">
                              <FaBuilding className="text-amber-500" />
                              <h3 className="text-lg font-medium text-gray-700">Información SAP</h3>
                            </div>
                            <ul className="space-y-2 text-sm">
                              <li><span className="font-medium">Código SAP:</span> {client.cardcode_sap || 'No asignado'}</li>
                              <li><span className="font-medium">Sincronizado:</span> {client.sap_lead_synced ? 'Sí' : 'No'}</li>
                              <li><span className="font-medium">Estado:</span> {client.is_active ? 'Activo' : 'Inactivo'}</li>
                            </ul>
                          </div>

                          {/* Información de Contactos */}
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-4">
                              <FaPhone className="text-green-500" />
                              <h3 className="text-lg font-medium text-gray-700">Contactos</h3>
                            </div>
                            {client.contacts && client.contacts.length > 0 ? (
                              <ul className="space-y-2 text-sm">
                                {client.contacts.map((contact, index) => (
                                  <li key={index}>
                                    <span className="font-medium">{contact.name}</span>
                                    {contact.is_primary && <span className="text-blue-500 text-xs ml-1">(Principal)</span>}
                                    <br />
                                    <span className="text-gray-600">{contact.position}</span>
                                    <br />
                                    <span className="text-gray-600">{contact.phone} | {contact.email}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-500 text-sm">No hay contactos registrados</p>
                            )}
                          </div>

                          {/* Documentos */}
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200 md:col-span-3">
                            <div className="flex items-center space-x-2 mb-4">
                              <FaFileAlt className="text-red-500" />
                              <h3 className="text-lg font-medium text-gray-700">Documentos</h3>
                              {envInfo.isStaging && (
                                <span className="text-xs text-gray-400">
                                  (S3: {envInfo.s3?.bucketName || 'artesa-frontend-staging'})
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Cédula */}
                              <div className="border rounded-lg p-4 text-center">
                                <FaIdCard className="mx-auto text-2xl text-blue-500 mb-2" />
                                <h4 className="font-medium mb-2">Fotocopia Cédula</h4>
                                <DownloadButton
                                  userId={client.user_id}
                                  documentType="fotocopiaCedula"
                                  documentName="cedula"
                                  icon={FaDownload}
                                  color="blue"
                                  label="Cédula"
                                  disabled={!client.fotocopia_cedula}
                                />
                              </div>
                              
                              {/* RUT */}
                              <div className="border rounded-lg p-4 text-center">
                                <FaFileInvoice className="mx-auto text-2xl text-green-500 mb-2" />
                                <h4 className="font-medium mb-2">Fotocopia RUT</h4>
                                <DownloadButton
                                  userId={client.user_id}
                                  documentType="fotocopiaRut"
                                  documentName="rut"
                                  icon={FaDownload}
                                  color="green"
                                  label="RUT"
                                  disabled={!client.fotocopia_rut}
                                />
                              </div>
                              
                              {/* Anexos adicionales */}
                              <div className="border rounded-lg p-4 text-center">
                                <FaFileAlt className="mx-auto text-2xl text-amber-500 mb-2" />
                                <h4 className="font-medium mb-2">Anexos Adicionales</h4>
                                <DownloadButton
                                  userId={client.user_id}
                                  documentType="anexosAdicionales"
                                  documentName="anexos"
                                  icon={FaDownload}
                                  color="amber"
                                  label="Anexos"
                                  disabled={!client.anexos_adicionales}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            
            {currentItems.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                  No se encontraron clientes que coincidan con la búsqueda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-500">
            Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, sortedClients.length)} de {sortedClients.length} clientes
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => paginate(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded ${
                currentPage === 1 
                  ? 'bg-gray-200 cursor-not-allowed' 
                  : 'bg-slate-600 text-white hover:bg-slate-700'
              }`}
            >
              Anterior
            </button>
            
            {[...Array(totalPages)].map((_, i) => {
              // Solo mostrar páginas cercanas a la actual para evitar una lista muy larga
              if (
                i === 0 || 
                i === totalPages - 1 || 
                (i >= currentPage - 2 && i <= currentPage + 2)
              ) {
                return (
                  <button
                    key={i}
                    onClick={() => paginate(i + 1)}
                    className={`px-3 py-1 rounded ${
                      currentPage === i + 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border hover:bg-gray-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              } else if (i === currentPage - 3 || i === currentPage + 3) {
                return <span key={i} className="px-2">...</span>;
              }
              return null;
            })}
            
            <button
              onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded ${
                currentPage === totalPages 
                  ? 'bg-gray-200 cursor-not-allowed' 
                  : 'bg-slate-600 text-white hover:bg-slate-700'
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;