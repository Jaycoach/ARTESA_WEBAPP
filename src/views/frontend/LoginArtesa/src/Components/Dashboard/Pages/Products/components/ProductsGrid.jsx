// src/Components/Dashboard/Pages/Products/components/ProductsGrid.jsx
import React from 'react';
import { 
  FiEye, FiEdit, FiTrash2, FiPlus, FiMinus, FiImage, FiUpload, 
  FiShoppingCart, FiInfo 
} from 'react-icons/fi';
import Button from '../../../../../Components/ui/Button';
import Card from '../../../../../Components/ui/Card';

const ProductsGrid = ({
  products,
  loading,
  adminMode,
  productQuantities,
  onQuantityChange,
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
  onAddToOrder,
  onUploadImage,
  formatCurrency
}) => {
  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando productos...</p>
          <p className="text-sm text-gray-500 mt-1">Obteniendo información del catálogo</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FiShoppingCart className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron productos
          </h3>
          <p className="text-gray-600 mb-6">
            {adminMode 
              ? 'Comienza creando tu primer producto en el catálogo.' 
              : 'No hay productos que coincidan con tu búsqueda. Intenta con otros términos.'
            }
          </p>
          {adminMode && (
            <Button
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              onClick={() => window.location.reload()}
            >
              <FiPlus className="mr-2 w-4 h-4" />
              Crear Primer Producto
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.product_id}
          product={product}
          adminMode={adminMode}
          quantity={productQuantities[product.product_id] || 1}
          onQuantityChange={onQuantityChange}
          onViewProduct={onViewProduct}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
          onAddToOrder={onAddToOrder}
          onUploadImage={onUploadImage}
          formatCurrency={formatCurrency}
        />
      ))}
    </div>
  );
};

// **Componente de Tarjeta Individual - Solo Tailwind**
const ProductCard = ({
  product,
  adminMode,
  quantity,
  onQuantityChange,
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
  onAddToOrder,
  onUploadImage,
  formatCurrency
}) => {
  const handleQuantityDecrease = () => {
    if (quantity > 1) {
      onQuantityChange(product.product_id, quantity - 1);
    }
  };

  const handleQuantityIncrease = () => {
    onQuantityChange(product.product_id, quantity + 1);
  };

  const handleQuantityInputChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onQuantityChange(product.product_id, value);
    } else {
      onQuantityChange(product.product_id, 1);
    }
  };

  return (
    <Card className="group h-full flex flex-col overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      {/* **IMAGEN CON OVERLAYS - SOLO TAILWIND** */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <FiImage className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* **Overlay administrativo - Solo Tailwind** */}
        {adminMode && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUploadImage(product);
              }}
              className="bg-white text-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors mr-2"
              title="Cambiar imagen"
            >
              <FiUpload className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditProduct(product);
              }}
              className="bg-white text-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors"
              title="Editar producto"
            >
              <FiEdit className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* **Badges de estado - Solo Tailwind** */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {adminMode && product.stock <= 5 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Stock Bajo
            </span>
          )}
          {product.sap_code && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              SAP: {product.sap_code}
            </span>
          )}
          {product.sap_sync_pending && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Sync Pendiente
            </span>
          )}
        </div>

        {/* **Badge de precio - Solo Tailwind** */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-white text-indigo-600 shadow-md">
            {formatCurrency(product.price_list1)}
          </span>
        </div>
      </div>

      {/* **CONTENIDO - SOLO TAILWIND** */}
      <div className="flex-1 p-4 flex flex-col">
        {/* **Título y descripción** */}
        <div className="flex-1 mb-4">
          <h3 className="font-semibold text-lg text-gray-900 leading-tight mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
            {product.name}
          </h3>
          
          {/* **Código del producto** */}
          <div className="mb-2">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
              <FiInfo className="w-3 h-3 mr-1" />
              ID: {product.product_id}
            </span>
          </div>

          {/* **Descripción** */}
          <p className="text-sm text-gray-600 leading-relaxed">
            {(product.description && product.description !== product.name) 
              ? (product.description.length > 120 
                  ? `${product.description.substring(0, 120)}...` 
                  : product.description)
              : 'Sin descripción detallada disponible para este producto.'
            }
          </p>
        </div>

        {/* **Información administrativa - Solo Tailwind** */}
        {adminMode && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Stock:</span>
              <span className={`font-medium ${
                product.stock > 10 
                  ? 'text-green-600' 
                  : product.stock > 0 
                    ? 'text-yellow-600' 
                    : 'text-red-600'
              }`}>
                {product.stock} unidades
              </span>
            </div>
            
            {product.price_list2 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lista 2:</span>
                <span className="font-medium text-gray-800">
                  {formatCurrency(product.price_list2)}
                </span>
              </div>
            )}
            
            {product.price_list3 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lista 3:</span>
                <span className="font-medium text-gray-800">
                  {formatCurrency(product.price_list3)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* **Controles de cantidad - Solo Tailwind** */}
        {!adminMode && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad
            </label>
            <div className="flex items-center justify-center border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={handleQuantityDecrease}
                className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors duration-200"
                disabled={quantity <= 1}
              >
                <FiMinus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={handleQuantityInputChange}
                className="w-16 h-8 text-center text-sm border-0 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleQuantityIncrease}
                className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors duration-200"
              >
                <FiPlus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* **BOTONES DE ACCIÓN - SOLO TAILWIND** */}
        <div className="mt-auto">
          {adminMode ? (
            // **Controles administrativos**
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                  onClick={() => onViewProduct(product)}
                >
                  <FiEye className="mr-1 w-3 h-3" /> Ver
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors duration-200"
                  onClick={() => onEditProduct(product)}
                >
                  <FiEdit className="mr-1 w-3 h-3" /> Editar
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 hover:border-red-300 transition-colors duration-200"
                onClick={() => onDeleteProduct(product.product_id)}
              >
                <FiTrash2 className="mr-1 w-3 h-3" /> Eliminar Producto
              </Button>
            </div>
          ) : (
            // **Controles de usuario normal**
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                onClick={() => onViewProduct(product)}
              >
                <FiEye className="mr-2 w-3 h-3" /> Ver Detalles
              </Button>
              <Button
                variant="primary"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm rounded-md font-medium transition-all duration-200 transform active:scale-95"
                onClick={() => onAddToOrder(product, quantity)}
              >
                <FiShoppingCart className="mr-2 w-3 h-3" /> Añadir al Pedido
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProductsGrid;
