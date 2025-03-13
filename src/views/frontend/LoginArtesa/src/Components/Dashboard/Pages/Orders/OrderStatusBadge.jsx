import React from 'react';

const OrderStatusBadge = ({ status, size = 'md' }) => {
  const getStatusConfig = () => {
    switch (status?.toLowerCase()) {
      case 'pendiente':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' };
      case 'completada':
      case 'completado':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Completada' };
      case 'cancelada':
      case 'cancelado':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelada' };
      case 'en proceso':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'En Proceso' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: status || 'Desconocido' };
    }
  };

  const { bg, text, label } = getStatusConfig();
  const sizeClass = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full ${bg} ${text} ${sizeClass} font-medium`}>
      {label}
    </span>
  );
};

export default OrderStatusBadge;