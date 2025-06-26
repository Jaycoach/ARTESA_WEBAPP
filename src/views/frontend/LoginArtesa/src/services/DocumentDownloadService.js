import axios from 'axios';

class DocumentDownloadService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: '/api',
      timeout: 60000,
    });

    this.apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // **MÉTODO PRINCIPAL**: Usar el nuevo endpoint directo
  async downloadDocument(client, documentType, documentName) {
    console.log(`📥 Descargando ${documentType} para usuario ${client.user_id}`);
    
    try {
      // **USAR NUEVO ENDPOINT DIRECTO**
      const downloadUrl = `/client-profiles/user/${client.user_id}/download/${documentType}`;
      console.log(`🔗 Endpoint: ${downloadUrl}`);

      const response = await this.apiClient.get(downloadUrl, {
        responseType: 'blob',
        timeout: 45000,
        headers: {
          'Accept': 'application/pdf, image/*, application/octet-stream, */*',
          'Cache-Control': 'no-cache'
        }
      });

      console.log('📊 Respuesta:', {
        status: response.status,
        contentType: response.headers['content-type'],
        size: response.data.size
      });

      // **VALIDAR RESPUESTA**
      if (!(response.data instanceof Blob) || response.data.size === 0) {
        throw new Error('Archivo vacío o inválido');
      }

      // **VERIFICAR QUE NO SEA HTML DE ERROR**
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        throw new Error('El servidor devolvió HTML (posible error de autenticación)');
      }

      // **DETECTAR EXTENSIÓN**
      let extension = '.pdf';
      if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
        extension = '.jpg';
      } else if (contentType.includes('image/png')) {
        extension = '.png';
      } else if (contentType.includes('application/pdf')) {
        extension = '.pdf';
      }

      // **CREAR DESCARGA**
      const fileName = `${documentName}_${(client.nombre || client.user_id).replace(/[^a-zA-Z0-9]/g, '_')}${extension}`;
      
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      
      console.log(`✅ Descarga completada: ${fileName}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error en descarga:', error);
      
      // **MENSAJES ESPECÍFICOS DE ERROR**
      if (error.response?.status === 404) {
        throw new Error(`El documento ${documentType} no existe para este cliente`);
      } else if (error.response?.status === 403) {
        throw new Error('No tienes permisos para descargar este documento');
      } else if (error.response?.status === 401) {
        throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente');
      } else if (error.message.includes('HTML')) {
        throw new Error('Error de autenticación. Verifica tu sesión');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('La descarga tardó demasiado tiempo');
      }
      
      throw new Error(`Error de descarga: ${error.message}`);
    }
  }
}

export default new DocumentDownloadService();