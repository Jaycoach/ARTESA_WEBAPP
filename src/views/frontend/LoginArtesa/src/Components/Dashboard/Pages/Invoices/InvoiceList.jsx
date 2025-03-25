import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { FaEye, FaFilePdf, FaSearch, FaFilter } from 'react-icons/fa';
import API from '../../../../api/config';

const InvoiceList = ({ filterStatus = 'all' }) => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterDates, setFilterDates] = useState({ from: '', to: '' });
  const invoicesPerPage = 10;

  const fetchInvoices = useCallback(async () => {
    if (!user || !user.id) {
      setError('Usuario no identificado');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = { userId: user.id };
      if (filterDates.from) params.startDate = filterDates.from;
      if (filterDates.to) params.endDate = filterDates.to;

      const response = await API.get('/orders/invoices', { params });
      if (response.data.success) {
        setInvoices(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Error al cargar las facturas');
    } finally {
      setIsLoading(false);
    }
  }, [user, filterDates]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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

  if (isLoading) {
      return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
        </div>
      );
    }
  
    // Si no hay pedidos, mostrar mensaje
    if (invoices.length === 0) {
      return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-gray-500 text-center p-6">No tienes Facturas registradas.</p>
          <div className="flex justify-center">
            <Link
              to="/dashboard/orders/new"
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
              <input type="date" name="from" value={filterDates.from} onChange={handleDateFilterChange} className="w-full border px-2 py-1 rounded" />
            </div>
            <div>
              <label className="text-sm font-medium">Hasta</label>
              <input type="date" name="to" value={filterDates.to} onChange={handleDateFilterChange} className="w-full border px-2 py-1 rounded" />
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
                <td className="px-4 py-3 whitespace-nowrap font-medium">${parseFloat(invoice.invoice_total).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex space-x-2">
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
      </div>
    </div>
  );
};

export default InvoiceList;