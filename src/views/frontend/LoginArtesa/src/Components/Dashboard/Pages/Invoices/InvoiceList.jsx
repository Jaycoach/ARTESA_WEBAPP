import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { AUTH_TYPES } from "../../../../constants/AuthTypes";
import { FaEye, FaFilePdf, FaSearch, FaFilter } from 'react-icons/fa';
import API from '../../../../api/config';

const InvoiceList = ({ filterStatus = 'all', formatCurrency, authType }) => {
  // ✅ OBTENER CONTEXTO COMPLETO
  const { user, branch, authType: contextAuthType, isAuthenticated } = useAuth();
  const currentAuthType = authType || contextAuthType;
  
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterDates, setFilterDates] = useState({ from: '', to: '' });
  const invoicesPerPage = 10;
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // ✅ FUNCIÓN CORREGIDA CON CONTEXTO DUAL
  const fetchInvoices = useCallback(async () => {
    // ✅ VALIDACIÓN ESPECÍFICA SEGÚN TIPO DE USUARIO
    if (currentAuthType === AUTH_TYPES.BRANCH) {
      if (!branch) {
        setError('Datos de sucursal no disponibles');
        setIsLoading(false);
        return;
      }
    } else {
      if (!user || !user.id) {
        setError('Usuario no identificado');
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      setError(null);

      let endpoint, params = {};

      // ✅ ENDPOINTS Y PARÁMETROS ESPECÍFICOS SEGÚN TIPO
      if (currentAuthType === AUTH_TYPES.BRANCH) {
        endpoint = '/orders/invoices'; // Endpoint para branch
        // ✅ Solo agregar filtros de fecha, sin userId
        if (filterDates.from) params.startDate = filterDates.from;
        if (filterDates.to) params.endDate = filterDates.to;
        
        console.log('🔄 [BRANCH] Cargando facturas:', { endpoint, params });
      } else {
        endpoint = '/orders/invoices'; // Endpoint para usuario
        params.userId = user.id;
        if (filterDates.from) params.startDate = filterDates.from;
        if (filterDates.to) params.endDate = filterDates.to;
        
        console.log('🔄 [USER] Cargando facturas:', { endpoint, params });
      }

      const response = await API.get(endpoint, { params });
      
      if (response.data.success) {
        setInvoices(response.data.data);
        console.log(`✅ [${currentAuthType}] Facturas cargadas:`, response.data.data.length);
      } else {
        setInvoices([]);
        console.warn(`⚠️ [${currentAuthType}] No se encontraron facturas`);
      }
    } catch (err) {
      console.error(`❌ [${currentAuthType}] Error fetching invoices:`, err);
      setError(err.response?.data?.message || err.message || 'Error al cargar las facturas');
    } finally {
      setIsLoading(false);
    }
  }, [user, branch, currentAuthType, filterDates]);

  // ✅ FUNCIÓN CORREGIDA PARA DETALLES
  const fetchInvoiceDetails = async (invoiceId) => {
    try {
      setLoadingDetails(true);
      
      // ✅ ENDPOINT ESPECÍFICO SEGÚN TIPO
      const endpoint = currentAuthType === AUTH_TYPES.BRANCH 
        ? `/orders/invoices/${invoiceId}/details` // Endpoint para branch
        : `/orders/invoices/${invoiceId}/details`; // Mismo endpoint para ambos
      
      console.log(`🔄 [${currentAuthType}] Obteniendo detalles:`, endpoint);
      
      const response = await API.get(endpoint);
      
      if (response.data.success) {
        setInvoiceDetails(response.data.data);
        console.log(`✅ [${currentAuthType}] Detalles obtenidos:`, response.data.data);
      } else {
        setInvoiceDetails([]);
      }
    } catch (err) {
      console.error(`❌ [${currentAuthType}] Error al obtener detalles:`, err);
      setInvoiceDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setShowModal(true);
    fetchInvoiceDetails(invoice.invoice_doc_entry);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvoices();
    }
  }, [fetchInvoices, isAuthenticated]);

  useEffect(() => {
    let result = [...invoices];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(invoice =>
        invoice.invoice_doc_num.toString().includes(term) ||
        invoice.user_name?.toLowerCase().includes(term) ||
        invoice.company_name?.toLowerCase().includes(term)
      );
    }
    setFilteredInvoices(result);
    setCurrentPage(1);
  }, [invoices, searchTerm]);

  const handleDownloadPDF = (url) => {
    if (!url) return alert('No hay archivo disponible');
    window.open(url, '_blank');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  // ✅ VALIDACIÓN DE AUTENTICACIÓN MEJORADA
  if (!isAuthenticated) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso restringido</h2>
        <p className="mb-4">Debes iniciar sesión para acceder a las facturas.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3">Cargando facturas...</span>
        </div>
      </div>
    );
  }

  // Si hay un error, mostrar mensaje
  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
        <p className="font-medium">Error al cargar las facturas</p>
        <p>{error}</p>
        <button 
          onClick={() => fetchInvoices()} 
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Si no hay facturas, mostrar mensaje
  if (invoices.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <p className="text-gray-500 text-center p-6">
          {currentAuthType === AUTH_TYPES.BRANCH ? 'No hay facturas registradas para esta sucursal.' : 'No tienes facturas registradas.'}
        </p>
        <div className="flex justify-center">
          <Link
            to={currentAuthType === AUTH_TYPES.BRANCH ? "/dashboard-branch/orders/new" : "/dashboard/orders/new"}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Realizar un nuevo pedido
          </Link>
        </div>
      </div>
    );
  }

  const indexOfLastInvoice = currentPage * invoicesPerPage;
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage;
  const currentInvoices = filteredInvoices.slice(indexOfFirstInvoice, indexOfLastInvoice);
  const totalPages = Math.ceil(filteredInvoices.length / invoicesPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleDateFilterChange = (e) => {
    setFilterDates({ ...filterDates, [e.target.name]: e.target.value });
  };

  return (
    <div>
      {/* Header con información del contexto */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-600">
          {currentAuthType === AUTH_TYPES.BRANCH 
            ? `Facturas de: ${branch?.branchname || 'Sucursal'}` 
            : `Facturas de: ${user?.nombre || user?.name || 'Usuario'}`
          }
        </p>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="relative w-full mr-4">
          <input
            type="text"
            placeholder="Buscar por número o cliente..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
        <button
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          onClick={() => setShowFilterPanel(!showFilterPanel)}
        >
          <FaFilter className="mr-1" /> Filtros
        </button>
      </div>

      {showFilterPanel && (
        <div className="bg-gray-50 border p-4 rounded-md mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Desde</label>
              <input 
                type="date" 
                name="from" 
                value={filterDates.from} 
                onChange={handleDateFilterChange} 
                className="w-full border px-2 py-1 rounded" 
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hasta</label>
              <input 
                type="date" 
                name="to" 
                value={filterDates.to} 
                onChange={handleDateFilterChange} 
                className="w-full border px-2 py-1 rounded" 
              />
            </div>
            <div className="sm:col-span-2 text-right">
              <button
                onClick={() => fetchInvoices()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentInvoices.map((invoice) => (
              <tr key={invoice.invoice_doc_entry} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">{invoice.invoice_doc_num}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(invoice.invoice_date)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{invoice.user_name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{invoice.company_name}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium">{formatCurrency(invoice.invoice_total)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewDetails(invoice)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Ver detalles"
                    >
                      <FaEye />
                    </button>
                    {invoice.invoice_url ? (
                      <button
                        onClick={() => handleDownloadPDF(invoice.invoice_url)}
                        className="text-red-500 hover:text-red-700"
                        title="Ver PDF"
                      >
                        <FaFilePdf />
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">No disponible</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{indexOfFirstInvoice + 1}</span> a{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastInvoice, filteredInvoices.length)}
                  </span>{' '}
                  de <span className="font-medium">{filteredInvoices.length}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                    <button
                      key={number}
                      onClick={() => paginate(number)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        number === currentPage
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {number}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Modal para detalles */}
        {showModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Detalles de Factura #{selectedInvoice.invoice_doc_num}</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <p className="font-medium">{selectedInvoice.user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Empresa</p>
                    <p className="font-medium">{selectedInvoice.company_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha</p>
                    <p className="font-medium">{formatDate(selectedInvoice.invoice_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="font-medium text-blue-600">Total: {formatCurrency(selectedInvoice.invoice_total)}</p>
                  </div>
                </div>
              </div>

              <h3 className="font-bold mb-2">Líneas de factura</h3>

              {loadingDetails ? (
                <div className="flex justify-center my-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Descripción</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cantidad</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Precio</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoiceDetails.length > 0 ? (
                        invoiceDetails.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{item.item_code}</td>
                            <td className="px-4 py-2">{item.description}</td>
                            <td className="px-4 py-2">{item.quantity}</td>
                            <td className="px-4 py-2">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-2">{formatCurrency(item.line_total)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-4 py-2 text-center text-gray-500">
                            No hay detalles disponibles para esta factura
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded mr-2"
                >
                  Cerrar
                </button>
                {selectedInvoice.invoice_url && (
                  <button
                    onClick={() => handleDownloadPDF(selectedInvoice.invoice_url)}
                    className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded flex items-center"
                  >
                    <FaFilePdf className="mr-2" /> Ver PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceList;