import { useState, useEffect } from 'react';
import API from '../api/config';

// Cache para errores 404 para evitar recargas
const errorCache = new Set();
const successCache = new Map();

// Cache para peticiones en curso
const pendingRequests = new Map();

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

      // Verificar cache de errores
      const cacheKey = `${productId}-${imageType}`;
      if (errorCache.has(cacheKey)) {
        setImageUrl(null);
        setLoading(false);
        setError('Cached 404');
        return;
      }

      // Verificar cache de éxito
      const successKey = `${productId}-${imageType}`;
      if (successCache.has(successKey)) {
        setImageUrl(successCache.get(successKey));
        setLoading(false);
        setError(null);
        return;
      }

      // Verificar si ya hay una petición en curso
      const pendingKey = `${productId}-${imageType}`;
      if (pendingRequests.has(pendingKey)) {
        const pendingPromise = pendingRequests.get(pendingKey);
        try {
          const result = await pendingPromise;
          setImageUrl(result);
          setLoading(false);
          setError(null);
        } catch (err) {
          setImageUrl(null);
          setLoading(false);
          setError(err.message);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Crear y guardar la promesa de la petición
        const requestPromise = API.get(`/products/images/${productId}/${imageType}?download=false`);
        pendingRequests.set(pendingKey, requestPromise);

        const response = await requestPromise;

        // Limpiar la petición pendiente
        pendingRequests.delete(pendingKey);

        /*console.log('✅ URL de imagen obtenida exitosamente:', {
          productId,
          originalUrl: response.data.data.imageUrl, 
          fullUrl: response.data.data.imageUrl,
          imageType: response.data.data.imageType
        });*/

        // ✅ USAR DIRECTAMENTE imageUrl DE LA RESPUESTA
        if (response.data.success && response.data.data.imageUrl) {
          setImageUrl(response.data.data.imageUrl);
          console.log(`🎯 IMAGEN CARGADA EXITOSAMENTE - Producto ${productId}:`, response.data.data.imageUrl); // TEMPORAL
          successCache.set(successKey, response.data.data.imageUrl); // Guardar en cache de éxito
        } else {
          setImageUrl(null);
          console.log(`⚠️ RESPUESTA SIN IMAGEN - Producto ${productId}:`, response.data); // TEMPORAL
        }

      } catch (error) {
        // Limpiar la petición pendiente en caso de error
        pendingRequests.delete(pendingKey);
        console.log(`❌ Error obteniendo imagen para producto ${productId}:`, {
          error: error.message,
          status: error.response?.status,
          productId,
          imageType
        });

        // Si es 404 o timeout, agregar al cache de errores
        if (error.response?.status === 404 || error.message?.includes('timeout')) {
          errorCache.add(`${productId}-${imageType}`);
        }

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