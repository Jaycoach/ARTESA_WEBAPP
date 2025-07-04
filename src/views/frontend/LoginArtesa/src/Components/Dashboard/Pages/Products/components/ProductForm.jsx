// src/Components/Dashboard/Pages/Products/components/ProductForm.jsx
import React, { useState, useEffect } from 'react';
import { FiSave, FiX } from 'react-icons/fi';
import Input from '../../../../../Components/ui/Input';
import Button from '../../../../../Components/ui/Button';

const ProductForm = ({ product, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceList1: '',
    priceList2: '',
    priceList3: '',
    stock: '',
    barcode: '',
    imageUrl: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        priceList1: product.price_list1?.toString() || '',
        priceList2: product.price_list2?.toString() || '',
        priceList3: product.price_list3?.toString() || '',
        stock: product.stock?.toString() || '',
        barcode: product.barcode || '',
        imageUrl: product.image_url || ''
      });
    }
  }, [product]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.priceList1 || isNaN(formData.priceList1) || parseFloat(formData.priceList1) < 0) {
      newErrors.priceList1 = 'El precio debe ser un número válido mayor a 0';
    }

    if (formData.stock && (isNaN(formData.stock) || parseInt(formData.stock) < 0)) {
      newErrors.stock = 'El stock debe ser un número válido mayor o igual a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        priceList1: parseFloat(formData.priceList1) || 0,
        priceList2: parseFloat(formData.priceList2) || 0,
        priceList3: parseFloat(formData.priceList3) || 0,
        stock: parseInt(formData.stock) || 0,
        barcode: formData.barcode.trim(),
        imageUrl: formData.imageUrl.trim()
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Producto *
          </label>
          <Input
            value={formData.name}
            onChange={handleChange('name')}
            placeholder="Ingrese el nombre del producto"
            className={errors.name ? 'border-red-300' : ''}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Descripción */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            value={formData.description}
            onChange={handleChange('description')}
            placeholder="Descripción detallada del producto"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Precios */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Lista 1 (Principal) *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.priceList1}
            onChange={handleChange('priceList1')}
            placeholder="0.00"
            className={errors.priceList1 ? 'border-red-300' : ''}
          />
          {errors.priceList1 && (
            <p className="mt-1 text-sm text-red-600">{errors.priceList1}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Lista 2 (Mayorista)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.priceList2}
            onChange={handleChange('priceList2')}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Lista 3 (Especial)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.priceList3}
            onChange={handleChange('priceList3')}
            placeholder="0.00"
          />
        </div>

        {/* Stock */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stock Inicial
          </label>
          <Input
            type="number"
            min="0"
            value={formData.stock}
            onChange={handleChange('stock')}
            placeholder="0"
            className={errors.stock ? 'border-red-300' : ''}
          />
          {errors.stock && (
            <p className="mt-1 text-sm text-red-600">{errors.stock}</p>
          )}
        </div>

        {/* Código de barras */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código de Barras
          </label>
          <Input
            value={formData.barcode}
            onChange={handleChange('barcode')}
            placeholder="Código de barras del producto"
          />
        </div>

        {/* URL de imagen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL de Imagen
          </label>
          <Input
            type="url"
            value={formData.imageUrl}
            onChange={handleChange('imageUrl')}
            placeholder="https://ejemplo.com/imagen.jpg"
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          <FiX className="mr-2" />
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <FiSave className="mr-2" />
          {loading ? 'Guardando...' : (product ? 'Actualizar' : 'Crear')} Producto
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;
