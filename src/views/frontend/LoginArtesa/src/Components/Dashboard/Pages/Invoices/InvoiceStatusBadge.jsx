import React from 'react';

const InvoiceStatusBadge = ({ status, large = false }) => {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  let statusText = 'Desconocido';

  switch (status?.toLowerCase()) {
    case 'emitida':
    case 'activa':
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
      statusText = 'Emitida';
      break;
    case 'pendiente':
    case 'por_pagar':
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-800';
      statusText = 'Pendiente de pago';
      break;
    case 'vencida':
      bgColor = 'bg-red-100';
      textColor = 'text-red-800';
      statusText = 'Vencida';
      break;
    case 'pagada':
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
      statusText = 'Pagada';
      break;
    case 'cancelada':
    case 'anulada':
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-800';
      statusText = 'Cancelada';
      break;
    case 'cerrada':
      bgColor = 'bg-purple-100';
      textColor = 'text-purple-800';
      statusText = 'Cerrada';
      break;
    default:
      if (status) {
        statusText = status.charAt(0).toUpperCase() + status.slice(1);
      }
  }

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${bgColor} ${textColor} ${
        large ? 'text-sm font-medium px-3 py-1' : 'text-xs'
      }`}
    >
      {statusText}
    </span>
  );
};

export default InvoiceStatusBadge;