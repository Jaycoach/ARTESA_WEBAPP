import React from 'react';
import { FiSettings, FiPlus, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import Button from '../../../../../Components/ui/Button';

const AdminControls = ({ adminMode, onToggleAdminMode, onCreateProduct }) => {
  return (
    <div className="flex items-center space-x-3">
      <Button
        variant="outline"
        onClick={onToggleAdminMode}
        className={`flex items-center ${
          adminMode 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
            : 'border-gray-300 text-gray-700'
        }`}
      >
        {adminMode ? (
          <>
            <FiToggleRight className="mr-2 text-indigo-600" size={18} />
            Modo Admin ON
          </>
        ) : (
          <>
            <FiToggleLeft className="mr-2 text-gray-400" size={18} />
            Modo Admin OFF
          </>
        )}
      </Button>

      {adminMode && (
        <Button
          variant="primary"
          onClick={onCreateProduct}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <FiPlus className="mr-2" />
          Crear Producto
        </Button>
      )}
    </div>
  );
};

export default AdminControls;