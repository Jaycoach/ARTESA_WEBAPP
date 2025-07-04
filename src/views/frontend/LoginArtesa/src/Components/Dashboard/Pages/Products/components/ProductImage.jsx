import React, { useState, useEffect } from 'react';
import { FiImage } from 'react-icons/fi';

// Función para limpiar URLs con entidades HTML
function cleanImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  
  let cleanUrl = rawUrl;
  
  try {
    // Decodificar múltiples niveles de entidades HTML
    cleanUrl = cleanUrl.replace(/&amp;amp;amp;/g, '&amp;amp;');
    cleanUrl = cleanUrl.replace(/&amp;amp;/g, '&amp;');
    cleanUrl = cleanUrl.replace(/&amp;#x2F;/g, '/');
    cleanUrl = cleanUrl.replace(/&amp;#47;/g, '/');
    cleanUrl = cleanUrl.replace(/&amp;#x3A;/g, ':');
    cleanUrl = cleanUrl.replace(/&amp;#58;/g, ':');
    cleanUrl = cleanUrl.replace(/&amp;lt;/g, '<');
    cleanUrl = cleanUrl.replace(/&amp;gt;/g, '>');
    cleanUrl = cleanUrl.replace(/&amp;quot;/g, '"');
    cleanUrl = cleanUrl.replace(/&amp;#39;/g, "'");
    
    // Usar DOMParser para casos complejos
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

const ProductImage = ({ 
  src, 
  alt, 
  productId, 
  className = "h-12 w-12",
  showPlaceholder = true,
  onImageLoad = null,
  onImageError = null 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const imageUrl = cleanImageUrl(src);

  // Reset estados cuando cambia la URL
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setIsLoading(true);
  }, [imageUrl]);

  const handleLoad = (e) => {
    if (import.meta.env.DEV) {
      console.log('✅ Imagen cargada correctamente:', {
        url: e.target.src,
        productId,
        timestamp: new Date().toISOString()
      });
    }
    
    setImageLoaded(true);
    setImageError(false);
    setIsLoading(false);
    
    if (onImageLoad) {
      onImageLoad(e);
    }
  };

  const handleError = (e) => {
    if (import.meta.env.DEV) {
      console.error('❌ Error al cargar imagen:', {
        url: e.target.src,
        productId,
        timestamp: new Date().toISOString()
      });
      
      // Debugging avanzado
      fetch(e.target.src, { method: 'HEAD' })
        .then(response => {
          console.log('🔍 Detalles del error de carga:', {
            errorType: response.ok ? 'RenderError' : 'NotFound',
            status: response.status,
            url: e.target.src,
            productId,
            isS3Url: e.target.src.includes('s3.amazonaws.com'),
            protocol: e.target.src.startsWith('https') ? 'HTTPS' : 'HTTP'
          });
        })
        .catch(err => {
          console.log('🔍 Error de red al verificar imagen:', {
            errorType: 'NetworkError',
            message: err.message,
            url: e.target.src,
            productId
          });
        });
    }
    
    setImageLoaded(false);
    setImageError(true);
    setIsLoading(false);
    
    if (onImageError) {
      onImageError(e);
    }
  };

  // Log de intento de carga
  useEffect(() => {
    if (imageUrl && import.meta.env.DEV) {
      console.log('🔍 Intentando cargar imagen:', {
        url: imageUrl,
        productId,
        isS3Url: imageUrl.includes('s3.amazonaws.com'),
        urlLength: imageUrl.length,
        protocol: imageUrl.startsWith('https') ? 'HTTPS' : 'HTTP'
      });
    }
  }, [imageUrl, productId]);

  // Si no hay URL válida
  if (!imageUrl) {
    return showPlaceholder ? (
      <div className={`${className} rounded-md bg-gray-100 flex items-center justify-center border border-gray-200`}>
        <FiImage className="w-4 h-4 text-gray-400" />
      </div>
    ) : null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Imagen principal */}
      <img
        src={imageUrl}
        alt={alt}
        className={`${className} rounded-md object-cover border border-gray-200 transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          display: imageError ? 'none' : 'block'
        }}
      />
      
      {/* Loading spinner */}
      {isLoading && !imageError && (
        <div className={`${className} rounded-md bg-gray-100 flex items-center justify-center border border-gray-200 absolute inset-0`}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
        </div>
      )}
      
      {/* Placeholder de error */}
      {imageError && showPlaceholder && (
        <div className={`${className} rounded-md bg-gray-100 flex items-center justify-center border border-gray-200 absolute inset-0`}>
          <FiImage className="w-4 h-4 text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default ProductImage;
