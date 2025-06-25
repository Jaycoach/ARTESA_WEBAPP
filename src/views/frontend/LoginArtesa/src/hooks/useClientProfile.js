import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import ClientProfileService from '../services/ClientProfileService';
import DocumentDownloadService from '../services/DocumentDownloadService';

export const useClientProfile = (userId = null) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingDocs, setDownloadingDocs] = useState({});

  const isAdmin = user && (user.role === 1);

  // **CARGAR DATOS**
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (isAdmin) {
        console.log('📊 Cargando todos los perfiles (Admin)');
        const allProfiles = await ClientProfileService.getProfile(null, forceRefresh);
        setClients(Array.isArray(allProfiles) ? allProfiles : [allProfiles]);
      } else if (user?.id || userId) {
        console.log(`👤 Cargando perfil del usuario ${userId || user.id}`);
        const userProfile = await ClientProfileService.getProfile(userId || user.id, forceRefresh);
        setData(userProfile);
      }
    } catch (err) {
      console.error('❌ Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id, userId]);

  // **DESCARGAR DOCUMENTO**
  const downloadDocument = useCallback(async (client, documentType, documentName) => {
    const downloadKey = `${client.user_id}-${documentType}`;
    
    try {
      setDownloadingDocs(prev => ({ ...prev, [downloadKey]: true }));
      
      console.log(`📥 Iniciando descarga: ${documentType} para ${client.nombre}`);
      
      // Verificar disponibilidad
      const availability = ClientProfileService.getDocumentAvailability(client);
      if (!availability[documentType]) {
        throw new Error(`El documento ${documentType} no está disponible`);
      }

      // Ejecutar descarga con progreso
      const result = await DocumentDownloadService.downloadDocument(
        client, 
        documentType, 
        documentName,
        (progress) => {
          console.log(`📥 Progreso ${documentType}: ${progress}%`);
        }
      );
      
      console.log(`✅ Descarga completada con método ${result.method}`);
      
    } catch (err) {
      console.error('❌ Error en descarga:', err);
      
      // Mensajes específicos según el error
      if (err.message.includes('expirado')) {
        alert('El enlace de descarga ha expirado. Recargando la página...');
        window.location.reload();
      } else if (err.message.includes('no está disponible')) {
        alert(err.message);
      } else if (err.message.includes('permisos')) {
        alert('No tienes permisos para descargar este documento.');
      } else {
        alert('Error al descargar el documento. Inténtalo nuevamente.');
      }
    } finally {
      setDownloadingDocs(prev => {
        const newState = { ...prev };
        delete newState[downloadKey];
        return newState;
      });
    }
  }, []);

  // **OBTENER DISPONIBILIDAD DE DOCUMENTOS**
  const getDocumentAvailability = useCallback((client) => {
    return ClientProfileService.getDocumentAvailability(client);
  }, []);

  // **VERIFICAR SI ESTÁ DESCARGANDO**
  const isDownloading = useCallback((client, documentType) => {
    const downloadKey = `${client.user_id}-${documentType}`;
    return !!downloadingDocs[downloadKey];
  }, [downloadingDocs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    // Datos
    data,
    clients,
    loading,
    error,
    downloadingDocs,
    isAdmin,
    
    // Métodos
    downloadDocument,
    getDocumentAvailability,
    isDownloading,
    reloadData: () => loadData(true),
    clearCache: ClientProfileService.clearCache.bind(ClientProfileService),
    
    // Estados calculados
    hasData: isAdmin ? clients.length > 0 : !!data,
    isEmpty: isAdmin ? clients.length === 0 : !data
  };
};