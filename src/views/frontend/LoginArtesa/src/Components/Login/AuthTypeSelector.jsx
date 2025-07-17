import React from 'react';
import { AUTH_TYPES } from '../../constants/AuthTypes';

const AuthTypeSelector = ({ selectedType, onTypeChange, disabled = false }) => {
    const handleTypeSelection = (type) => {
        if (!disabled) {
            onTypeChange(type);
        }
    };

    return (
        <div className="w-full mb-3">
            <div className="flex gap-1 p-0.5 bg-gray-50 rounded-md border border-gray-200">
                <button
                    type="button"
                    onClick={() => handleTypeSelection(AUTH_TYPES.USER)}
                    disabled={disabled}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-sm transition-all duration-200 ${
                        selectedType === AUTH_TYPES.USER
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={selectedType === AUTH_TYPES.USER ? { backgroundColor: '#478090' } : {}}
                >
                    <div className="flex items-center justify-center space-x-1">
                        <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                        <span>Principal</span>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => handleTypeSelection(AUTH_TYPES.BRANCH)}
                    disabled={disabled}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-sm transition-all duration-200 ${
                        selectedType === AUTH_TYPES.BRANCH
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={selectedType === AUTH_TYPES.BRANCH ? { backgroundColor: '#478090' } : {}}
                >
                    <div className="flex items-center justify-center space-x-1">
                        <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                        </svg>
                        <span>Sucursal</span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default AuthTypeSelector;
