// src/hooks/usePriceList.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import API from '../api/config';

const usePriceList = () => {
  const { user } = useAuth();
  const [userPriceListCode, setUserPriceListCode] = useState(null);
  const [priceCache, setPriceCache] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const determinePriceList = () => {
      if (!user) return;

      let priceListCode = 'GENERAL';

      // Determinar lista de precios SOLO si el usuario tiene clientProfile
      // (La validación de acceso ya se maneja en useOrderFormValidation)
      if (user.clientProfile?.tamanoEmpresa === 'Grande') {
        priceListCode = 'ORO';
      } else if (user.clientProfile?.tamanoEmpresa === 'Mediana') {
        priceListCode = 'PLATA';
      } else if (user.clientProfile?.tamanoEmpresa === 'Pequena') {
        priceListCode = 'BRONCE';
      }
      // Usuarios sin clientProfile usan precios GENERAL
      // PERO la validación de acceso se maneja por separado en canCreate endpoint

      setUserPriceListCode(priceListCode);
    };

    determinePriceList();
  }, [user]);

  const fetchMultiplePrices = useCallback(async (productCodes) => {
    if (!userPriceListCode || !productCodes.length) return {};

    setLoading(true);
    try {
      const response = await API.post(
        `/api/price-lists/${userPriceListCode}/products/prices`,
        { productCodes }
      );

      if (response.data.success) {
        const newPrices = response.data.data;
        setPriceCache(prev => ({ ...prev, ...newPrices }));
        return newPrices;
      }
      return {};
    } catch (error) {
      console.error('Error fetching prices:', error);
      return {};
    } finally {
      setLoading(false);
    }
  }, [userPriceListCode]);

  const getProductPrice = useCallback(async (productCode) => {
    if (!userPriceListCode) return null;

    if (priceCache[productCode]) {
      return priceCache[productCode];
    }

    try {
      const response = await API.get(
        `/api/price-lists/${userPriceListCode}/products/${productCode}/price`
      );

      if (response.data.success) {
        const priceData = {
          price: response.data.data.price,
          currency: response.data.data.currency,
          productName: response.data.data.product_name,
          lastUpdate: response.data.data.updated_at
        };

        setPriceCache(prev => ({ ...prev, [productCode]: priceData }));
        return priceData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching product price:', error);
      return null;
    }
  }, [userPriceListCode, priceCache]);

  return {
    userPriceListCode,
    priceCache,
    loading,
    fetchMultiplePrices,
    getProductPrice
  };
};

export default usePriceList;