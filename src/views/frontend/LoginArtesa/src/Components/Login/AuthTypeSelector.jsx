import React from 'react';
import { AUTH_TYPES } from '../../constants/AuthTypes';

const AuthTypeSelector = ({ selectedType, onTypeChange, disabled = false, loading = false }) => {
    const handleTypeSelection = (type) => {
        if (!disabled && !loading) {
            onTypeChange(type);
        }
    };

    return (
        <div className="w-full mb-3">
            <div className="flex gap-1 p-0.5 bg-gray-50 rounded-md border border-gray-200 relative">
                {/* Indicador deslizante */}
                <div
                    className="absolute top-0.5 h-full bg-white rounded-sm shadow-sm transition-transform duration-200 ease-in-out z-0"
                    style={{
                        width: 'calc(50% - 2px)',
                        transform: selectedType === AUTH_TYPES.BRANCH ? 'translateX(calc(100% + 2px))' : 'translateX(0)'
                    }}
                />

                <button
                    type="button"
                    title="Acceso para usuarios principales del sistema"
                    onClick={() => handleTypeSelection(AUTH_TYPES.USER)}
                    disabled={disabled || loading}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-sm transition-all duration-200 relative z-10 ${selectedType === AUTH_TYPES.USER
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={selectedType === AUTH_TYPES.USER ? { backgroundColor: '#478090' } : {}}
                >
                    <div className="flex items-center justify-center space-x-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Principal</span>
                    </div>
                </button>

                <button
                    type="button"
                    title="Acceso para sucursales registradas"
                    onClick={() => handleTypeSelection(AUTH_TYPES.BRANCH)}
                    disabled={disabled || loading}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-sm transition-all duration-200 relative z-10 ${selectedType === AUTH_TYPES.BRANCH
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={selectedType === AUTH_TYPES.BRANCH ? { backgroundColor: '#478090' } : {}}
                >
                    <div className="flex items-center justify-center space-x-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>Sucursal</span>
                    </div>
                </button>

                {/* Indicador de carga */}
                {loading && (
                    <div className="absolute inset-0 bg-white/30 flex items-center justify-center rounded-md">
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-[#478090] rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthTypeSelector;