import React from 'react';
import useProductImage from '../../../../../hooks/useProductImage';

const ProductImage = ({
  src,
  alt,
  productId,
  className = "",
  imageType = "thumbnail" // ✅ CAMBIADO: 'main' → 'thumbnail'
}) => {
  // ✅ USAR HOOK CON THUMBNAIL
  const { imageUrl: apiImageUrl, loading, error } = useProductImage(productId, imageType);

  console.log('🔍 ProductImage Debug:', {
    productId,
    imageType,
    useNewEndpoint: true,
    srcProp: src,
    apiImageUrl,
    loading,
    error
  });

  // ✅ PRIORIDAD: API thumbnail > src prop > placeholder
  const finalImageUrl = apiImageUrl || src;

  if (loading) {
    return (
      <div className={`bg-gray-100 animate-pulse flex items-center justify-center ${className}`}>
        <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  if (!finalImageUrl || error) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={finalImageUrl}
      alt={alt}
      className={`object-cover ${className}`}
      onError={(e) => {
        console.log(`❌ Error cargando imagen: ${finalImageUrl}`);
        e.target.style.display = 'none';
        e.target.parentNode.innerHTML = `
          <div class="bg-gray-100 flex items-center justify-center ${className}">
            <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
            </svg>
          </div>
        `;
      }}
    />
  );
};

export default ProductImage;