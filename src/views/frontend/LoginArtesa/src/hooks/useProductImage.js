import { useState, useEffect } from 'react';
import API from '../api/config';

const useProductImage = (productId, imageType = 'thumbnail',  shouldLoad = true) => { // ✅ CAMBIADO: 'main' → 'thumbnail'
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchImage = async () => {
      if (!productId || !shouldLoad) {
        setImageUrl(null);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // ✅ ENDPOINT CORRECTO: thumbnail en lugar de main
        const response = await API.get(`/products/images/${productId}/${imageType}?download=false`);

        console.log('✅ URL de imagen obtenida exitosamente:', {
          productId,
          originalUrl: response.data.data.imageUrl, // ✅ USAR CAMPO CORRECTO
          fullUrl: response.data.data.imageUrl,     // ✅ USAR CAMPO CORRECTO  
          imageType: response.data.data.imageType
        });

        // ✅ USAR DIRECTAMENTE imageUrl DE LA RESPUESTA
        if (response.data.success && response.data.data.imageUrl) {
          setImageUrl(response.data.data.imageUrl);
        } else {
          setImageUrl(null);
        }

      } catch (error) {
        console.log(`❌ Error obteniendo imagen para producto ${productId}:`, {
          error: error.message,
          status: error.response?.status,
          productId,
          imageType
        });
        setError(error.message);
        setImageUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [productId, imageType, shouldLoad]);

  return { imageUrl, loading, error };
};

export default useProductImage;