import React from 'react';
import useProductImage from '../../../../../hooks/useProductImage';

const ProductImage = ({
  src,
  alt,
  productId,
  className = "",
  imageType = "thumbnail",
  containerClassName = "",
  aspectRatio = "square",
  size = "auto",
  showPlaceholder = true,
  useNewEndpoint = true
}) => {
  const { imageUrl: apiImageUrl, loading, error } = useProductImage(productId, imageType);

  const finalImageUrl = apiImageUrl || src;

  // ✅ NUEVOS ESTILOS CON DIMENSIONES FIJAS
  const getContainerClasses = () => {
    const baseClasses = "relative overflow-hidden bg-gray-100 flex-shrink-0"; // ✅ AGREGADO flex-shrink-0
    
    const aspectClasses = {
      square: "aspect-square",
      "4/3": "aspect-[4/3]",
      "16/9": "aspect-video",
      "3/4": "aspect-[3/4]",
      auto: ""
    };

    // ✅ DIMENSIONES FIJAS RESPONSIVAS - SIN EXPANSION
    const sizeClasses = {
      xs: "w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px]",
      sm: "w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] sm:w-20 sm:h-20 sm:min-w-[80px] sm:min-h-[80px] sm:max-w-[80px] sm:max-h-[80px]",
      md: "w-20 h-20 min-w-[80px] min-h-[80px] max-w-[80px] max-h-[80px] sm:w-24 sm:h-24 sm:min-w-[96px] sm:min-h-[96px] sm:max-w-[96px] sm:max-h-[96px] md:w-28 md:h-28 md:min-w-[112px] md:min-h-[112px] md:max-w-[112px] md:max-h-[112px]",
      lg: "w-24 h-24 min-w-[96px] min-h-[96px] max-w-[96px] max-h-[96px] sm:w-32 sm:h-32 sm:min-w-[128px] sm:min-h-[128px] sm:max-w-[128px] sm:max-h-[128px] md:w-36 md:h-36 md:min-w-[144px] md:min-h-[144px] md:max-w-[144px] md:max-h-[144px]",
      xl: "w-32 h-32 min-w-[128px] min-h-[128px] max-w-[128px] max-h-[128px] sm:w-40 sm:h-40 sm:min-w-[160px] sm:min-h-[160px] sm:max-w-[160px] sm:max-h-[160px] md:w-48 md:h-48 md:min-w-[192px] md:min-h-[192px] md:max-w-[192px] md:max-h-[192px]",
      full: "w-full h-full min-h-[200px] max-h-[400px]", // ✅ LÍMITES PARA FULL
      auto: ""
    };

    return `${baseClasses} ${aspectClasses[aspectRatio] || ""} ${sizeClasses[size] || ""} ${containerClassName}`.trim();
  };

  // ✅ CLASES DE IMAGEN OPTIMIZADAS - SIN EXPANSION
  const getImageClasses = () => {
    const baseClasses = "w-full h-full object-cover object-center transition-all duration-300";
    return `${baseClasses} ${className}`.trim();
  };

  const PlaceholderIcon = ({ className: iconClassName = "w-8 h-8" }) => (
    <div className={`flex items-center justify-center text-gray-400 ${iconClassName}`}>
      <svg 
        className={iconClassName} 
        fill="currentColor" 
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          fillRule="evenodd" 
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" 
          clipRule="evenodd" 
        />
      </svg>
    </div>
  );

  if (loading) {
    return (
      <div className={getContainerClasses()}>
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <PlaceholderIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />
        </div>
      </div>
    );
  }

  if (!finalImageUrl || error) {
    if (!showPlaceholder) return null;
    
    return (
      <div className={getContainerClasses()}>
        <div className="absolute inset-0 flex items-center justify-center">
          <PlaceholderIcon className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12" />
        </div>
      </div>
    );
  }

  return (
    <div className={getContainerClasses()}>
      <img
        src={finalImageUrl}
        alt={alt || 'Imagen del producto'}
        className={getImageClasses()}
        loading="lazy"
        onError={(e) => {
          console.log(`❌ Error cargando imagen: ${finalImageUrl}`);
          
          const placeholder = document.createElement('div');
          placeholder.className = 'absolute inset-0 bg-gray-100 flex items-center justify-center';
          placeholder.innerHTML = `
            <svg class="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
            </svg>
          `;
          
          e.target.style.display = 'none';
          e.target.parentNode.appendChild(placeholder);
        }}
      />
    </div>
  );
};

export default ProductImage;