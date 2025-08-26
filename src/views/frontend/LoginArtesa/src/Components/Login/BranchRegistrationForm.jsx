import React, { useState } from 'react';
import { BsFillShieldLockFill, BsBuilding } from "react-icons/bs";
import { TiArrowRightOutline } from "react-icons/ti";
import FormErrorMessage from "../ui/FormErrorMessage";
import PropTypes from 'prop-types';

const BranchRegistrationForm = ({
    branchEmail,
    onRegister,
    onCancel,
    loading = false,
    error = null
}) => {
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [fieldErrors, setFieldErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (fieldErrors[name]) {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.password || formData.password.length < 8) {
            errors.password = 'La contraseña debe tener al menos 8 caracteres';
        }
        if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Las contraseñas no coinciden';
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateForm()) {
            onRegister({
                email: branchEmail,
                password: formData.password
                // branchName eliminado intencionalmente
            });
        }
    };

    return (
        <div className="space-y-3 max-w-sm mx-auto">
            <div className="text-center mb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <BsBuilding className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                    Completar Registro de Sucursal
                </h2>
                <p className="text-sm text-gray-600">
                    Configura tu acceso creando una contraseña para tu sucursal
                </p>
                <div className="mt-2 px-3 py-1 bg-gray-100 rounded-lg">
                    <span className="text-xs text-gray-600">Email: </span>
                    <span className="text-xs font-medium">{branchEmail}</span>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Contraseña */}
                <div>
                    <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                        Contraseña *
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <BsFillShieldLockFill className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder="Mínimo 8 caracteres"
                            value={formData.password}
                            onChange={handleChange}
                            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            style={{ backgroundColor: '#f6db8e' }}
                            disabled={loading}
                        />
                    </div>
                    {fieldErrors.password && <FormErrorMessage message={fieldErrors.password} />}
                </div>

                {/* Confirmar Contraseña */}
                <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
                        Confirmar Contraseña *
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <BsFillShieldLockFill className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            placeholder="Repetir contraseña"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            style={{ backgroundColor: '#f6db8e' }}
                            disabled={loading}
                        />
                    </div>
                    {fieldErrors.confirmPassword && <FormErrorMessage message={fieldErrors.confirmPassword} />}
                </div>

                {/* Botones */}
                <div className="flex space-x-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        style={{ backgroundColor: '#478090' }}
                        disabled={loading}
                    >
                        <span>{loading ? "Registrando..." : "Completar Registro"}</span>
                        {!loading && <TiArrowRightOutline className="h-4 w-4" />}
                    </button>
                </div>
            </form>
        </div>
    );
};

BranchRegistrationForm.propTypes = {
    branchEmail: PropTypes.string.isRequired,
    onRegister: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])])
};

BranchRegistrationForm.defaultProps = {
    loading: false,
    error: null
};

export default BranchRegistrationForm;