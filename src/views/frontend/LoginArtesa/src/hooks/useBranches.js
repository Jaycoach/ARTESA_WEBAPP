import { useState, useCallback } from 'react';
import API from '../api/config';
import { useAuth } from './useAuth';

export const useBranches = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBranches = useCallback(async () => {
    if (!user || !user.id) {
      setError('Usuario no autenticado');
      return [];
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Obteniendo sucursales para usuario:', user.id);
      
      // Intentar obtener sucursales por usuario primero
      let response;
      try {
        response = await API.get(`/client-branches/user/${user.id}`);
      } catch (userError) {
        // Si falla por usuario, intentar por cliente si existe clientId
        if (user.client_id || user.clientId) {
          const clientId = user.client_id || user.clientId;
          console.log('🔄 Intentando obtener sucursales por cliente:', clientId);
          response = await API.get(`/client-branches/client/${clientId}`);
        } else {
          throw userError;
        }
      }
      
      if (response.data.success) {
        const branchesData = response.data.data || [];
        setBranches(branchesData);
        console.log('✅ Sucursales cargadas:', branchesData.length);
        return branchesData;
      } else {
        throw new Error(response.data.message || 'Error al cargar sucursales');
      }
    } catch (error) {
      console.error('❌ Error fetching branches:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Error al cargar sucursales';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    branches,
    loading,
    error,
    fetchBranches
  };
};

export default useBranches;