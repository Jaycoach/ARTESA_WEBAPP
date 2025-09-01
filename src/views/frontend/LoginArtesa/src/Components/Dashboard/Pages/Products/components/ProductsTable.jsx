// src/Components/Dashboard/Pages/Products/components/ProductsTable.jsx
import React from 'react';
import { FiEye, FiEdit, FiTrash2, FiPlus, FiMinus, FiImage, FiUpload } from 'react-icons/fi';
import Button from '../../../../../Components/ui/Button';
import ProductImage from './ProductImage';

const ProductsTable = ({
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
  if (loading) {
    return (
      <div className="text-center py-12 animate-fadeIn">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-2 text-gray-600">Cargando productos...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <p className="text-gray-600">No se encontraron productos.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg shadow bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Imagen
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio
            </th>
            {!adminMode && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cantidad
              </th>
            )}
            {adminMode && (
              <>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado SAP
                </th>
              </>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.product_id} className="transition-colors hover:bg-gray-50">
              <td className="px-6 py-4">
                <div>
                  <div className="font-medium text-gray-900">{product.name}</div>
                  <div className="text-sm text-gray-500">
                    {product.sap_code || product.product_id}
                  </div>
                </div>
              </td>
              
              {/* **MEJORA: Columna de imagen mejorada** */}
              <td className="px-6 py-4">
                <div className="flex items-center space-x-2">
                  {/* ✅ USAR NUEVO ENDPOINT CON productId */}
                  <ProductImage
                    src={product.image_url || product.image}  // Fallback
                    alt={product.name}
                    productId={product.product_id}
                    imageType="main"
                    className="h-12 w-12"
                    useNewEndpoint={true}  // ✅ HABILITAR NUEVO ENDPOINT
                    onImageLoad={(e) => {
                      console.log(`✅ Imagen cargada en tabla para producto ${product.product_id}`);
                    }}
                    onImageError={(e) => {
                      console.error(`❌ Error cargando imagen en tabla para producto ${product.product_id}`);
                    }}
                  />

                  {adminMode && (
                    <button
                      onClick={() => onUploadImage(product)}
                      className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                      title="Subir imagen"
                    >
                      <FiUpload size={14} />
                    </button>
                  )}
                </div>
              </td>

              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">
                  {formatCurrency(product.price_list1)}
                </div>
                {adminMode && product.price_list2 > 0 && (
                  <div className="text-sm text-gray-500">
                    Lista 2: {formatCurrency(product.price_list2)}
                  </div>
                )}
              </td>

              {!adminMode && (
                <td className="px-6 py-4">
                  <div className="flex items-center border rounded-md w-32 overflow-hidden">
                    <button
                      onClick={() => {
                        const currentQty = productQuantities[product.product_id] || 1;
                        if (currentQty > 1) {
                          onQuantityChange(product.product_id, currentQty - 1);
                        }
                      }}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200"
                    >
                      <FiMinus size={14} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={productQuantities[product.product_id] || 1}
                      onChange={(e) => onQuantityChange(product.product_id, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center text-sm border-0 focus:ring-0 focus:outline-none bg-white"
                    />
                    <button
                      onClick={() => {
                        const currentQty = productQuantities[product.product_id] || 1;
                        onQuantityChange(product.product_id, currentQty + 1);
                      }}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200"
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>
                </td>
              )}

              {adminMode && (
                <>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      product.stock > 10 
                        ? 'bg-green-100 text-green-800'
                        : product.stock > 0 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {product.stock} unidades
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {product.sap_code && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          SAP: {product.sap_code}
                        </span>
                      )}
                      {product.sap_sync_pending && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          Sync Pendiente
                        </span>
                      )}
                    </div>
                  </td>
                </>
              )}

              <td className="px-6 py-4">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewProduct(product)}
                  >
                    <FiEye className="mr-1" /> Ver
                  </Button>
                  
                  {adminMode ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditProduct(product)}
                      >
                        <FiEdit className="mr-1" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteProduct(product.product_id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <FiTrash2 className="mr-1" /> Eliminar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onAddToOrder(product, productQuantities[product.product_id] || 1)}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <FiPlus className="mr-1" /> Añadir
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;
