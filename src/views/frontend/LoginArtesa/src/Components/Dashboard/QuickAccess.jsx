import React from 'react';
import { Link } from 'react-router-dom';
import { FaClipboardList, FaBoxOpen, FaFileInvoice, FaUserEdit, FaCartPlus } from 'react-icons/fa';

const QuickAccess = () => {
  const quickActions = [
    { name: "Mis Pedidos", icon: <FaClipboardList />, link: "/dashboard/orders", color: "bg-green-100 text-green-600" },
    { name: "Productos", icon: <FaBoxOpen />, link: "/dashboard/products", color: "bg-yellow-100 text-yellow-600" },
    { name: "Mis Facturas", icon: <FaFileInvoice />, link: "/dashboard/invoices", color: "bg-red-100 text-red-600" },
    { name: "Mi Perfil", icon: <FaUserEdit />, link: "/dashboard/profile", color: "bg-purple-100 text-purple-600" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 my-6 sm:my-8">
      {quickActions.map(action => (
        <Link to={action.link} key={action.name} className="transform hover:scale-105 transition duration-200">
          <div className={`flex flex-col items-center justify-center p-3 sm:p-4 md:p-5 rounded-xl shadow ${action.color}`}>
            <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">
              {action.icon}
            </div>
            <div className="font-semibold text-xs sm:text-sm text-center">
              {action.name}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default QuickAccess;