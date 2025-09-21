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

  // Cleanup automático para productos que ya no están en uso
  useEffect(() => {
    const fetchImage = async () => {
      if (!productId || !shouldLoad) {
        setImageUrl(null);
        setLoading(false);
        setError(null);
        return;
      }

      // Verificar cache de errores primero
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
        const cachedUrl = successCache.get(successKey);
        // Validar que la URL cached sigue siendo válida
        if (cachedUrl && typeof cachedUrl === 'string' && cachedUrl.startsWith('http')) {
          setImageUrl(cachedUrl);
          setLoading(false);
          setError(null);
          return;
        } else {
          // Limpiar cache inválido
          successCache.delete(successKey);
        }
      }

      // Verificar si ya hay una petición en curso
      const pendingKey = `${productId}-${imageType}`;
      if (pendingRequests.has(pendingKey)) {
        try {
          const result = await pendingRequests.get(pendingKey);
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
        pendingRequests.delete(pendingKey);

        if (response.data && response.data.success) {
          let finalImageUrl = null;
          
          // Prioridad de extracción de URL mejorada
          if (response.data.data) {
            if (typeof response.data.data === 'string' && response.data.data.startsWith('http')) {
              finalImageUrl = response.data.data;
            } else if (response.data.data.imageUrl) {
              finalImageUrl = response.data.data.imageUrl;
            }
          } else if (response.data.imageUrl) {
            finalImageUrl = response.data.imageUrl;
          }

          if (finalImageUrl) {
            try {
              new URL(finalImageUrl);
              setImageUrl(finalImageUrl);
              successCache.set(successKey, finalImageUrl);
              setError(null);
            } catch (urlError) {
              console.warn(`URL inválida recibida para producto ${productId}:`, finalImageUrl);
              setImageUrl(null);
              setError('URL inválida');
            }
          } else {
            console.warn(`No se encontró URL de imagen válida para producto ${productId}`, response.data);
            setImageUrl(null);
            setError('No image URL found');
          }
        } else {
          console.warn(`No se encontró URL de imagen válida para producto ${productId}`, response.data);
          // Marcar como sin imagen pero no como error para evitar reintentos
          errorCache.add(`${productId}-${imageType}`);
          setImageUrl(null);
          setError('No image available');
        }

      } catch (error) {
        pendingRequests.delete(pendingKey);
        
        // Solo cachear errores 404
        if (error.response?.status === 404) {
          errorCache.add(`${productId}-${imageType}`);
          console.log(`📸 Cache 404 agregado para producto ${productId} (${imageType})`);
        }

        setError(error.response?.status === 404 ? 'Image not found' : error.message);
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
export { errorCache };