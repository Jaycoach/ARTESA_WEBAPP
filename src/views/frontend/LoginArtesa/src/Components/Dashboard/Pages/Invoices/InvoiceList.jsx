import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { FaEye, FaFilePdf, FaFileExcel, FaSearch } from 'react-icons/fa';
import API from '../../../../api/config';
import InvoiceStatusBadge from './InvoiceStatusBadge';

const InvoiceList = ({ filterStatus = 'all' }) => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const invoicesPerPage = 10;
  const [invoiceStatuses, setInvoiceStatuses] = useState({});

  // Cargar estados de facturas y configuraciones
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Obtener los estados de facturas
        const statusResponse = await API.get('/invoices/statuses');
        if (statusResponse.data.success) {
          const statusMap = {};
          statusResponse.data.data.forEach(status => {
            statusMap[status.status_id] = status.name;
          });
          setInvoiceStatuses(statusMap);
        }
      } catch (error) {
        console.error('Error fetching invoice statuses:', error);
      }
    };
    fetchSettings();
  }, []);

  const fetchInvoices = useCallback(async () => {
    if (!user || !user.id) {
      setError('Usuario no identificado');
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Llamada a API para obtener facturas del usuario
      const response = await API.get(`/invoices/user/${user.id}`);
      
      if (response.data.success) {
        setInvoices(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Error al cargar las facturas');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Filtrar las facturas según el estado seleccionado y término de búsqueda
  useEffect(() => {
    let result = [...invoices];
    
    // Aplicar filtro por estado
    if (filterStatus !== 'all') {
      switch(filterStatus) {
        case 'active':
          result = result.filter(invoice => 
            invoice.status_id === 'activa' || invoice.status_id === 'emitida'
          );
          break;
        case 'pending':
          result = result.filter(invoice => 
            invoice.status_id === 'pendiente' || invoice.status_id === 'por_pagar'
          );
          break;
        case 'overdue':
          result = result.filter(invoice => 
            invoice.status_id === 'vencida' || 
            (invoice.due_date && new Date(invoice.due_date) < new Date() && 
             invoice.status_id !== 'pagada' && invoice.status_id !== 'cancelada')
          );
          break;
        case 'closed':
          result = result.filter(invoice => 
            invoice.status_id === 'cancelada' || 
            invoice.status_id === 'cerrada' || 
            invoice.status_id === 'pagada'
          );
          break;
      }
    }
    
    // Aplicar filtro por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(invoice => 
        invoice.invoice_id.toString().includes(term) ||
        (invoice.client_name && invoice.client_name.toLowerCase().includes(term)) ||
        (invoice.invoice_number && invoice.invoice_number.toLowerCase().includes(term))
      );
    }
    
    setFilteredInvoices(result);
    setCurrentPage(1); // Resetear a primera página cuando se filtra
  }, [invoices, filterStatus, searchTerm]);

  const handleDownloadPDF = async (invoiceId) => {
    try {
      const response = await API.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `factura-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Error al descargar la factura');
    }
  };

  const handleDownloadExcel = async (invoiceId) => {
    try {
      const response = await API.get(`/invoices/${invoiceId}/excel`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `factura-${invoiceId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading invoice as Excel:', error);
      alert('Error al descargar la factura en formato Excel');
    }
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

  // Cálculo para paginación
  const indexOfLastInvoice = currentPage * invoicesPerPage;
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage;
  const currentInvoices = filteredInvoices.slice(indexOfFirstInvoice, indexOfLastInvoice);
  const totalPages = Math.ceil(filteredInvoices.length / invoicesPerPage);
  
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="loader"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div>
      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por ID, número o cliente..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <FaSearch />
          </div>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-lg text-gray-600 mb-2">No se encontraron facturas con los criterios seleccionados.</p>
          <p className="text-md text-gray-500">Intente con otros filtros o contacte con el administrador.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID/Número
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha emisión
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha vencimiento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentInvoices.map((invoice) => (
                  <tr key={invoice.invoice_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{invoice.invoice_number || invoice.invoice_id}</div>
                      {invoice.invoice_number && invoice.invoice_id !== invoice.invoice_number && (
                        <div className="text-xs text-gray-500">ID: {invoice.invoice_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(invoice.invoice_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {invoice.client_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      ${parseFloat(invoice.total_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <InvoiceStatusBadge status={invoice.status_id} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <Link
                          to={`/dashboard/invoices/detail/${invoice.invoice_id}`}
                          className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                          title="Ver detalles"
                        >
                          <FaEye />
                        </Link>
                        
                        <button
                          onClick={() => handleDownloadPDF(invoice.invoice_id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                          title="Descargar PDF"
                        >
                          <FaFilePdf />
                        </button>
                        
                        <button
                          onClick={() => handleDownloadExcel(invoice.invoice_id)}
                          className="text-green-500 hover:text-green-700 p-1 rounded hover:bg-green-50"
                          title="Descargar Excel"
                        >
                          <FaFileExcel />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <nav className="flex items-center space-x-2">
                <button
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded border ${
                    currentPage === 1 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-blue-500 hover:bg-blue-50'
                  }`}
                >
                  Anterior
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Lógica para mostrar páginas alrededor de la actual
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => paginate(pageNum)}
                      className={`px-3 py-1 rounded border ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white' 
                          : 'bg-white text-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded border ${
                    currentPage === totalPages 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-blue-500 hover:bg-blue-50'
                  }`}
                >
                  Siguiente
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InvoiceList;