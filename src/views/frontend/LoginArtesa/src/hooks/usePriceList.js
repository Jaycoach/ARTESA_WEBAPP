import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './useAuth';
import API from '../api/config';

const usePriceList = () => {
  const { user, branch, authType } = useAuth();

  /* --- Estados --- */
  const [userPriceListCode, setUserPriceListCode] = useState(null);
  const [priceCache, setPriceCache] = useState({});
  const [loading, setLoading] = useState(false);

  /* --- Referencias para evitar llamadas duplicadas --- */
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);
  const priceListCodeRef = useRef(null);
  const lastLogRef = useRef(null); // ✅ NUEVO: Para controlar logs

  // ✅ MEMOIZAR datos del contexto para evitar re-renders innecesarios
  const contextData = useMemo(() => ({
    userId: user?.id,
    authType,
    branchId: branch?.branch_id,
    userPriceList: user?.clientProfile?.effective_price_list_code ||
      user?.clientProfile?.price_list_code,
    branchPriceList: branch?.price_list_code,
    userSize: user?.clientProfile?.tamanoEmpresa
  }), [
    user?.id,
    authType,
    branch?.branch_id,
    user?.clientProfile?.effective_price_list_code,
    user?.clientProfile?.price_list_code,
    branch?.price_list_code,
    user?.clientProfile?.tamanoEmpresa
  ]);

  // ✅ CONTROLAR LOGS - Solo cuando hay cambios reales
  useEffect(() => {
    const currentData = JSON.stringify({
      user: !!user,
      branch: !!branch,
      authType,
      branchData: branch ? {
        branch_id: branch.branch_id,
        client_id: branch.client_id,
        email: branch.email,
        branch_name: branch.branch_name || branch.branchname
      } : null
    });

    if (currentData !== lastLogRef.current) {
      console.log('🔍 usePriceList - Hook iniciado (CAMBIO DETECTADO):', {
        user: !!user,
        branch: !!branch,
        authType,
        authTypeType: typeof authType,
        branchData: branch ? {
          branch_id: branch.branch_id,
          client_id: branch.client_id,
          email: branch.email,
          branch_name: branch.branch_name || branch.branchname
        } : null
      });
      lastLogRef.current = currentData;
    }
  }, [user, branch, authType]);

  /* --- Determinar la lista de precios optimizado --- */
  useEffect(() => {
    // ✅ PREVENIR MÚLTIPLES EJECUCIONES
    if (initializingRef.current || initializedRef.current) {
      return;
    }

    if (!contextData.userId && !contextData.branchId) {
      console.log('❌ usePriceList - No hay usuario ni branch');
      setUserPriceListCode(null);
      return;
    }

    initializingRef.current = true;

    (async () => {
      try {
        let priceCode = null;

        if (contextData.authType === 'branch' && contextData.branchId) {
          console.log('🏢 Usuario BRANCH detectado - Usando datos del contexto');

          // ✅ PRIORIZAR DATOS DEL CONTEXTO MEMOIZADO
          if (contextData.branchPriceList) {
            priceCode = contextData.branchPriceList;
            console.log('✅ Price list code desde contexto branch:', priceCode);
          } else {
            // ✅ SOLO SI NO HAY DATOS EN EL CONTEXTO, hacer llamada API
            console.log('⚠️ Price list code no en contexto, consultando API...');

            try {
              const token = localStorage.getItem('branchAuthToken');
              if (token) {
                const response = await API.get('/branch-orders/client/price-list-code', {
                  headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data.success) {
                  priceCode = response.data.data.price_list_code;
                  console.log('✅ Price list code desde API branch:', priceCode);
                }
              }
            } catch (apiError) {
              console.warn('⚠️ Error API, usando fallback price_list_code = "1":', apiError.message);
              priceCode = '1'; // Fallback seguro
            }
          }
        } else if (contextData.userId) {
          console.log('👤 Usuario PRINCIPAL detectado');

          // ✅ USAR DATOS MEMOIZADOS
          if (contextData.userPriceList) {
            priceCode = contextData.userPriceList;
            console.log('✅ Price list code desde perfil usuario:', priceCode);
          } else {
            // Inferir por tamaño de empresa
            const size = contextData.userSize;
            if (size === 'Grande') priceCode = 'ORO';
            else if (size === 'Mediana') priceCode = 'PLATA';
            else if (size === 'Pequena') priceCode = 'BRONCE';
            else priceCode = 'GENERAL';

            console.log('✅ Price list code inferido:', priceCode, 'para tamaño:', size);
          }
        }

        // ✅ ACTUALIZAR ESTADO SOLO SI CAMBIÓ
        if (priceCode && priceCode !== priceListCodeRef.current) {
          priceListCodeRef.current = priceCode;
          setUserPriceListCode(priceCode);
          console.log('🎯 Price list code final establecido:', priceCode);
        }

        initializedRef.current = true;

      } catch (error) {
        console.error('❌ Error en usePriceList initialization:', error);
        // Fallback seguro
        if (!priceListCodeRef.current) {
          priceListCodeRef.current = '1';
          setUserPriceListCode('1');
        }
      } finally {
        initializingRef.current = false;
      }
    })();

  }, [contextData]); // ✅ USAR DATOS MEMOIZADOS COMO DEPENDENCIA

  // ✅ FUNCIONES MEMOIZADAS
  const fetchMultiplePrices = useCallback(
    async (productCodes = []) => {
      if (!userPriceListCode || productCodes.length === 0) {
        console.log('⚠️ fetchMultiplePrices - Sin price list code o productos');
        return {};
      }

      console.log('🔄 fetchMultiplePrices - Obteniendo precios para:', productCodes.length, 'productos');
      setLoading(true);

      try {
        const { data } = await API.post(
          `/price-lists/${userPriceListCode}/products`,
          { productCodes }
        );

        if (data.success) {
          setPriceCache(prev => ({ ...prev, ...data.data }));
          console.log('✅ fetchMultiplePrices - Precios obtenidos:', Object.keys(data.data).length);
          return data.data;
        }
        return {};
      } catch (err) {
        console.error('❌ Error fetchMultiplePrices:', err);
        return {};
      } finally {
        setLoading(false);
      }
    },
    [userPriceListCode]
  );

  const getProductPrice = useCallback(
    async (productCode) => {
      if (!userPriceListCode) {
        console.log('⚠️ getProductPrice - Sin price list code');
        return null;
      }

      if (priceCache[productCode]) {
        console.log('📋 getProductPrice - Usando cache para:', productCode);
        return priceCache[productCode];
      }

      console.log('🔄 getProductPrice - Consultando precio para:', productCode);

      try {
        const { data } = await API.get(
          `/price-lists/${userPriceListCode}/products/${productCode}/price`
        );

        if (data.success) {
          const priceInfo = {
            price: data.data.price,
            currency: data.data.currency,
            productName: data.data.product_name,
            lastUpdate: data.data.updated_at
          };

          setPriceCache(prev => ({ ...prev, [productCode]: priceInfo }));
          console.log('✅ getProductPrice - Precio obtenido y cacheado:', productCode);
          return priceInfo;
        }
        return null;
      } catch (err) {
        console.error('❌ Error getProductPrice:', err);
        return null;
      }
    },
    [userPriceListCode, priceCache]
  );

  // ✅ MEMOIZAR EL VALOR RETORNADO
  return useMemo(() => ({
    userPriceListCode,
    priceCache,
    loading,
    fetchMultiplePrices,
    getProductPrice
  }), [userPriceListCode, priceCache, loading, fetchMultiplePrices, getProductPrice]);
};

export default usePriceList;