import React, { useState, useEffect } from 'react';
import { FaArrowLeft, FaFilePdf, FaFileExcel, FaFileInvoiceDollar } from 'react-icons/fa';
import API from '../../../../api/config';
import { useAuth } from '../../../../hooks/useAuth';
import { AUTH_TYPES } from "../../../../constants/AuthTypes";
import InvoiceStatusBadge from './InvoiceStatusBadge';

const InvoiceDetail = ({ invoiceId, onBack, onDownloadSuccess, formatCurrency, authType }) => {
  const { authType: contextAuthType } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const currentAuthType = authType || contextAuthType;

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      try {
        setIsLoading(true);

        // ✅ ENDPOINT ESPECÍFICO SEGÚN TIPO DE USUARIO
        const endpoint = currentAuthType === AUTH_TYPES.BRANCH
          ? `/orders/invoices/${invoiceId}` // Endpoint para branch
          : `/invoices/${invoiceId}`;       // Endpoint para usuario normal

        console.log(`🔄 [${currentAuthType}] Obteniendo detalle de factura:`, endpoint);

        const response = await API.get(endpoint);

        if (response.data.success) {
          setInvoice(response.data.data);
          console.log(`✅ [${currentAuthType}] Detalle de factura obtenido:`, response.data.data);
        } else {
          setError('No se pudo cargar la información de la factura');
        }
      } catch (err) {
        console.error(`❌ [${currentAuthType}] Error fetching invoice details:`, err);
        setError(err.message || 'Error al cargar los detalles de la factura');
      } finally {
        setIsLoading(false);
      }
    };

    if (invoiceId) {
      fetchInvoiceDetails();
    }
  }, [invoiceId, currentAuthType]);

  const handleDownloadPDF = async () => {
    try {
      const endpoint = currentAuthType === AUTH_TYPES.BRANCH
        ? `/orders/invoices/${invoiceId}/pdf` // Endpoint para branch
        : `/invoices/${invoiceId}/pdf`;       // Endpoint para usuario normal

      console.log(`🔄 [${currentAuthType}] Descargando PDF:`, endpoint);

      const response = await API.get(endpoint, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `factura-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      console.log(`✅ [${currentAuthType}] PDF descargado exitosamente`);

      if (onDownloadSuccess) {
        onDownloadSuccess();
      }
    } catch (error) {
      console.error(`❌ [${currentAuthType}] Error downloading PDF:`, error);
      alert('Error al descargar la factura');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const endpoint = currentAuthType === AUTH_TYPES.BRANCH
        ? `/orders/invoices/${invoiceId}/excel` // Endpoint para branch
        : `/invoices/${invoiceId}/excel`;       // Endpoint para usuario normal

      console.log(`🔄 [${currentAuthType}] Descargando Excel:`, endpoint);

      const response = await API.get(endpoint, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `factura-${invoiceId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      console.log(`✅ [${currentAuthType}] Excel descargado exitosamente`);

      if (onDownloadSuccess) {
        onDownloadSuccess();
      }
    } catch (error) {
      console.error(`❌ [${currentAuthType}] Error downloading Excel:`, error);
      alert('Error al descargar la factura en formato Excel');
    }
  };

  const formatCurrencyValue = (amount) => {
    // Si viene como prop, usarlo
    if (formatCurrency) {
      return formatCurrency(amount);
    }

    // Si no viene como prop, usar función por defecto
    if (!amount) return "$0";

    const formatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    });

    return formatter.format(amount);
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
        <div className="mt-4">
          <button 
            onClick={onBack}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded flex items-center"
          >
            <FaArrowLeft className="mr-2" /> Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-10">
        <p className="text-lg text-gray-600 mb-4">No se encontró la factura solicitada.</p>
        <button 
          onClick={onBack}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded flex items-center inline-flex"
        >
          <FaArrowLeft className="mr-2" /> Volver a la lista
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Cabecera con botones */}
      <div className="bg-gray-50 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b">
        <div>
          <button 
            onClick={onBack}
            className="mb-4 sm:mb-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg flex items-center"
          >
            <FaArrowLeft className="mr-2" /> Volver
          </button>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <button
            onClick={handleDownloadPDF}
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
          >
            <FaFilePdf className="mr-2" /> PDF
          </button>
          <button
            onClick={handleDownloadExcel}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
          >
            <FaFileExcel className="mr-2" /> Excel
          </button>
        </div>
      </div>
      
      {/* Contenido principal */}
      <div className="p-4 sm:p-6">
        <div className="flex flex-col md:flex-row justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <FaFileInvoiceDollar className="mr-2 text-blue-500" />
              Factura {invoice.invoice_number || `#${invoice.invoice_id}`}
            </h1>
            <div className="mt-2">
              <InvoiceStatusBadge status={invoice.status_id} large />
            </div>
          </div>
          <div className="mt-4 md:mt-0 md:text-right">
            <p className="text-sm text-gray-600">Fecha de emisión:</p>
            <p className="text-lg font-semibold">{formatDate(invoice.invoice_date)}</p>
            <p className="text-sm text-gray-600 mt-2">Fecha de vencimiento:</p>
            <p className={`text-lg font-semibold ${
              invoice.due_date && new Date(invoice.due_date) < new Date() && 
              invoice.status_id !== 'pagada' && invoice.status_id !== 'cancelada'
                ? 'text-red-600'
                : ''
            }`}>
              {formatDate(invoice.due_date)}
            </p>
          </div>
        </div>

        {/* Información del cliente y empresa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b pb-6">
          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Información del cliente</h2>
            <p className="font-medium">{invoice.client_name}</p>
            {invoice.client_tax_id && <p>NIT/RUT: {invoice.client_tax_id}</p>}
            {invoice.client_address && <p>{invoice.client_address}</p>}
            {invoice.client_email && <p>Email: {invoice.client_email}</p>}
            {invoice.client_phone && <p>Teléfono: {invoice.client_phone}</p>}
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Información de la empresa</h2>
            <p className="font-medium">ARTESA S.A.</p>
            <p>NIT: 890.900.123-4</p>
            <p>Dirección: Calle Principal #123, Medellín</p>
            <p>Email: facturacion@artesa.com</p>
            <p>Teléfono: (604) 123-4567</p>
          </div>
        </div>

        {/* Detalle de productos */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Detalle de productos</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio unitario</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.items && invoice.items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{item.item_code}</td>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{item.quantity}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrencyValue(item.unit_price)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrencyValue(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen de factura */}
        <div className="flex justify-end">
          <div className="w-full md:w-1/2 lg:w-1/3">
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">IVA (19%):</span>
                <span className="font-medium">${parseFloat(invoice.tax_amount || 0).toFixed(2)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Descuento:</span>
                  <span className="font-medium text-green-600">-${parseFloat(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t border-gray-200 mt-2">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-lg font-bold">{formatCurrencyValue(invoice.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Información de pago y notas */}
        {invoice.payment_info && (
          <div className="mt-8 border-t pt-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Información de pago</h2>
            <p>{invoice.payment_info}</p>
          </div>
        )}
        
        {invoice.notes && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-700">Notas</h2>
            <p>{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceDetail;