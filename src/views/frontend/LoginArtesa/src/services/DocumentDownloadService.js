import axios from 'axios';
import ClientProfileService from './ClientProfileService';

class DocumentDownloadService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: '/api',
      timeout: 60000, // 1 minuto para descargas
    });

    // Interceptor para token
    this.apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // **MÉTODO PRINCIPAL**: Descarga con detección de expiración
  async downloadDocument(client, documentType, documentName, onProgress = null) {
    // **USAR ClientProfileService para obtener configuración**
    const documentConfig = ClientProfileService.getDocumentConfig(client, documentType);
    
    if (!documentConfig || !documentConfig.available) {
      throw new Error(`El documento ${documentType} no está disponible`);
    }

    console.log(`📥 Iniciando descarga: ${documentType} para ${client.nombre}`);
    console.log('📋 Configuración del documento:', {
      hasS3Url: !!documentConfig.s3Url,
      expired: documentConfig.expired,
      hasApiPath: !!documentConfig.apiPath
    });

    // **ESTRATEGIA 1**: S3 directo (solo si NO está expirada)
    if (documentConfig.s3Url && !documentConfig.expired) {
      try {
        console.log('✅ URL S3 válida (no expirada), usando descarga directa');
        await this.downloadFromS3Direct(documentConfig.s3Url, documentName, client.nombre);
        return { success: true, method: 1 };
      } catch (s3Error) {
        console.warn('⚠️ Error con S3 directo:', s3Error.message);
      }
    } else if (documentConfig.s3Url && documentConfig.expired) {
      console.log('⚠️ URL S3 EXPIRADA, saltando a API endpoint');
    }

    // **ESTRATEGIA 2**: API endpoint (principal para URLs expiradas)
    if (documentConfig.apiPath) {
      try {
        console.log('🔄 Usando API endpoint (URLs expiradas o fallback)');
        await this.downloadFromAPIBlob(documentConfig.apiPath, documentName, client.nombre, onProgress);
        return { success: true, method: 2 };
      } catch (apiError) {
        console.warn('⚠️ Error con API endpoint:', apiError.message);
        
        // **ESTRATEGIA 3**: Stream como último recurso
        try {
          console.log('🔄 Último intento: API con streaming');
          await this.downloadFromAPIStream(documentConfig.apiPath, documentName, client.nombre);
          return { success: true, method: 3 };
        } catch (streamError) {
          console.error('❌ Stream también falló:', streamError.message);
          throw streamError;
        }
      }
    }

    throw new Error('No hay métodos de descarga disponibles');
  }

  // **ESTRATEGIA 1**: Descarga directa desde S3
  async downloadFromS3Direct(s3Url, documentName, clientName) {
    console.log('✅ Descarga directa desde S3 (URL válida):', s3Url.substring(0, 100) + '...');

    try {
      // **MÉTODO 1**: window.open (más confiable para S3)
      const newWindow = window.open(s3Url, '_blank');
      if (!newWindow) {
        throw new Error('Popup bloqueado por el navegador');
      }
      
      // Dar tiempo para que la descarga inicie
      setTimeout(() => {
        try {
          newWindow.close();
        } catch (e) {
          // Ignorar errores al cerrar ventana
        }
      }, 2000);
      
    } catch (windowError) {
      // **MÉTODO 2 FALLBACK**: fetch + blob (si window.open falla)
      console.log('🔄 Fallback: fetch con blob...');
      
      const response = await fetch(s3Url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('URL de S3 ha expirado durante la descarga');
        }
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      await this.triggerDownload(blob, documentName, clientName);
    }
  }

  // **ESTRATEGIA 2**: Descarga desde API como blob
  async downloadFromAPIBlob(apiPath, documentName, clientName, onProgress) {
    console.log('🔄 Descargando desde API endpoint:', apiPath);

    const response = await this.apiClient.get(apiPath, {
      responseType: 'blob',
      timeout: 30000,
      headers: {
        'Accept': 'application/octet-stream, application/pdf, */*'
      },
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      }
    });

    // Verificar que sea un blob válido
    if (!(response.data instanceof Blob)) {
      throw new Error('Respuesta inválida del servidor');
    }

    if (response.data.size === 0) {
      throw new Error('El archivo descargado está vacío');
    }

    console.log(`📄 Blob descargado: ${response.data.size} bytes`);
    await this.triggerDownload(response.data, documentName, clientName);
  }

  // **ESTRATEGIA 3**: Descarga con streaming (último recurso)
  async downloadFromAPIStream(apiPath, documentName, clientName) {
    console.log('🔄 Descarga con streaming (último recurso):', apiPath);

    const response = await fetch(`/api${apiPath}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Accept': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Leer el stream
    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;
    const contentLength = +response.headers.get('Content-Length');

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      // Progreso opcional
      if (contentLength) {
        const progress = Math.round((receivedLength / contentLength) * 100);
        console.log(`📥 Progreso streaming: ${progress}%`);
      }
    }

    // Combinar chunks en blob
    const blob = new Blob(chunks);
    
    if (blob.size === 0) {
      throw new Error('Stream descargado está vacío');
    }
    
    console.log(`📄 Stream completado: ${blob.size} bytes`);
    await this.triggerDownload(blob, documentName, clientName);
  }

  // **MÉTODO AUXILIAR**: Activar descarga
  async triggerDownload(blob, documentName, clientName) {
    const fileName = `${documentName}_${clientName.replace(/\s+/g, '_')}.pdf`;
    
    try {
      // **MÉTODO 1**: URL.createObjectURL (más compatible)
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpiar URL después de un tiempo
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      console.log(`✅ Descarga activada: ${fileName}`);
      
    } catch (objectUrlError) {
      // **MÉTODO 2**: Fallback con data URL
      console.log('🔄 Fallback a data URL...');
      
      const reader = new FileReader();
      reader.onload = () => {
        const link = document.createElement('a');
        link.href = reader.result;
        link.download = fileName;
        link.click();
        console.log(`✅ Descarga fallback activada: ${fileName}`);
      };
      reader.onerror = () => {
        throw new Error('Error al procesar el archivo para descarga');
      };
      reader.readAsDataURL(blob);
    }
  }
}

export default new DocumentDownloadService();