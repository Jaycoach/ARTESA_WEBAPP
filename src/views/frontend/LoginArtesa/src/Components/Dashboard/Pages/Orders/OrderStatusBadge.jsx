import React from 'react';

/**
 * Componente para mostrar visualmente el estado de un pedido
 * @param {Object} props - Propiedades del componente
 * @param {string} props.status - Estado del pedido (pendiente, completado, cancelado, etc.)
 * @param {string} props.size - Tamaño del badge (sm, md, lg)
 */
const OrderStatusBadge = ({ status, size = 'md' }) => {
  // Normalizar el status a minúsculas y quitar espacios
  const normalizedStatus = status?.toString().toLowerCase().trim() || 'pendiente';
  
  const getStatusConfig = () => {
    switch (normalizedStatus) {
      case 'pendiente':
      case 'pending':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', label: 'Pendiente' };
      
      case 'completado':
      case 'completed':
      case 'entregado':
      case 'delivered':
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', label: 'Completado' };
      
      case 'cancelado':
      case 'canceled':
      case 'cancelled':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', label: 'Cancelado' };
      
      case 'en proceso':
      case 'in progress':
      case 'processing':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', label: 'En Proceso' };
      
      case 'en preparación':
      case 'preparando':
      case 'preparing':
        return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', label: 'En Preparación' };
      
      case 'enviado':
      case 'shipped':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', label: 'Enviado' };
      
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', label: status || 'Desconocido' };
    }
  };

  const { bg, text, border, label } = getStatusConfig();
  
  // Determinar clases según el tamaño
  const sizeClass = size === 'lg' 
    ? 'px-3 py-1 text-sm' 
    : (size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs');

  return (
    <span className={`inline-flex items-center rounded-full ${bg} ${text} ${border} border ${sizeClass} font-medium`}>
      {label}
    </span>
  );
};

export default OrderStatusBadge;