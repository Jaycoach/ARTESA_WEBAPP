import React from 'react';
import { AUTH_TYPES } from '../../constants/AuthTypes';

const AuthTypeSelector = ({ selectedType, onTypeChange, disabled = false }) => {
    return (
        <div className="mb-6">
            <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                    type="button"
                    onClick={() => onTypeChange(AUTH_TYPES.USER)}
                    disabled={disabled}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${selectedType === AUTH_TYPES.USER
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    👤 Usuario Principal
                </button>
                <button
                    type="button"
                    onClick={() => onTypeChange(AUTH_TYPES.BRANCH)}
                    disabled={disabled}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${selectedType === AUTH_TYPES.BRANCH
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    🏢 Sucursal
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
                Acceso completo a todas las funcionalidades de la plataforma
            </p>
        </div>
    );
};

export default AuthTypeSelector;
