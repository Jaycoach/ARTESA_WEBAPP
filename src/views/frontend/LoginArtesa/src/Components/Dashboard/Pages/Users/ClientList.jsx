import React, { useState, useEffect, useCallback } from 'react';
import {
  FaEye, FaDownload, FaIdCard, FaFileInvoice, FaFileAlt, FaSearch,
  FaChevronDown, FaChevronUp, FaUser, FaBuilding, FaPiggyBank,
  FaUniversity, FaPhone, FaSpinner, FaExclamationTriangle, FaSync
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

  // **FUNCIÓN CRÍTICA**: Verificar si URL de S3 está expirada
  const isS3UrlExpired = (s3Url) => {
    if (!s3Url || !s3Url.includes('Expires=')) return true;
    
    try {
      const expiresMatch = s3Url.match(/Expires=(\d+)/);
      if (!expiresMatch) return true;
      
      const expiresTimestamp = parseInt(expiresMatch[1]) * 1000;
      const now = Date.now();
      
      console.log('🕒 Verificando expiración S3:', {
        expires: new Date(expiresTimestamp).toISOString(),
        now: new Date(now).toISOString(),
        isExpired: now >= expiresTimestamp
      });
      
      return now >= expiresTimestamp;
    } catch (error) {
      console.warn('⚠️ Error verificando expiración:', error);
      return true;
    }
  };

  // **FUNCIÓN PRINCIPAL**: Descarga con detección de expiración y fallbacks
  const downloadDocument = useCallback(async (client, documentType, documentName) => {
    const downloadKey = `${client.user_id}-${documentType}`;
    
    try {
      setDownloadingDocs(prev => ({ ...prev, [downloadKey]: true }));
      
      console.log(`📥 Iniciando descarga: ${documentType} para ${client.nombre}`);

      let s3DirectUrl = null;
      let apiPath = null;
      
      // **OBTENER URLs SEGÚN TIPO DE DOCUMENTO**
      switch (documentType) {
        case 'cedula':
          s3DirectUrl = client.fotocopiaCedula;
          apiPath = `/client-profiles/user/${client.user_id}/file/cedula`;
          break;
        case 'rut':
          s3DirectUrl = client.fotocopiaRut;
          apiPath = `/client-profiles/user/${client.user_id}/file/rut`;
          break;
        case 'anexos':
          s3DirectUrl = client.anexosAdicionales;
          apiPath = `/client-profiles/user/${client.user_id}/file/anexos`;
          break;
        default:
          throw new Error(`Tipo de documento no válido: ${documentType}`);
      }

      console.log('🔗 URLs disponibles:', { s3DirectUrl, apiPath });

      // **ESTRATEGIA 1**: Solo si URL S3 NO está expirada
      if (s3DirectUrl && s3DirectUrl.includes('amazonaws.com') && !isS3UrlExpired(s3DirectUrl)) {
        console.log('✅ URL S3 válida, intentando descarga directa');
        
        try {
          const newWindow = window.open(s3DirectUrl, '_blank');
          if (newWindow) {
            console.log('✅ Descarga S3 iniciada exitosamente');
            return;
          } else {
            throw new Error('Popup bloqueado');
          }
        } catch (s3Error) {
          console.warn('⚠️ Error con S3, pasando a API:', s3Error.message);
        }
      } else if (s3DirectUrl) {
        console.log('⚠️ URL S3 expirada, usando API directamente');
      }

      // **ESTRATEGIA 2**: Endpoint de API (PRINCIPAL para URLs expiradas)
      if (apiPath) {
        console.log('🔄 Descargando desde API endpoint:', apiPath);
        
        const response = await API.get(apiPath, {
          responseType: 'blob',
          timeout: 30000,
          headers: {
            'Accept': 'application/octet-stream, application/pdf, */*'
          }
        });

        // Verificar que sea un blob válido
        if (!(response.data instanceof Blob)) {
          throw new Error('Respuesta inválida del servidor');
        }

        // Crear descarga
        const blob = response.data;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = `${documentName}_${client.nombre.replace(/\s+/g, '_')}.pdf`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        console.log('✅ Descarga desde API completada');
        return;
      }

      throw new Error('No hay métodos de descarga disponibles');

    } catch (err) {
      console.error('❌ Error en descarga:', err);
      
      // Mensajes específicos según el error
      if (err.response?.status === 404) {
        alert(`El documento ${documentType} no existe para este cliente.`);
      } else if (err.response?.status === 403) {
        alert('No tienes permisos para descargar este documento.');
      } else if (err.message.includes('expirada')) {
        alert('El enlace de descarga ha expirado. Recargando datos...');
        fetchData(true);
      } else if (err.message.includes('Popup bloqueado')) {
        alert('Tu navegador bloqueó la descarga. Por favor, permite popups para este sitio.');
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

  // **FUNCIÓN CORREGIDA**: Obtener datos con mejor manejo de errores
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log('👤 Usuario actual:', user);
      console.log('🔑 Es admin?:', isAdmin);

      if (isAdmin) {
        // **ENDPOINT PARA ADMIN**: Obtener todos los perfiles
        console.log('📊 Obteniendo lista completa de clientes (Admin)');
        const response = await API.get('/client-profiles');
        console.log('📋 Respuesta admin completa:', response.data);

        const clientProfiles = response.data.data || response.data || [];
        const profilesArray = Array.isArray(clientProfiles) ? clientProfiles : [clientProfiles];
        
        console.log('👥 Clientes procesados:', profilesArray.length);
        setClients(profilesArray);

      } else if (user?.id) {
        // **ENDPOINT PARA USUARIO**: Obtener su perfil específico
        console.log(`👤 Obteniendo perfil del usuario ${user.id}`);

        try {
          const response = await API.get(`/client-profiles/user/${user.id}`);
          console.log('📄 Respuesta perfil usuario completa:', response.data);

          const clientProfile = response.data.data || response.data;
          setSingleClient(clientProfile);

        } catch (profileError) {
          console.log('⚠️ No se encontró perfil específico, creando perfil básico');

          // Fallback: crear perfil básico con datos del usuario
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

  // **COMPONENTE MEJORADO**: Botón de descarga con indicador de expiración
  const DownloadButton = ({ client, documentType, documentName, icon: Icon, color, label }) => {
    const downloadKey = `${client.user_id}-${documentType}`;
    const isDownloading = downloadingDocs[downloadKey];

    // **VERIFICAR DISPONIBILIDAD SEGÚN CAMPOS REALES DE LA API**
    let documentAvailable = false;
    let s3Url = null;

    switch (documentType) {
      case 'cedula':
        documentAvailable = !!(client.fotocopiaCedulaUrl || client.fotocopiaCedula);
        s3Url = client.fotocopiaCedula;
        break;
      case 'rut':
        documentAvailable = !!(client.fotocopiaRutUrl || client.fotocopiaRut);
        s3Url = client.fotocopiaRut;
        break;
      case 'anexos':
        documentAvailable = !!client.anexosAdicionales;
        s3Url = client.anexosAdicionales;
        break;
    }

    const s3Expired = s3Url ? isS3UrlExpired(s3Url) : false;

    return (
      <div className="space-y-2">
        <button
          onClick={() => downloadDocument(client, documentType, documentName)}
          disabled={!documentAvailable || isDownloading}
          className={`px-4 py-2 rounded-lg flex items-center justify-center w-full transition-colors ${
            !documentAvailable || isDownloading
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
        
        {/* Indicador de expiración */}
        {documentAvailable && s3Expired && (
          <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
            ⚠️ Enlace S3 expirado - Usando API
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

  // **RENDERIZADO PARA USUARIO NO ADMIN (UI RICA DE VERSIÓN 1)**
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
            <br />
            🕒 Verificación de URLs S3 activa
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--primary-color)' }}>
              Documentos
            </h3>
            <button
              onClick={() => fetchData(true)}
              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
              title="Actualizar URLs de descarga"
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

  // **RENDERIZADO PARA ADMIN (UI RICA DE VERSIÓN 1 + FUNCIONALIDAD MEJORADA)**
  return (
    <div className="client-list-container p-6">
      {/* Header con información del entorno */}
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

                {/* Fila expandida con información detallada (UI RICA) */}
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