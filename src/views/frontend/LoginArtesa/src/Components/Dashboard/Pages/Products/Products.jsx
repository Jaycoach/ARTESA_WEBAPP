import React, { useState, useEffect } from 'react';
import { FiSearch, FiEye, FiShoppingCart, FiPlus, FiMinus, FiList, FiGrid } from 'react-icons/fi';
import API from '../../../../api/config';

// Importación de componentes personalizados
import Modal from '../../../../Components/ui/Modal';
import Input from '../../../../Components/ui/Input';
import Card from '../../../../Components/ui/Card';

const Products = () => {
  // Estado principal
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [viewMode, setViewMode] = useState('table'); // 'table' o 'cards'
  const [notification, setNotification] = useState(null);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Función para mostrar notificaciones
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };
  
  // Función para obtener productos de la API
  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = '/products';
      const params = new URLSearchParams();
      
      if (search) {
        params.append('search', search);
      }
      
      if (selectedCategory) {
        params.append('category', selectedCategory);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await API.get(url);
      
      if (response.data.success) {
        setProducts(response.data.data || []);
      } else {
        console.error('Error en la respuesta de la API:', response.data.message);
        showNotification(response.data.message || 'Error al cargar productos', 'error');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      showNotification('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para obtener categorías
  const fetchCategories = async () => {
    try {
      const response = await API.get('/categories');
      if (response.data.success) {
        setCategories(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };
  
  // Abrir modal de detalles
  const openProductDetails = (product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setModalVisible(true);
  };
  
  // Cerrar modal
  const closeModal = () => {
    setModalVisible(false);
  };
  
  // Incrementar cantidad
  const incrementQuantity = () => {
    if (selectedProduct && quantity < selectedProduct.stock) {
      setQuantity(quantity + 1);
    }
  };
  
  // Decrementar cantidad
  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };
  
  // Añadir al carrito
  const addToCart = async (product, qty = 1) => {
    try {
      await API.post('/cart', {
        productId: product.product_id,
        quantity: qty
      });
      
      showNotification(`${product.name} añadido al carrito`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      showNotification('Error al añadir al carrito', 'error');
    }
  };
  
  // Formatear precio
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(value);
  };
  
  // Calcular paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = products.slice(indexOfFirstItem, indexOfLastItem);
  
  // Cambiar página
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
  // Efecto para cargar datos iniciales
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
        Catálogo de Productos
      </h1>
      
      {/* Barra de herramientas */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="w-full md:w-1/2">
          <div className="relative">
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              name="search"
            />
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={fetchProducts}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Aplicar Filtros
          </button>
          
          {/* Toggle vista tabla/tarjetas */}
          <div className="flex items-center ml-4 border border-gray-300 rounded-md">
            <button 
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'} rounded-l-md`}
              aria-label="Vista de tabla"
            >
              <FiList className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setViewMode('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'} rounded-r-md`}
              aria-label="Vista de tarjetas"
            >
              <FiGrid className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Vista de tabla */}
      {viewMode === 'table' && (
        <Card className="overflow-x-auto bg-white rounded-lg shadow">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imagen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Normal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código de Barras
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentItems.length > 0 ? (
                  currentItems.map((product) => (
                    <tr key={product.product_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <img
                          src={product.image_url || '/assets/no-image.png'}
                          alt={product.name}
                          className="h-12 w-12 object-cover rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(product.price_list1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {product.stock}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {product.barcode || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openProductDetails(product)}
                            className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-100"
                          >
                            <FiEye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => addToCart(product)}
                            className="p-2 text-green-600 hover:text-green-900 rounded-full hover:bg-green-100"
                          >
                            <FiShoppingCart className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      No se encontraron productos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      )}
      
      {/* Vista de tarjetas */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : currentItems.length > 0 ? (
            currentItems.map((product) => (
              <Card key={product.product_id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex flex-col items-center">
                  <img 
                    src={product.image_url || '/assets/no-image.png'} 
                    alt={product.name}
                    className="h-32 w-32 object-contain mb-4"
                  />
                  <h3 className="font-medium text-gray-900 text-center">{product.name}</h3>
                  <p className="text-gray-500 mb-2">{formatCurrency(product.price_list1)}</p>
                  <p className="text-gray-600 text-sm">Stock: {product.stock}</p>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openProductDetails(product)}
                      className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-100"
                    >
                      <FiEye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => addToCart(product)}
                      className="p-2 text-green-600 hover:text-green-900 rounded-full hover:bg-green-100"
                    >
                      <FiShoppingCart className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500 py-8">
              No se encontraron productos.
            </div>
          )}
        </div>
      )}
      
      {/* Paginación */}
      {products.length > 0 && (
        <div className="flex justify-center mt-6">
          <nav className="flex items-center">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-l-md border ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              }`}
            >
              Anterior
            </button>
            
            {[...Array(Math.ceil(products.length / itemsPerPage)).keys()].map((number) => (
              <button
                key={number + 1}
                onClick={() => paginate(number + 1)}
                className={`px-3 py-1 border-t border-b ${
                  currentPage === number + 1
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-50'
                }`}
              >
                {number + 1}
              </button>
            ))}
            
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === Math.ceil(products.length / itemsPerPage)}
              className={`px-3 py-1 rounded-r-md border ${
                currentPage === Math.ceil(products.length / itemsPerPage)
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              }`}
            >
              Siguiente
            </button>
          </nav>
        </div>
      )}
      
      {/* Modal de detalles del producto usando el componente Modal */}
      {selectedProduct && (
        <Modal 
          isOpen={modalVisible} 
          onClose={closeModal} 
          title={selectedProduct.name}
        >
          <div className="flex flex-col sm:flex-row">
            <div className="mb-4 sm:mb-0 sm:mr-4">
              <img
                src={selectedProduct.image_url || '/assets/no-image.png'}
                alt={selectedProduct.name}
                className="h-48 w-48 object-cover rounded mx-auto sm:mx-0"
              />
            </div>
            
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-2">{selectedProduct.description}</p>
              
              {/* Lista de precios */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-1">Precios:</h4>
                <p className="text-sm mb-1">Normal: {formatCurrency(selectedProduct.price_list1)}</p>
                {selectedProduct.price_list2 && (
                  <p className="text-sm mb-1">Mayorista: {formatCurrency(selectedProduct.price_list2)}</p>
                )}
                {selectedProduct.price_list3 && (
                  <p className="text-sm mb-1">Especial: {formatCurrency(selectedProduct.price_list3)}</p>
                )}
              </div>
              
              <p className="text-sm font-bold mb-2">
                Código de barras: <span className="font-normal">{selectedProduct.barcode || 'N/A'}</span>
              </p>
              
              <p className="text-sm font-bold mb-4">
                Stock: <span className="font-normal">{selectedProduct.stock}</span>
              </p>
              
              <div className="flex items-center mb-4">
                <button
                  onClick={decrementQuantity}
                  className="p-2 border border-gray-300 rounded-l"
                >
                  <FiMinus className="h-4 w-4" />
                </button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-16 p-2 text-center border-t border-b border-gray-300"
                  name="quantity"
                />
                <button
                  onClick={incrementQuantity}
                  className="p-2 border border-gray-300 rounded-r"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-4 gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              onClick={() => {
                addToCart(selectedProduct, quantity);
                closeModal();
              }}
            >
              Agregar al carrito
            </button>
          </div>
        </Modal>
      )}
      
      {/* Sistema de notificaciones */}
      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg z-50 ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default Products;