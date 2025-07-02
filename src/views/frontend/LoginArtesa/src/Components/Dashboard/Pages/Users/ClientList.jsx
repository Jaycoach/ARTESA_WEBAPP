import React, { useState, useEffect, useCallback } from 'react';
import {
  FaEye, FaDownload, FaIdCard, FaFileInvoice, FaFileAlt, FaSearch,
  FaChevronDown, FaChevronUp, FaUser, FaBuilding, FaPiggyBank,
  FaUniversity, FaPhone, FaSpinner, FaExclamationTriangle, FaSync
} from 'react-icons/fa';
import API from '../../../../api/config';
import { useAuth } from '../../../../hooks/useAuth';
import { getEnvironmentInfo } from '../../../../utils/environment';


console.log('🔧 Debug configuración API:', {
  baseURL: API.defaults.baseURL,
  mode: import.meta.env.MODE,
  apiUrl: import.meta.env.VITE_API_URL,
  fullUploadUrl: `${API.defaults.baseURL}/upload`
});
// **SERVICIO DE DESCARGA CON NUEVO ENDPOINT**
class DocumentDownloadService {
  constructor() {
    this.apiClient = API;
  }

  async downloadDocument(client, documentType, documentName) {
    console.log(`📥 Descargando ${documentType} para usuario ${client.user_id}`);

    try {
      // **USAR NUEVO ENDPOINT DIRECTO**
      const downloadUrl = `/client-profiles/user/${client.user_id}/download/${documentType}`;
      console.log(`🔗 Endpoint: ${downloadUrl}`);

      const response = await this.apiClient.get(downloadUrl, {
        responseType: 'blob',
        timeout: 45000,
        headers: {
          'Accept': 'application/pdf, image/*, application/octet-stream, */*',
          'Cache-Control': 'no-cache'
        }
      });

      console.log('📊 Respuesta:', {
        status: response.status,
        contentType: response.headers['content-type'],
        size: response.data.size
      });

      // **VALIDAR RESPUESTA**
      if (!(response.data instanceof Blob) || response.data.size === 0) {
        throw new Error('Archivo vacío o inválido');
      }

      // **VERIFICAR QUE NO SEA HTML DE ERROR**
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        throw new Error('El servidor devolvió HTML (posible error de autenticación)');
      }

      // **DETECTAR EXTENSIÓN**
      let extension = '.pdf';
      if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
        extension = '.jpg';
      } else if (contentType.includes('image/png')) {
        extension = '.png';
      } else if (contentType.includes('application/pdf')) {
        extension = '.pdf';
      }

      // **CREAR DESCARGA**
      const clientName = client.nombre || client.user_name || `usuario_${client.user_id}`;
      const fileName = `${documentName}_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}${extension}`;

      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');

      link.href = url;
      link.download = fileName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 2000);

      console.log(`✅ Descarga completada: ${fileName}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error en descarga:', error);
      throw error;
    }
  }
}

const ClientList = () => {
  const { user } = useAuth();
  const envInfo = getEnvironmentInfo();

  // **INSTANCIA DEL SERVICIO**
  const downloadService = new DocumentDownloadService();

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

  // **FUNCIÓN PRINCIPAL**: Descarga usando el nuevo endpoint
  const downloadDocument = useCallback(async (clientData, documentType, documentName) => {
    const downloadKey = `${clientData.user_id}-${documentType}`;

    try {
      setDownloadingDocs(prev => ({ ...prev, [downloadKey]: true }));

      console.log(`📥 Iniciando descarga: ${documentType} para ${clientData.nombre || clientData.user_id}`);

      // **USAR EL NUEVO SERVICIO CON ENDPOINT**
      await downloadService.downloadDocument(clientData, documentType, documentName);

      console.log(`✅ Descarga completada: ${documentType}`);

    } catch (error) {
      console.error(`❌ Error descargando ${documentType}:`, error);

      // **MENSAJES DE ERROR ESPECÍFICOS**
      let errorMessage = 'Error al descargar el documento';

      if (error.response?.status === 404) {
        errorMessage = `El documento ${documentType} no existe para este cliente`;
      } else if (error.response?.status === 403) {
        errorMessage = 'No tienes permisos para descargar este documento';
      } else if (error.response?.status === 401) {
        errorMessage = 'Tu sesión ha expirado. Inicia sesión nuevamente';
      } else if (error.message.includes('HTML')) {
        errorMessage = 'Error de autenticación. Verifica tu sesión';
      } else if (error.message.includes('vacío')) {
        errorMessage = 'El archivo está vacío o dañado. Contacta al administrador';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'La descarga tardó demasiado tiempo. Intenta nuevamente';
      }

      alert(errorMessage);

    } finally {
      setDownloadingDocs(prev => {
        const newState = { ...prev };
        delete newState[downloadKey];
        return newState;
      });
    }
  }, [downloadService]);

  // **FUNCIÓN CORREGIDA**: Obtener datos
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log('👤 Usuario actual:', user);
      console.log('🔑 Es admin?:', isAdmin);

      if (isAdmin) {
        console.log('📊 Obteniendo lista completa de clientes (Admin)');
        const response = await API.get('/client-profiles');
        console.log('📋 Respuesta admin completa:', response.data);

        const clientProfiles = response.data.data || response.data || [];
        const profilesArray = Array.isArray(clientProfiles) ? clientProfiles : [clientProfiles];

        console.log('👥 Clientes procesados:', profilesArray.length);
        setClients(profilesArray);

      } else if (user?.id) {
        console.log(`👤 Obteniendo perfil del usuario ${user.id}`);

        try {
          const response = await API.get(`/client-profiles/user/${user.id}`);
          console.log('📄 Respuesta perfil usuario completa:', response.data);

          const clientProfile = response.data.data || response.data;
          setSingleClient(clientProfile);

        } catch (profileError) {
          console.log('⚠️ No se encontró perfil específico, creando perfil básico');

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
            fotocopiaCedula: null,
            fotocopiaCedulaUrl: null,
            fotocopiaRut: null,
            fotocopiaRutUrl: null,
            anexosAdicionales: null
          });
        }
      }
    } catch (err) {
      console.error('❌ Error al obtener datos:', err);
      setError(`Error al cargar información: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // **COMPONENTE CORREGIDO**: Botón de descarga
  const DownloadButton = ({ clientData, documentType, documentName, icon: Icon, color, label }) => {
    const downloadKey = `${clientData.user_id}-${documentType}`;
    const isDownloading = downloadingDocs[downloadKey];

    // **VERIFICAR DISPONIBILIDAD SEGÚN CAMPOS REALES**
    let documentAvailable = false;

    switch (documentType) {
      case 'cedula':
        documentAvailable = !!(clientData.fotocopiaCedulaUrl || clientData.fotocopiaCedula);
        break;
      case 'rut':
        documentAvailable = !!(clientData.fotocopiaRutUrl || clientData.fotocopiaRut);
        break;
      case 'anexos':
        documentAvailable = !!clientData.anexosAdicionales;
        break;
    }

    return (
      <div className="space-y-2">
        <button
          onClick={() => downloadDocument(clientData, documentType, documentName)}
          disabled={!documentAvailable || isDownloading}
          className={`px-4 py-2 rounded-lg flex items-center justify-center w-full transition-colors ${!documentAvailable || isDownloading
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : `bg-${color}-600 text-white hover:bg-${color}-700`
            }`}
          title={!documentAvailable ? `${label} no disponible` : `Descargar ${label}`}
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

        {/* Indicador de nuevo endpoint */}
        {envInfo.isDevelopment && documentAvailable && (
          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            📡 /download/{documentType}
          </div>
        )}
      </div>
    );
  };

  // Función para manejar la expansión de filas
  const toggleRowExpansion = useCallback((clientId) => {
    setExpandedRows(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  }, []);

  // Filtrado y ordenamiento
  const filteredClients = isAdmin ? clients.filter(clientItem => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (clientItem.nombre || '').toLowerCase().includes(searchLower) ||
      (clientItem.email || '').toLowerCase().includes(searchLower) ||
      (clientItem.nit_number || '').toLowerCase().includes(searchLower) ||
      (clientItem.razonSocial || '').toLowerCase().includes(searchLower)
    );
  }) : [];

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

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);

  const paginate = useCallback((pageNumber) => setCurrentPage(pageNumber), []);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FaExclamationTriangle className="mr-2" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
          >
            <FaSync />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // **RENDERIZADO PARA USUARIO NO ADMIN - CON ALINEACIÓN PERFECTA**
  if (!isAdmin && singleClient) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--primary-color)' }}>
          Mi perfil de cliente
        </h2>

        {envInfo.isDevelopment && (
          <div className="mb-4 p-2 bg-blue-100 border border-blue-300 rounded text-xs">
            🚀 Entorno: {envInfo.mode?.toUpperCase()} | API: {envInfo.apiUrl}
            <br />
            🆔 Client ID: {singleClient.client_id} | User ID: {singleClient.user_id}
            <br />
            📡 Endpoint: /client-profiles/user/{singleClient.user_id}/download/{`{tipo}`}
          </div>
        )}

        {/* **ALINEACIÓN PERFECTA CON FLEXBOX** */}
        <div
          className="flex flex-wrap gap-6"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'flex-start'
          }}
        >
          {/* Información Personal */}
          <div
            className="bg-white rounded-lg shadow-sm p-4 border border-slate-200 flex-1 min-w-[300px] max-w-[400px]"
            style={{ alignSelf: 'flex-start', marginTop: '0px' }}
          >
            <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
              <FaUser className="text-blue-500" />
              <h3 className="text-lg font-medium text-gray-700">Información Personal</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <li><span className="font-medium">Nombre:</span> {singleClient.nombre || user.name || 'N/A'}</li>
              <li><span className="font-medium">Email:</span> {singleClient.email || user.mail || user.email || 'N/A'}</li>
              <li><span className="font-medium">Teléfono:</span> {singleClient.telefono || 'N/A'}</li>
              <li><span className="font-medium">Dirección:</span> {singleClient.direccion || 'N/A'}</li>
              <li><span className="font-medium">Ciudad:</span> {singleClient.ciudad || 'N/A'}</li>
              <li><span className="font-medium">País:</span> {singleClient.pais || 'N/A'}</li>
            </ul>
          </div>

          {/* Información Empresarial */}
          <div
            className="bg-white rounded-lg shadow-sm p-4 border border-slate-200 flex-1 min-w-[300px] max-w-[400px]"
            style={{ alignSelf: 'flex-start', marginTop: '0px' }}
          >
            <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
              <FaBuilding className="text-amber-500" />
              <h3 className="text-lg font-medium text-gray-700">Información Empresarial</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <li><span className="font-medium">Razón Social:</span> {singleClient.razonSocial || 'N/A'}</li>
              <li><span className="font-medium">NIT:</span> {
                singleClient.nit_number
                  ? `${singleClient.nit_number}-${singleClient.verification_digit}`
                  : singleClient.nit || 'N/A'
              }</li>
              <li><span className="font-medium">Código SAP:</span> {singleClient.cardcode_sap || 'No asignado'}</li>
              <li><span className="font-medium">Lista de Precios:</span> {singleClient.price_list || 'No asignada'}</li>
            </ul>
          </div>

          {/* Información Adicional */}
          <div
            className="bg-white rounded-lg shadow-sm p-4 border border-slate-200 flex-1 min-w-[300px] max-w-[400px]"
            style={{ alignSelf: 'flex-start', marginTop: '0px' }}
          >
            <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
              <FaFileAlt className="text-green-500" />
              <h3 className="text-lg font-medium text-gray-700">Información Adicional</h3>
            </div>
            <ul className="space-y-2 text-sm">
              {singleClient.extraInfo ? (
                <>
                  <li><span className="font-medium">Tipo Documento:</span> {singleClient.extraInfo.tipoDocumento || 'N/A'}</li>
                  <li><span className="font-medium">Número Documento:</span> {singleClient.extraInfo.numeroDocumento || 'N/A'}</li>
                  <li><span className="font-medium">Tamaño Empresa:</span> {singleClient.extraInfo.tamanoEmpresa || 'N/A'}</li>
                  <li><span className="font-medium">Tipo Cuenta:</span> {singleClient.extraInfo.tipoCuenta || 'N/A'}</li>
                </>
              ) : (
                <>
                  <li><span className="font-medium">Tipo Documento:</span> N/A</li>
                  <li><span className="font-medium">Número Documento:</span> N/A</li>
                  <li><span className="font-medium">Tamaño Empresa:</span> N/A</li>
                  <li><span className="font-medium">Tipo Cuenta:</span> N/A</li>
                </>
              )}
              <li><span className="font-medium">Creado:</span> {singleClient.created_at ? new Date(singleClient.created_at).toLocaleDateString() : 'N/A'}</li>
              <li><span className="font-medium">Actualizado:</span> {singleClient.updated_at ? new Date(singleClient.updated_at).toLocaleDateString() : 'N/A'}</li>
            </ul>
          </div>
        </div>

        {/* Contactos - Calculando exactamente el ancho */}
        {singleClient.contacts && singleClient.contacts.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-end">
              <div
                className="bg-white rounded-lg shadow-sm p-4 border border-slate-200"
                style={{
                  width: 'calc((100% - 3rem) / 3)',
                  minWidth: '300px',
                  maxWidth: '400px'
                }}
              >
                <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
                  <FaPhone className="text-purple-500" />
                  <h3 className="text-lg font-medium text-gray-700">Contactos</h3>
                </div>
                <ul className="space-y-2 text-sm">
                  {singleClient.contacts.map((contact, index) => (
                    <li key={index} className="border-b border-gray-100 pb-2 last:border-b-0">
                      <span className="font-medium">{contact.name}</span>
                      {contact.is_primary && <span className="text-blue-500 text-xs ml-1">(Principal)</span>}
                      <br />
                      <span className="text-gray-600">{contact.position || 'N/A'}</span>
                      <br />
                      <span className="text-gray-600">{contact.phone || 'N/A'} | {contact.email || 'N/A'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Documentos - Sección separada */}
        <div className="mt-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <FaFileAlt className="text-red-500" />
                <h3 className="text-lg font-medium text-gray-700">Documentos</h3>
              </div>
              <button
                onClick={() => fetchData(true)}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
              >
                <FaSync className="text-xs" />
                Actualizar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cédula */}
              <div className="border rounded-lg p-4 text-center">
                <FaIdCard className="mx-auto text-2xl text-blue-500 mb-2" />
                <h4 className="font-medium mb-2">Cédula</h4>
                <DownloadButton
                  clientData={singleClient}
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
                  clientData={singleClient}
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
                  clientData={singleClient}
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
    );
  }

  // **RENDERIZADO PARA ADMIN - CON ALINEACIÓN PERFECTA**
  return (
    <div className="client-list-container p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Lista de Clientes {isAdmin && '(Vista Administrador)'}
        </h1>
        <div className="flex items-center gap-3">
          {envInfo.isDevelopment && (
            <div className="text-xs bg-blue-100 px-2 py-1 rounded">
              🚀 {envInfo.mode?.toUpperCase()} | {envInfo.apiUrl}
            </div>
          )}
          <button
            onClick={() => fetchData(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <FaSync />
            Actualizar
          </button>
        </div>
      </div>

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
            {currentItems.map((clientItem) => (
              <React.Fragment key={clientItem.client_id || clientItem.user_id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {clientItem.nombre || clientItem.user_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {clientItem.razonSocial || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {clientItem.nit_number
                      ? `${clientItem.nit_number}-${clientItem.verification_digit}`
                      : clientItem.nit || 'N/A'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {clientItem.email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => toggleRowExpansion(clientItem.client_id || clientItem.user_id)}
                      className="text-sky-600 hover:bg-sky-100 p-2 rounded-md transition-colors flex items-center"
                    >
                      <FaEye className="mr-1" />
                      {expandedRows[clientItem.client_id || clientItem.user_id] ? "Ocultar" : "Ver detalles"}
                    </button>
                  </td>
                </tr>

                {/* **FILA EXPANDIDA CON ALINEACIÓN PERFECTA GARANTIZADA** */}
                {expandedRows[clientItem.client_id || clientItem.user_id] && (
                  <tr>
                    <td colSpan="5" className="border-b bg-slate-50 p-0">
                      <div className="p-6 animate-fadeIn">

                        {/* **ALINEACIÓN PERFECTA CON FLEXBOX Y ESTILOS INLINE** */}
                        <div
                          className="flex flex-wrap gap-6"
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                            minHeight: 'auto'
                          }}
                        >

                          {/* **INFORMACIÓN PERSONAL** */}
                          <div
                            className="bg-white rounded-lg shadow p-4 border border-slate-200 flex-1 min-w-[300px] max-w-[400px]"
                            style={{ alignSelf: 'flex-start', marginTop: '0px' }}
                          >
                            <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
                              <FaUser className="text-blue-500" />
                              <h3 className="text-lg font-medium text-gray-700">Información Personal</h3>
                            </div>
                            <ul className="space-y-2 text-sm">
                              <li><span className="font-medium">Nombre:</span> {clientItem.nombre || clientItem.user_name || 'N/A'}</li>
                              <li><span className="font-medium">Email:</span> {clientItem.email || 'N/A'}</li>
                              <li><span className="font-medium">Teléfono:</span> {clientItem.telefono || 'N/A'}</li>
                              <li><span className="font-medium">Dirección:</span> {clientItem.direccion || 'N/A'}</li>
                              <li><span className="font-medium">Ciudad:</span> {clientItem.ciudad || 'N/A'}</li>
                              <li><span className="font-medium">País:</span> {clientItem.pais || 'N/A'}</li>
                            </ul>
                          </div>

                          {/* **INFORMACIÓN EMPRESARIAL** */}
                          <div
                            className="bg-white rounded-lg shadow p-4 border border-slate-200 flex-1 min-w-[300px] max-w-[400px]"
                            style={{ alignSelf: 'flex-start', marginTop: '0px' }}
                          >
                            <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
                              <FaBuilding className="text-amber-500" />
                              <h3 className="text-lg font-medium text-gray-700">Información Empresarial</h3>
                            </div>
                            <ul className="space-y-2 text-sm">
                              <li><span className="font-medium">Razón Social:</span> {clientItem.razonSocial || 'N/A'}</li>
                              <li><span className="font-medium">NIT:</span> {clientItem.nit_number ? `${clientItem.nit_number}-${clientItem.verification_digit}` : clientItem.nit || 'N/A'}</li>
                              <li><span className="font-medium">Código SAP:</span> {clientItem.cardcode_sap || 'No asignado'}</li>
                              <li><span className="font-medium">Lista de Precios:</span> {clientItem.price_list || 'No asignada'}</li>
                            </ul>
                          </div>

                          {/* **INFORMACIÓN ADICIONAL** */}
                          <div
                            className="bg-white rounded-lg shadow p-4 border border-slate-200 flex-1 min-w-[300px] max-w-[400px]"
                            style={{ alignSelf: 'flex-start', marginTop: '0px' }}
                          >
                            <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
                              <FaFileAlt className="text-green-500" />
                              <h3 className="text-lg font-medium text-gray-700">Información Adicional</h3>
                            </div>
                            <ul className="space-y-2 text-sm">
                              {clientItem.extraInfo ? (
                                <>
                                  <li><span className="font-medium">Tipo Documento:</span> {clientItem.extraInfo.tipoDocumento || 'N/A'}</li>
                                  <li><span className="font-medium">Número Documento:</span> {clientItem.extraInfo.numeroDocumento || 'N/A'}</li>
                                  <li><span className="font-medium">Tamaño Empresa:</span> {clientItem.extraInfo.tamanoEmpresa || 'N/A'}</li>
                                  <li><span className="font-medium">Tipo Cuenta:</span> {clientItem.extraInfo.tipoCuenta || 'N/A'}</li>
                                </>
                              ) : (
                                <>
                                  <li><span className="font-medium">Tipo Documento:</span> N/A</li>
                                  <li><span className="font-medium">Número Documento:</span> N/A</li>
                                  <li><span className="font-medium">Tamaño Empresa:</span> N/A</li>
                                  <li><span className="font-medium">Tipo Cuenta:</span> N/A</li>
                                </>
                              )}
                              <li><span className="font-medium">Creado:</span> {clientItem.created_at ? new Date(clientItem.created_at).toLocaleDateString() : 'N/A'}</li>
                              <li><span className="font-medium">Actualizado:</span> {clientItem.updated_at ? new Date(clientItem.updated_at).toLocaleDateString() : 'N/A'}</li>
                            </ul>
                          </div>
                        </div>

                        {/* **FILA SEPARADA PARA CONTACTOS (SI EXISTEN)** */}
                        {clientItem.contacts && clientItem.contacts.length > 0 && (
                          <div className="mt-6">
                            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                              <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
                                <FaPhone className="text-purple-500" />
                                <h3 className="text-lg font-medium text-gray-700">Contactos</h3>
                              </div>
                              <ul className="space-y-2 text-sm">
                                {clientItem.contacts.map((contact, index) => (
                                  <li key={index} className="border-b border-gray-100 pb-2 last:border-b-0">
                                    <span className="font-medium">{contact.name}</span>
                                    {contact.is_primary && <span className="text-blue-500 text-xs ml-1">(Principal)</span>}
                                    <br />
                                    <span className="text-gray-600">{contact.position || 'N/A'}</span>
                                    <br />
                                    <span className="text-gray-600">{contact.phone || 'N/A'} | {contact.email || 'N/A'}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* **FILA SEPARADA PARA DOCUMENTOS** */}
                        <div className="mt-6">
                          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-4" style={{ height: '32px' }}>
                              <FaFileAlt className="text-red-500" />
                              <h3 className="text-lg font-medium text-gray-700">Documentos</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Cédula */}
                              <div className="border rounded-lg p-4 text-center">
                                <FaIdCard className="mx-auto text-2xl text-blue-500 mb-2" />
                                <h4 className="font-medium mb-2">Fotocopia Cédula</h4>
                                <DownloadButton
                                  clientData={clientItem}
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
                                  clientData={clientItem}
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
                                <h4 className="font-medium mb-2">Anexos Adicionales</h4>
                                <DownloadButton
                                  clientData={clientItem}
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
              className={`px-3 py-1 rounded transition-colors ${currentPage === 1
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
                    className={`px-3 py-1 rounded transition-colors ${currentPage === i + 1
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
              className={`px-3 py-1 rounded transition-colors ${currentPage === totalPages
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