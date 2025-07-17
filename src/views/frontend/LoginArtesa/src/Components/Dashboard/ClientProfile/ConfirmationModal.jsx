import React from 'react';
import { FaCheck, FaExclamationTriangle } from 'react-icons/fa';

const ConfirmationModal = ({ isSuccess, message, onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
          {/* Header */}
          <div className={`px-6 py-4 ${isSuccess ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                {isSuccess ? (
                  <FaCheck className="h-6 w-6" />
                ) : (
                  <FaExclamationTriangle className="h-6 w-6" />
                )}
              </div>
              <div className="ml-3">
                <h3 className={`text-lg font-medium ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
                  {isSuccess ? 'Operación Exitosa' : 'Error'}
                </h3>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-sm text-gray-700">
              {message}
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm ${
                isSuccess
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;