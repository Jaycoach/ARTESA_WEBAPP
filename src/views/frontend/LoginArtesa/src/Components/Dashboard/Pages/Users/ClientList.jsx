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
  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'ascending' });
  const [downloadingDocs, setDownloadingDocs] = useState({});

  // **CORRECCIÓN CRÍTICA**: Validación de rol corregida
  const isAdmin = user && (user.role === 1);

  // **FUNCIÓN CORREGIDA**: Descarga usando URLs directas de la API
  const downloadDocument = useCallback(async (client, documentType, documentName) => {
    const downloadKey = `${client.user_id}-${documentType}`;
    
    try {
      setDownloadingDocs(prev => ({ ...prev, [downloadKey]: true }));

      console.log(`📥 Iniciando descarga: ${documentType} para cliente ${client.nombre}`);

      let downloadUrl = null;
      
      // **USAR URLs DIRECTAS DE LA API**
      switch (documentType) {
        case 'cedula':
          downloadUrl = client.fotocopiaCedulaUrl || client.fotocopiaCedula;
          break;
        case 'rut':
          downloadUrl = client.fotocopiaRutUrl || client.fotocopiaRut;
          break;
        case 'anexos':
          downloadUrl = client.anexosAdicionales;
          break;
        default:
          throw new Error(`Tipo de documento no válido: ${documentType}`);
      }

      if (!downloadUrl) {
        throw new Error(`No se encontró URL para el documento ${documentType}`);
      }

      console.log('📄 URL de descarga:', downloadUrl);

      // **MÉTODO 1**: Si es URL de API (endpoint), usar con headers de autenticación
      if (downloadUrl.includes('/api/client-profiles')) {
        console.log('🔗 Descargando a través de API con autenticación');
        
        const response = await API.get(downloadUrl.replace(envInfo.apiBaseUrl || '', ''), {
          responseType: 'blob'
        });

        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${documentName}_${client.nombre.replace(/\s+/g, '_')}.pdf`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(url);
        
      } else {
        // **MÉTODO 2**: Si es URL directa de S3, abrir en nueva pestaña
        console.log('🔗 Descargando desde URL directa de S3');
        
        window.open(downloadUrl, '_blank');
      }

    } catch (err) {
      console.error('❌ Error al descargar documento:', err);
      
      if (err.message.includes('No se encontró URL')) {
        alert(`El documento ${documentType} no está disponible para este cliente`);
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
  }, [envInfo.apiBaseUrl]);

  // **FUNCIÓN CORREGIDA**: Obtener datos del perfil del usuario
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('👤 Usuario actual:', user);
      console.log('🔑 Es admin?:', isAdmin);

      if (isAdmin) {
        // **ENDPOINT PARA ADMIN**: Obtener todos los perfiles
        console.log('📊 Obteniendo lista completa de clientes (Admin)');
        const response = await API.get('/client-profiles');
        console.log('📋 Respuesta admin:', response.data);
        
        const clientProfiles = response.data.data || response.data || [];
        setClients(Array.isArray(clientProfiles) ? clientProfiles : [clientProfiles]);
        
      } else if (user?.id) {
        // **ENDPOINT PARA USUARIO**: Obtener su perfil específico
        console.log(`👤 Obteniendo perfil del usuario ${user.id}`);
        
        try {
          const response = await API.get(`/client-profiles/user/${user.id}`);
          console.log('📄 Respuesta perfil usuario:', response.data);
          
          const clientProfile = response.data.data || response.data;
          setSingleClient(clientProfile);
          
        } catch (profileError) {
          console.log('⚠️ No se encontró perfil específico, usando datos del usuario');
          
          // Fallback: usar datos directos del usuario si no tiene perfil de cliente
          setSingleClient({
            client_id: null,
            user_id: user.id,
            nombre: user.name,
            email: user.mail || user.email,
            telefono: null,
            direccion: null,
            ciudad: null,
            pais: null,
            nit_number: null,
            verification_digit: null,
            razonSocial: null,
            fotocopiaCedulaUrl: null,
            fotocopiaRutUrl: null,
            anexosAdicionales: null
          });
        }
      }
    } catch (err) {
      console.error('❌ Error al obtener datos:', err);
      setError('No se pudo cargar la información de clientes');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // **COMPONENTE MEJORADO**: Botón de descarga
  const DownloadButton = ({ client, documentType, documentName, icon: Icon, color, label }) => {
    const downloadKey = `${client.user_id}-${documentType}`;
    const isDownloading = downloadingDocs[downloadKey];
    
    // **VERIFICAR DISPONIBILIDAD SEGÚN CAMPOS REALES DE LA API**
    let documentAvailable = false;
    switch (documentType) {
      case 'cedula':
        documentAvailable = !!(client.fotocopiaCedulaUrl || client.fotocopiaCedula);
        break;
      case 'rut':
        documentAvailable = !!(client.fotocopiaRutUrl || client.fotocopiaRut);
        break;
      case 'anexos':
        documentAvailable = !!client.anexosAdicionales;
        break;
    }

    return (
      <button
        onClick={() => downloadDocument(client, documentType, documentName)}
        disabled={!documentAvailable || isDownloading}
        className={`px-4 py-2 rounded-lg flex items-center justify-center w-full transition-colors ${
          !documentAvailable || isDownloading
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
            {documentAvailable ? 'Descargar' : 'No disponible'}
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

  // **CORRECCIÓN**: Filtrado usando campos reales de la API
  const filteredClients = isAdmin ? clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (client.nombre || '').toLowerCase().includes(searchLower) ||
      (client.email || '').toLowerCase().includes(searchLower) ||
      (client.nit_number || '').toLowerCase().includes(searchLower) ||
      (client.razonSocial || '').toLowerCase().includes(searchLower)
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

  // **RENDERIZADO PARA USUARIO NO ADMIN (CORREGIDO CON CAMPOS REALES)**
  if (!isAdmin && singleClient) {
    console.log('👤 Renderizando perfil para usuario:', singleClient);

    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--primary-color)' }}>
          Mi perfil de cliente
        </h2>
        
        {/* Información del entorno en desarrollo */}
        {envInfo.isDevelopment && (
          <div className="mb-4 p-2 bg-blue-100 border border-blue-300 rounded text-xs">
            🚀 Entorno: {envInfo.mode?.toUpperCase()} | API: {envInfo.apiUrl}
            <br />
            🆔 Client ID: {singleClient.client_id} | User ID: {singleClient.user_id}
          </div>
        )}
        
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <FaUser className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Nombre:</span>
            <span>{singleClient.nombre || user.name || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaBuilding className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Razón Social:</span>
            <span>{singleClient.razonSocial || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaIdCard className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">NIT:</span>
            <span>
              {singleClient.nit_number 
                ? `${singleClient.nit_number}-${singleClient.verification_digit}` 
                : singleClient.nit || 'N/A'
              }
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaFileAlt className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Email:</span>
            <span>{singleClient.email || user.mail || user.email || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaPhone className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Teléfono:</span>
            <span>{singleClient.telefono || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaUniversity className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Dirección:</span>
            <span>
              {singleClient.direccion 
                ? `${singleClient.direccion}, ${singleClient.ciudad || ''}, ${singleClient.pais || ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '')
                : 'N/A'
              }
            </span>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--primary-color)' }}>
            Documentos
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cédula */}
            <div className="border rounded-lg p-4 text-center">
              <FaIdCard className="mx-auto text-2xl text-blue-500 mb-2" />
              <h4 className="font-medium mb-2">Cédula</h4>
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
            <div className="border rounded-lg p-4 text-center">
              <FaFileInvoice className="mx-auto text-2xl text-green-500 mb-2" />
              <h4 className="font-medium mb-2">RUT</h4>
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
            <div className="border rounded-lg p-4 text-center">
              <FaFileAlt className="mx-auto text-2xl text-amber-500 mb-2" />
              <h4 className="font-medium mb-2">Anexos</h4>
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
      </div>
    );
  }

  // **RENDERIZADO PARA ADMIN (CORREGIDO CON CAMPOS REALES)**
  return (
    <div className="client-list-container p-6">
      {/* Header con información del entorno */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Lista de Clientes {isAdmin && '(Vista Administrador)'}
        </h1>
        {envInfo.isDevelopment && (
          <div className="text-xs bg-blue-100 px-2 py-1 rounded">
            🚀 {envInfo.mode?.toUpperCase()} | {envInfo.apiUrl}
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
            placeholder="Buscar por nombre, email, NIT..."
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
                <button className="flex items-center space-x-1" onClick={() => requestSort('nombre')}>
                  <span>Nombre</span>
                  {sortConfig.key === 'nombre' && (
                    sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                  )}
                </button>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button className="flex items-center space-x-1" onClick={() => requestSort('razonSocial')}>
                  <span>Razón Social</span>
                  {sortConfig.key === 'razonSocial' && (
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
                <button className="flex items-center space-x-1" onClick={() => requestSort('email')}>
                  <span>Email</span>
                  {sortConfig.key === 'email' && (
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
              <React.Fragment key={client.client_id || client.user_id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {client.nombre || client.user_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.razonSocial || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.nit_number 
                      ? `${client.nit_number}-${client.verification_digit}` 
                      : client.nit || 'N/A'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.email || 'N/A'}
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
                
                {/* Fila expandida con información detallada */}
                {expandedRows[client.client_id || client.user_id] && (
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
                              <li><span className="font-medium">Nombre:</span> {client.nombre || client.user_name || 'N/A'}</li>
                              <li><span className="font-medium">Email:</span> {client.email || 'N/A'}</li>
                              <li><span className="font-medium">Teléfono:</span> {client.telefono || 'N/A'}</li>
                              <li><span className="font-medium">Dirección:</span> {client.direccion || 'N/A'}</li>
                              <li><span className="font-medium">Ciudad:</span> {client.ciudad || 'N/A'}</li>
                              <li><span className="font-medium">País:</span> {client.pais || 'N/A'}</li>
                            </ul>
                          </div>

                          {/* Información Empresarial */}
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-4">
                              <FaBuilding className="text-amber-500" />
                              <h3 className="text-lg font-medium text-gray-700">Información Empresarial</h3>
                            </div>
                            <ul className="space-y-2 text-sm">
                              <li><span className="font-medium">Razón Social:</span> {client.razonSocial || 'N/A'}</li>
                              <li><span className="font-medium">NIT:</span> {client.nit_number ? `${client.nit_number}-${client.verification_digit}` : client.nit || 'N/A'}</li>
                              <li><span className="font-medium">Código SAP:</span> {client.cardcode_sap || 'No asignado'}</li>
                              <li><span className="font-medium">Lista de Precios:</span> {client.price_list || 'No asignada'}</li>
                            </ul>
                          </div>

                          {/* Información Adicional */}
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-4">
                              <FaFileAlt className="text-green-500" />
                              <h3 className="text-lg font-medium text-gray-700">Información Adicional</h3>
                            </div>
                            <ul className="space-y-2 text-sm">
                              {client.extraInfo && (
                                <>
                                  <li><span className="font-medium">Tipo Documento:</span> {client.extraInfo.tipoDocumento || 'N/A'}</li>
                                  <li><span className="font-medium">Número Documento:</span> {client.extraInfo.numeroDocumento || 'N/A'}</li>
                                  <li><span className="font-medium">Tamaño Empresa:</span> {client.extraInfo.tamanoEmpresa || 'N/A'}</li>
                                  <li><span className="font-medium">Tipo Cuenta:</span> {client.extraInfo.tipoCuenta || 'N/A'}</li>
                                </>
                              )}
                              <li><span className="font-medium">Creado:</span> {new Date(client.created_at).toLocaleDateString() || 'N/A'}</li>
                              <li><span className="font-medium">Actualizado:</span> {new Date(client.updated_at).toLocaleDateString() || 'N/A'}</li>
                            </ul>
                          </div>

                          {/* Contactos */}
                          {client.contacts && client.contacts.length > 0 && (
                            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                              <div className="flex items-center space-x-2 mb-4">
                                <FaPhone className="text-purple-500" />
                                <h3 className="text-lg font-medium text-gray-700">Contactos</h3>
                              </div>
                              <ul className="space-y-2 text-sm">
                                {client.contacts.map((contact, index) => (
                                  <li key={index} className="border-b border-gray-100 pb-2">
                                    <span className="font-medium">{contact.name}</span>
                                    {contact.is_primary && <span className="text-blue-500 text-xs ml-1">(Principal)</span>}
                                    <br />
                                    <span className="text-gray-600">{contact.position}</span>
                                    <br />
                                    <span className="text-gray-600">{contact.phone} | {contact.email}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Documentos */}
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200 md:col-span-3">
                            <div className="flex items-center space-x-2 mb-4">
                              <FaFileAlt className="text-red-500" />
                              <h3 className="text-lg font-medium text-gray-700">Documentos</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Cédula */}
                              <div className="border rounded-lg p-4 text-center">
                                <FaIdCard className="mx-auto text-2xl text-blue-500 mb-2" />
                                <h4 className="font-medium mb-2">Fotocopia Cédula</h4>
                                <DownloadButton
                                  client={client}
                                  documentType="cedula"
                                  documentName="cedula"
                                  icon={FaDownload}
                                  color="blue"
                                  label="Cédula"
                                />
                              </div>
                              
                              {/* RUT */}
                              <div className="border rounded-lg p-4 text-center">
                                <FaFileInvoice className="mx-auto text-2xl text-green-500 mb-2" />
                                <h4 className="font-medium mb-2">Fotocopia RUT</h4>
                                <DownloadButton
                                  client={client}
                                  documentType="rut"
                                  documentName="rut"
                                  icon={FaDownload}
                                  color="green"
                                  label="RUT"
                                />
                              </div>
                              
                              {/* Anexos adicionales */}
                              <div className="border rounded-lg p-4 text-center">
                                <FaFileAlt className="mx-auto text-2xl text-amber-500 mb-2" />
                                <h4 className="font-medium mb-2">Anexos Adicionales</h4>
                                <DownloadButton
                                  client={client}
                                  documentType="anexos"
                                  documentName="anexos"
                                  icon={FaDownload}
                                  color="amber"
                                  label="Anexos"
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
                  {searchTerm 
                    ? 'No se encontraron clientes que coincidan con la búsqueda'
                    : 'No hay clientes registrados'
                  }
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
              className={`px-3 py-1 rounded transition-colors ${
                currentPage === 1 
                  ? 'bg-gray-200 cursor-not-allowed' 
                  : 'bg-slate-600 text-white hover:bg-slate-700'
              }`}
            >
              Anterior
            </button>
            
            {[...Array(totalPages)].map((_, i) => {
              if (
                i === 0 || 
                i === totalPages - 1 || 
                (i >= currentPage - 2 && i <= currentPage + 2)
              ) {
                return (
                  <button
                    key={i}
                    onClick={() => paginate(i + 1)}
                    className={`px-3 py-1 rounded transition-colors ${
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
              className={`px-3 py-1 rounded transition-colors ${
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