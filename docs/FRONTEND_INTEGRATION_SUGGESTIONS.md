# Mejoras Sugeridas para el Frontend - Integración de Imágenes de Productos

## Actualización del Componente ProductImage.jsx

### Cambios Propuestos

#### 1. Integración con la Nueva API de Imágenes

Actualizar el componente `ProductImage.jsx` para usar la nueva API:

```jsx
// src/Components/Dashboard/Pages/Products/components/ProductImage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { FiImage, FiUpload, FiTrash2, FiEdit } from 'react-icons/fi';
import { useAuth } from '../../../../../hooks/useAuth';

// Función mejorada para limpiar URLs
function cleanImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  
  let cleanUrl = rawUrl;
  
  try {
    // Decodificar entidades HTML
    cleanUrl = cleanUrl.replace(/&amp;amp;amp;/g, '&amp;amp;');
    cleanUrl = cleanUrl.replace(/&amp;amp;/g, '&amp;');
    cleanUrl = cleanUrl.replace(/&amp;#x2F;/g, '/');
    cleanUrl = cleanUrl.replace(/&amp;#47;/g, '/');
    cleanUrl = cleanUrl.replace(/&amp;#x3A;/g, ':');
    cleanUrl = cleanUrl.replace(/&amp;#58;/g, ':');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!doctype html><body>${cleanUrl}</body>`, 'text/html');
    cleanUrl = doc.body.textContent || cleanUrl;
  } catch (e) {
    console.warn('⚠️ Error al limpiar URL, usando original');
  }
  
  cleanUrl = cleanUrl.trim();
  
  try {
    new URL(cleanUrl);
    return cleanUrl;
  } catch (e) {
    console.error('❌ URL inválida después de limpiar:', cleanUrl);
    return null;
  }
}

// Hook personalizado para manejar imágenes de productos
const useProductImage = (productId, imageType = 'main') => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  const fetchImage = useCallback(async () => {
    if (!productId || !token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/images/${productId}/${imageType}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.imageUrl) {
          setImageUrl(data.data.imageUrl);
        } else {
          setImageUrl(null);
        }
      } else {
        console.warn(`No se encontró imagen ${imageType} para producto ${productId}`);
        setImageUrl(null);
      }
    } catch (err) {
      console.error('Error al obtener imagen:', err);
      setError(err.message);
      setImageUrl(null);
    } finally {
      setLoading(false);
    }
  }, [productId, imageType, token]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  return { imageUrl, loading, error, refetch: fetchImage };
};

// Hook para subir imágenes
const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { token } = useAuth();

  const uploadImage = useCallback(async (productId, imageType, file) => {
    if (!productId || !imageType || !file || !token) {
      throw new Error('Parámetros inválidos para la subida');
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/products/${productId}/images/${imageType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al subir imagen');
      }

      return data.data;
    } finally {
      setUploading(false);
    }
  }, [token]);

  const deleteImage = useCallback(async (productId, imageType) => {
    if (!productId || !imageType || !token) {
      throw new Error('Parámetros inválidos para eliminar imagen');
    }

    const response = await fetch(`/api/products/images/${productId}/${imageType}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al eliminar imagen');
    }

    return true;
  }, [token]);

  return { uploadImage, deleteImage, uploading };
};

const ProductImage = ({ 
  src: legacySrc, // Para compatibilidad con código existente
  alt, 
  productId, 
  imageType = 'main',
  className = "h-12 w-12",
  showPlaceholder = true,
  showControls = false, // Nueva prop para mostrar controles de administración
  onImageUpdate = null,
  onImageLoad = null,
  onImageError = null 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Usar nueva API si productId está disponible, sino usar legacySrc
  const { imageUrl: apiImageUrl, loading: apiLoading, refetch } = useProductImage(
    productId, 
    imageType
  );
  const { uploadImage, deleteImage, uploading } = useImageUpload();
  const { user } = useAuth();

  // Determinar qué URL usar
  const imageUrl = apiImageUrl || cleanImageUrl(legacySrc);
  const isLoading = productId ? apiLoading : false;
  
  // Verificar si el usuario es administrador
  const isAdmin = user?.rol_id === 1;

  // Reset estados cuando cambia la URL
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [imageUrl]);

  const handleLoad = (e) => {
    console.log('✅ Imagen cargada correctamente:', {
      url: e.target.src,
      productId,
      imageType,
      timestamp: new Date().toISOString()
    });
    
    setImageLoaded(true);
    setImageError(false);
    
    if (onImageLoad) {
      onImageLoad(e);
    }
  };

  const handleError = (e) => {
    console.error('❌ Error al cargar imagen:', {
      url: e.target.src,
      productId,
      imageType,
      timestamp: new Date().toISOString()
    });
    
    setImageError(true);
    setImageLoaded(false);
    
    if (onImageError) {
      onImageError(e);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !productId) return;

    try {
      await uploadImage(productId, imageType, file);
      await refetch(); // Refrescar la imagen
      if (onImageUpdate) {
        onImageUpdate({ action: 'upload', imageType, productId });
      }
      setShowUploadModal(false);
      
      // Mostrar notificación de éxito
      window.dispatchEvent(new CustomEvent('showNotification', {
        detail: {
          type: 'success',
          message: `Imagen ${imageType} subida exitosamente`
        }
      }));
    } catch (error) {
      console.error('Error al subir imagen:', error);
      window.dispatchEvent(new CustomEvent('showNotification', {
        detail: {
          type: 'error',
          message: error.message
        }
      }));
    }
  };

  const handleDeleteImage = async () => {
    if (!productId || !imageUrl) return;

    if (!confirm(`¿Estás seguro de que quieres eliminar la imagen ${imageType}?`)) {
      return;
    }

    try {
      await deleteImage(productId, imageType);
      await refetch(); // Refrescar la imagen
      if (onImageUpdate) {
        onImageUpdate({ action: 'delete', imageType, productId });
      }
      
      window.dispatchEvent(new CustomEvent('showNotification', {
        detail: {
          type: 'success',
          message: `Imagen ${imageType} eliminada exitosamente`
        }
      }));
    } catch (error) {
      console.error('Error al eliminar imagen:', error);
      window.dispatchEvent(new CustomEvent('showNotification', {
        detail: {
          type: 'error',
          message: error.message
        }
      }));
    }
  };

  // Placeholder component
  const Placeholder = () => (
    <div className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400`}>
      <FiImage size={20} />
    </div>
  );

  // Loading component
  if (isLoading) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si no hay imagen y no se muestra placeholder
  if (!imageUrl && !showPlaceholder) {
    return null;
  }

  // Si no hay imagen pero se muestra placeholder
  if (!imageUrl && showPlaceholder) {
    return (
      <div className="relative group">
        <Placeholder />
        {showControls && isAdmin && productId && (
          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg mr-1"
              title={`Subir imagen ${imageType}`}
            >
              <FiUpload size={14} />
            </button>
          </div>
        )}
        
        {/* Modal de subida */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">
                Subir imagen {imageType} para producto {productId}
              </h3>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="w-full mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
              {uploading && (
                <div className="text-center mt-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-sm text-gray-600">Subiendo...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Imagen normal con controles opcionales
  return (
    <div className="relative group">
      <img
        src={imageUrl}
        alt={alt || `Imagen ${imageType} del producto`}
        className={`${className} object-cover rounded-lg ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
      
      {/* Overlay de carga */}
      {!imageLoaded && !imageError && (
        <div className={`absolute inset-0 ${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Controles de administración */}
      {showControls && isAdmin && productId && imageLoaded && (
        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg mr-1"
            title={`Cambiar imagen ${imageType}`}
          >
            <FiEdit size={14} />
          </button>
          <button
            onClick={handleDeleteImage}
            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg"
            title={`Eliminar imagen ${imageType}`}
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      )}
      
      {/* Modal de subida para cambiar imagen */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Cambiar imagen {imageType} para producto {productId}
            </h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
            {uploading && (
              <div className="text-center mt-2">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600">Subiendo...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImage;
```

#### 2. Componente de Galería de Imágenes

Crear un nuevo componente para mostrar múltiples imágenes:

```jsx
// src/Components/Dashboard/Pages/Products/components/ProductImageGallery.jsx
import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import ProductImage from './ProductImage';

const ProductImageGallery = ({ productId, className = "" }) => {
  const [images, setImages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    const fetchImages = async () => {
      if (!productId || !token) return;

      try {
        const response = await fetch(`/api/products/${productId}/images`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setImages(data.data.images);
        }
      } catch (error) {
        console.error('Error al obtener imágenes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [productId, token]);

  const allImages = images ? [
    images.main,
    ...(images.gallery || []),
    images.thumbnail
  ].filter(Boolean) : [];

  if (loading) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg animate-pulse`}>
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (allImages.length === 0) {
    return (
      <div className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center`}>
        <div className="text-center text-gray-500">
          <FiImage size={48} className="mx-auto mb-2" />
          <p>Sin imágenes disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Imagen principal */}
      <div className="mb-4">
        <img
          src={images.main || allImages[0]}
          alt="Imagen principal del producto"
          className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => {
            setSelectedImage(images.main || allImages[0]);
            setShowModal(true);
          }}
        />
      </div>

      {/* Galería de miniaturas */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {allImages.slice(0, 4).map((imageUrl, index) => (
            <img
              key={index}
              src={imageUrl}
              alt={`Imagen ${index + 1} del producto`}
              className="w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                setSelectedImage(imageUrl);
                setShowModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Modal de imagen completa */}
      {showModal && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-screen p-4">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              <FiX size={24} />
            </button>
            <img
              src={selectedImage}
              alt="Imagen ampliada del producto"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;
```

#### 3. Actualización del Componente Principal de Productos

Actualizar `Products.jsx` para usar los nuevos componentes:

```jsx
// En Products.jsx, actualizar las importaciones:
import ProductImage from './components/ProductImage';
import ProductImageGallery from './components/ProductImageGallery';

// En el renderizado de productos en la tabla:
<td className="px-4 py-2 text-center">
  <ProductImage 
    productId={product.product_id} 
    imageType="main"
    alt={product.name}
    className="h-12 w-12 mx-auto"
    showControls={true} // Mostrar controles para administradores
    onImageUpdate={() => {
      // Refrescar lista de productos si es necesario
      fetchProducts();
    }}
  />
</td>

// En el modal de detalle del producto:
<div className="product-detail">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <ProductImageGallery 
        productId={selectedProduct.product_id}
        className="w-full"
      />
    </div>
    <div>
      <h2 className="text-2xl font-bold mb-4">{selectedProduct.name}</h2>
      <p className="text-gray-600 mb-4">{selectedProduct.description}</p>
      <p className="text-xl font-semibold">${selectedProduct.price_list1}</p>
      {/* Otros detalles del producto */}
    </div>
  </div>
</div>
```

### Beneficios de esta Implementación

1. **Compatibilidad hacia atrás**: Funciona con URLs existentes y nuevas
2. **Gestión de estado optimizada**: Usa hooks personalizados para manejar la lógica
3. **Controles de administración**: Solo aparecen para usuarios con permisos
4. **Experiencia de usuario mejorada**: Loading states, error handling, y modales
5. **Optimización de rendimiento**: Lazy loading y carga selectiva de imágenes
6. **Responsive**: Funciona bien en diferentes tamaños de pantalla

### Próximos Pasos

1. **Actualizar las llamadas a la API** para usar los nuevos endpoints
2. **Implementar la galería de imágenes** en las páginas de productos
3. **Agregar validaciones** del lado cliente para tipos y tamaños de archivo
4. **Implementar caché** para las URLs firmadas de S3
5. **Agregar compresión automática** de imágenes antes de subir

Esta implementación mantiene la compatibilidad con el código existente mientras agrega las nuevas funcionalidades de gestión de imágenes.
