import React, { useState, useEffect } from 'react';
import { 
  FaEye, FaDownload, FaIdCard, FaFileInvoice, FaFileAlt, FaSearch, 
  FaChevronDown, FaChevronUp, FaUser, FaBuilding, FaPiggyBank, 
  FaUniversity, FaPhone 
} from 'react-icons/fa';
import API from '../../../../api/config';
import { useAuth } from '../../../../hooks/useAuth'; // Ajusta la ruta según tu proyecto

const ClientList = () => {
  // Obtener usuario y rol
  const { user } = useAuth(); // O usa localStorage si no tienes contexto de autenticación

  // Estados para manejar los datos
  const [clients, setClients] = useState([]);
  const [singleClient, setSingleClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'username', direction: 'ascending' });

  // Determinar si es admin
  const isAdmin = user && (user.role?.name === 'ADMIN' || user.rol_id === 1);

  // Cargar datos según el rol
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (isAdmin) {
          // ADMIN: lista completa de usuarios
          const response = await API.get('/users');
          setClients(response.data.data || []);
        } else if (user && user.id) {
          // NO ADMIN: solo su perfil
          const response = await API.get(`/users/${user.id}`);
          setSingleClient(response.data.data || response.data);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error al obtener datos:', err);
        setError('No se pudo cargar la información');
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, user]);

  // Función para manejar la expansión de filas
  const toggleRowExpansion = (clientId) => {
    setExpandedRows(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  // Función para descargar documentos
  const downloadDocument = async (clientId, documentType, documentName) => {
    try {
      const response = await API.get(`/client-profiles/${clientId}/documents/${documentType}`, {
        responseType: 'blob'
      });
      
      // Crear un objeto URL para el blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${documentName}_${clientId}.pdf`);
      
      // Simular clic en el enlace para iniciar la descarga
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar documento:', err);
      alert('No se pudo descargar el documento');
    }
  };

  // Filtrar clientes según término de búsqueda (solo para admin)
  const filteredClients = isAdmin ? clients.filter(client => 
    (client.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (client.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Ordenar clientes (solo para admin)
  const sortedClients = isAdmin ? [...filteredClients].sort((a, b) => {
    if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;
    
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'ascending' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'ascending' ? 1 : -1;
    }
    return 0;
  }) : [];

  // Calcular paginación (solo para admin)
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = isAdmin ? sortedClients.slice(indexOfFirstItem, indexOfLastItem) : [];
  const totalPages = isAdmin ? Math.ceil(sortedClients.length / itemsPerPage) : 0;

  // Cambiar página
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Ordenar por columna
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Estado de carga
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--primary-color)' }}></div>
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
        {error}
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
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FaUser className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Nombre:</span>
            <span>{singleClient.username || singleClient.name || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <FaIdCard className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Documento:</span>
            <span>N/A</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <FaFileAlt className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Email:</span>
            <span>{singleClient.email || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <FaPhone className="text-lg" style={{ color: 'var(--accent-color)' }} />
            <span className="font-semibold">Teléfono:</span>
            <span>N/A</span>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-color)' }}>
            Documentos
          </h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => downloadDocument(singleClient.id, 'fotocopiaCedula', 'cedula')}
              className="px-4 py-2 rounded flex items-center"
              style={{ background: 'var(--accent-color)', color: 'var(--white)' }}
            >
              <FaDownload className="mr-2" /> Descargar Cédula
            </button>
            <button
              onClick={() => downloadDocument(singleClient.id, 'fotocopiaRut', 'rut')}
              className="px-4 py-2 rounded flex items-center"
              style={{ background: 'var(--accent-color)', color: 'var(--white)' }}
            >
              <FaDownload className="mr-2" /> Descargar RUT
            </button>
            <button
              onClick={() => downloadDocument(singleClient.id, 'anexosAdicionales', 'anexos')}
              className="px-4 py-2 rounded flex items-center"
              style={{ background: 'var(--accent-color)', color: 'var(--white)' }}
            >
              <FaDownload className="mr-2" /> Descargar Anexos
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="client-list-container p-6">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Lista de Clientes</h1>
      
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
      </div>
      
      {/* Tabla de clientes */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          {error}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto shadow-md rounded-lg">
            <table className="min-w-full bg-white border">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center space-x-1"
                      onClick={() => requestSort('name')}
                    >
                      <span>Nombre</span>
                      {sortConfig.key === 'nombre' && (
                        sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center space-x-1"
                      onClick={() => requestSort('numeroDocumento')}
                    >
                      <span>Documento</span>
                      {sortConfig.key === 'numeroDocumento' && (
                        sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center space-x-1"
                      onClick={() => requestSort('email')}
                    >
                      <span>Email</span>
                      {sortConfig.key === 'email' && (
                        sortConfig.direction === 'ascending' ? <FaChevronUp /> : <FaChevronDown />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center space-x-1"
                      onClick={() => requestSort('telefono')}
                    >
                      <span>Teléfono</span>
                      {sortConfig.key === 'telefono' && (
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
                  <React.Fragment key={client.id || client._id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {client.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.tipoDocumento} {client.numeroDocumento}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {client.telefono}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => toggleRowExpansion(client.id || client._id)}
                          className="text-sky-600 hover:bg-sky-100 p-2 rounded-md mr-2"
                        >
                          <FaEye /> {expandedRows[client.id || client._id] ? "Ocultar" : "Ver detalles"}
                        </button>
                      </td>
                    </tr>
                    {expandedRows[client.id || client._id] && (
                      <tr>
                        <td colSpan="5" className="border-b bg-slate-50 p-0">
                          <div className="p-6 animate-fadeIn">
                            {/* Ficha con información detallada */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {/* Información básica */}
                              <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                                <div className="flex items-center space-x-2 mb-4">
                                  <FaUser className="text-blue-500" />
                                  <h3 className="text-lg font-medium text-gray-700">Información Personal</h3>
                                </div>
                                <ul className="space-y-2 text-sm">
                                  <li><span className="font-medium">Nombre:</span> {client.nombre}</li>
                                  <li><span className="font-medium">Documento:</span> {client.tipoDocumento} {client.numeroDocumento}</li>
                                  <li><span className="font-medium">Dirección:</span> {client.direccion}</li>
                                  <li><span className="font-medium">Ciudad:</span> {client.ciudad}</li>
                                  <li><span className="font-medium">País:</span> {client.pais}</li>
                                  <li><span className="font-medium">Teléfono:</span> {client.telefono}</li>
                                  <li><span className="font-medium">Email:</span> {client.email}</li>
                                </ul>
                              </div>

                              {/* Información empresarial */}
                              <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                                <div className="flex items-center space-x-2 mb-4">
                                  <FaBuilding className="text-amber-500" />
                                  <h3 className="text-lg font-medium text-gray-700">Información Empresarial</h3>
                                </div>
                                <ul className="space-y-2 text-sm">
                                  <li><span className="font-medium">Razón Social:</span> {client.razonSocial || 'No especificada'}</li>
                                  <li><span className="font-medium">NIT:</span> {client.nit ? `${client.nit}-${client.digitoVerificacion}` : 'No especificado'}</li>
                                  <li><span className="font-medium">Representante Legal:</span> {client.representanteLegal || 'No especificado'}</li>
                                  <li><span className="font-medium">Actividad Comercial:</span> {client.actividadComercial || 'No especificada'}</li>
                                  <li><span className="font-medium">Sector Económico:</span> {client.sectorEconomico || 'No especificado'}</li>
                                  <li><span className="font-medium">Tamaño Empresa:</span> {client.tamanoEmpresa || 'No especificado'}</li>
                                </ul>
                              </div>

                              {/* Información financiera y bancaria */}
                              <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
                                <div className="flex items-center space-x-2 mb-4">
                                  <FaUniversity className="text-green-500" />
                                  <h3 className="text-lg font-medium text-gray-700">Información Bancaria</h3>
                                </div>
                                <ul className="space-y-2 text-sm">
                                  <li><span className="font-medium">Entidad Bancaria:</span> {client.entidadBancaria || 'No especificada'}</li>
                                  <li><span className="font-medium">Tipo de Cuenta:</span> {client.tipoCuenta || 'No especificado'}</li>
                                  <li><span className="font-medium">Número de Cuenta:</span> {client.numeroCuenta || 'No especificado'}</li>
                                </ul>
                                
                                <div className="mt-6">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <FaPiggyBank className="text-purple-500" />
                                    <h3 className="text-lg font-medium text-gray-700">Información Financiera</h3>
                                  </div>
                                  <ul className="space-y-2 text-sm">
                                    <li><span className="font-medium">Ingresos Mensuales:</span> {client.ingresosMensuales ? `$${client.ingresosMensuales.toLocaleString()}` : 'No especificados'}</li>
                                    <li><span className="font-medium">Patrimonio:</span> {client.patrimonio ? `$${client.patrimonio.toLocaleString()}` : 'No especificado'}</li>
                                  </ul>
                                </div>
                              </div>

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
                                    <button
                                      onClick={() => downloadDocument(client.id || client._id, 'fotocopiaCedula', 'cedula')}
                                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center w-full"
                                      disabled={!client.fotocopiaCedula}
                                    >
                                      <FaDownload className="mr-2" /> Descargar
                                    </button>
                                  </div>
                                  
                                  {/* RUT */}
                                  <div className="border rounded-lg p-4 text-center">
                                    <FaFileInvoice className="mx-auto text-2xl text-green-500 mb-2" />
                                    <h4 className="font-medium mb-2">Fotocopia RUT</h4>
                                    <button
                                      onClick={() => downloadDocument(client.id || client._id, 'fotocopiaRut', 'rut')}
                                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center w-full"
                                      disabled={!client.fotocopiaRut}
                                    >
                                      <FaDownload className="mr-2" /> Descargar
                                    </button>
                                  </div>
                                  
                                  {/* Anexos adicionales */}
                                  <div className="border rounded-lg p-4 text-center">
                                    <FaFileAlt className="mx-auto text-2xl text-amber-500 mb-2" />
                                    <h4 className="font-medium mb-2">Anexos Adicionales</h4>
                                    <button
                                      onClick={() => downloadDocument(client.id || client._id, 'anexosAdicionales', 'anexos')}
                                      className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center justify-center w-full"
                                      disabled={!client.anexosAdicionales}
                                    >
                                      <FaDownload className="mr-2" /> Descargar
                                    </button>
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
                    currentPage === 1 ? 'bg-gray-200 cursor-not-allowed' : 'bg-slate-600 text-white hover:bg-slate-700'
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
                            ? 'bg-accent text-white'
                            : 'bg-white border hover:bg-gray-100'
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  } else if (
                    i === currentPage - 3 ||
                    i === currentPage + 3
                  ) {
                    return <span key={i} className="px-2">...</span>;
                  }
                  return null;
                })}
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded ${
                    currentPage === totalPages ? 'bg-gray-200 cursor-not-allowed' : 'bg-slate-600 text-white hover:bg-slate-700'
                  }`}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientList;