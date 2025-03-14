// src/services/imageService.js
/**
 * Servicio para manejo de imágenes en el frontend
 */

/**
 * Redimensiona una imagen manteniendo su proporción
 * @param {File} file - Archivo de imagen a redimensionar
 * @param {Object} options - Opciones de redimensionamiento
 * @param {number} options.maxWidth - Ancho máximo de la imagen
 * @param {number} options.maxHeight - Alto máximo de la imagen
 * @param {string} options.format - Formato de salida (jpeg, png)
 * @param {number} options.quality - Calidad de la imagen (0-1)
 * @returns {Promise<Blob>} - Imagen redimensionada como Blob
 */
export const resizeImage = (file, options = {}) => {
    const {
      maxWidth = 1200,
      maxHeight = 800,
      format = 'jpeg',
      quality = 0.8
    } = options;
  
    return new Promise((resolve, reject) => {
      // Crear un elemento de imagen para cargar el archivo
      const img = new Image();
      const reader = new FileReader();
  
      // Manejar errores de carga
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
  
      // Cuando la imagen se carga, redimensionarla
      img.onload = () => {
        // Calcular nuevas dimensiones manteniendo la proporción
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
  
        // Crear un canvas para dibujar la imagen redimensionada
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar la imagen redimensionada
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir el canvas a un blob
        canvas.toBlob(
          (blob) => resolve(blob),
          `image/${format}`,
          quality
        );
      };
  
      // Leer el archivo como una URL de datos
      reader.onload = (e) => (img.src = e.target.result);
      reader.readAsDataURL(file);
    });
  };
  
  /**
   * Convierte un Blob a un objeto File
   * @param {Blob} blob - Blob a convertir
   * @param {string} fileName - Nombre del archivo
   * @param {string} fileType - Tipo MIME del archivo
   * @returns {File} - Objeto File resultante
   */
  export const blobToFile = (blob, fileName, fileType) => {
    return new File([blob], fileName, {
      type: fileType,
      lastModified: new Date().getTime()
    });
  };
  
  /**
   * Comprueba si un archivo es una imagen válida
   * @param {File} file - Archivo a comprobar
   * @returns {boolean} - true si es una imagen, false si no
   */
  export const isValidImage = (file) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  };
  
  /**
   * Comprueba si un archivo excede el tamaño máximo
   * @param {File} file - Archivo a comprobar
   * @param {number} maxSizeInMB - Tamaño máximo en MB
   * @returns {boolean} - true si excede el tamaño, false si no
   */
  export const exceedsMaxSize = (file, maxSizeInMB = 2) => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size > maxSizeInBytes;
  };
  
  /**
   * Crea una URL de vista previa para una imagen
   * @param {File} file - Archivo de imagen
   * @returns {string} - URL de vista previa
   */
  export const createPreviewURL = (file) => {
    return URL.createObjectURL(file);
  };
  
  /**
   * Libera una URL de vista previa para evitar fugas de memoria
   * @param {string} url - URL de vista previa a liberar
   */
  export const revokePreviewURL = (url) => {
    URL.revokeObjectURL(url);
  };
  
  export default {
    resizeImage,
    blobToFile,
    isValidImage,
    exceedsMaxSize,
    createPreviewURL,
    revokePreviewURL
  };