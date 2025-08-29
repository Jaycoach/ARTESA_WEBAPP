# API de Imágenes de Productos - La Artesa

## Nuevos Endpoints Implementados

### 1. Subir Imagen de Producto
**POST** `/api/products/{productId}/images/{imageType}`

- **Descripción**: Sube una imagen específica para un producto
- **Tipos de imagen**: `main`, `gallery`, `thumbnail`
- **Formatos soportados**: JPEG, PNG, GIF, WebP
- **Tamaño máximo**: 10MB
- **Autenticación**: Requerida (Solo administradores)

**Parámetros:**
- `productId` (path): ID del producto
- `imageType` (path): Tipo de imagen (`main`, `gallery`, `thumbnail`)
- `image` (form-data): Archivo de imagen

**Ejemplo de uso con curl:**
```bash
curl -X POST "http://localhost:3000/api/products/123/images/main" \
  -H "Authorization: Bearer <token>" \
  -F "image=@/ruta/a/imagen.jpg"
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Imagen principal subida exitosamente",
  "data": {
    "imageType": "main",
    "url": "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg",
    "productId": 123
  }
}
```

### 2. Obtener Imagen de Producto
**GET** `/api/products/images/{productId}/{imageType}`

- **Descripción**: Obtiene la URL de una imagen específica de un producto o devuelve el contenido directamente
- **Autenticación**: Requerida

**Parámetros:**
- `productId` (path): ID del producto
- `imageType` (path): Tipo de imagen (`main`, `gallery`, `thumbnail`)
- `download` (query, opcional): Si `true`, descarga el archivo. Si `false`, devuelve la URL firmada.

**Ejemplo de uso:**
```bash
# Obtener URL firmada
curl -X GET "http://localhost:3000/api/products/images/123/main" \
  -H "Authorization: Bearer <token>"

# Descargar imagen directamente
curl -X GET "http://localhost:3000/api/products/images/123/main?download=true" \
  -H "Authorization: Bearer <token>"
```

**Respuesta con URL:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg?X-Amz-Algorithm=...",
    "imageType": "main",
    "productId": 123,
    "expiresIn": 86400
  }
}
```

### 3. Listar Imágenes de Producto
**GET** `/api/products/{productId}/images`

- **Descripción**: Obtiene una lista de todas las imágenes disponibles para un producto
- **Autenticación**: Requerida

**Ejemplo de uso:**
```bash
curl -X GET "http://localhost:3000/api/products/123/images" \
  -H "Authorization: Bearer <token>"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "images": {
      "main": "https://bucket.s3.amazonaws.com/products/123/images/uuid_main.jpg",
      "gallery": [
        "https://bucket.s3.amazonaws.com/products/123/images/uuid_gallery1.jpg",
        "https://bucket.s3.amazonaws.com/products/123/images/uuid_gallery2.jpg"
      ],
      "thumbnail": "https://bucket.s3.amazonaws.com/products/123/images/uuid_thumb.jpg"
    }
  }
}
```

### 4. Eliminar Imagen de Producto
**DELETE** `/api/products/images/{productId}/{imageType}`

- **Descripción**: Elimina una imagen específica de un producto
- **Autenticación**: Requerida (Solo administradores)

**Ejemplo de uso:**
```bash
curl -X DELETE "http://localhost:3000/api/products/images/123/main" \
  -H "Authorization: Bearer <token>"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Imagen principal eliminada exitosamente"
}
```

## Integración con el Frontend

### Para usar las imágenes en componentes de React:

```javascript
// Obtener imágenes de un producto
const getProductImages = async (productId) => {
  try {
    const response = await fetch(`/api/products/${productId}/images`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.data.images;
  } catch (error) {
    console.error('Error al obtener imágenes:', error);
    return null;
  }
};

// Componente para mostrar imagen principal del producto
const ProductImage = ({ productId, imageType = 'main', alt = 'Product Image' }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await fetch(`/api/products/images/${productId}/${imageType}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        setImageUrl(data.data.imageUrl);
      } catch (error) {
        console.error('Error al cargar imagen:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [productId, imageType]);

  if (loading) return <div>Cargando imagen...</div>;
  if (!imageUrl) return <div>Sin imagen disponible</div>;

  return <img src={imageUrl} alt={alt} className="product-image" />;
};

// Componente para subir imágenes
const ProductImageUpload = ({ productId, imageType, onUpload }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`/api/products/${productId}/images/${imageType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        onUpload(data.data);
        alert('Imagen subida exitosamente');
      } else {
        alert('Error al subir imagen: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && <p>Subiendo imagen...</p>}
    </div>
  );
};
```

### Para usar en plantillas de órdenes:

```javascript
// En el componente de listado de productos
const ProductCard = ({ product }) => {
  return (
    <div className="product-card">
      <ProductImage 
        productId={product.product_id} 
        imageType="main" 
        alt={product.name} 
      />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <p className="price">${product.price_list1}</p>
    </div>
  );
};

// En el detalle del producto con galería
const ProductDetail = ({ product }) => {
  const [images, setImages] = useState(null);

  useEffect(() => {
    getProductImages(product.product_id).then(setImages);
  }, [product.product_id]);

  return (
    <div className="product-detail">
      <div className="product-images">
        {images?.main && (
          <img src={images.main} alt={product.name} className="main-image" />
        )}
        {images?.gallery?.length > 0 && (
          <div className="gallery">
            {images.gallery.map((imageUrl, index) => (
              <img 
                key={index} 
                src={imageUrl} 
                alt={`${product.name} ${index + 1}`}
                className="gallery-image"
              />
            ))}
          </div>
        )}
      </div>
      <div className="product-info">
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <p className="price">${product.price_list1}</p>
      </div>
    </div>
  );
};
```

## Configuración Requerida

### Variables de Entorno (para S3):
```bash
STORAGE_MODE=s3
AWS_S3_BUCKET_NAME=artesa-documents-staging
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BASE_URL=https://artesa-documents-staging.s3.amazonaws.com
```

### Para almacenamiento local:
```bash
STORAGE_MODE=local
```

## Notas de Seguridad

1. **Solo administradores** pueden subir y eliminar imágenes
2. **Tipos de archivo permitidos**: JPEG, PNG, GIF, WebP únicamente
3. **Tamaño máximo**: 10MB por imagen
4. **URLs firmadas**: Para S3, las URLs expiran en 24 horas para visualización y 1 hora para descarga
5. **Validación de archivos**: Se verifica el tipo MIME y el tamaño antes de la carga

## Estructura de Archivos

```
uploads/
├── product-images/
│   ├── [productId]/
│   │   ├── [uuid]_main.jpg
│   │   ├── [uuid]_gallery.jpg
│   │   └── [uuid]_thumbnail.jpg
```

## Próximos Pasos

1. **Implementar redimensionamiento automático** para thumbnails
2. **Compresión de imágenes** para optimizar el almacenamiento
3. **Caché de URLs firmadas** para reducir llamadas a S3
4. **Integración con CDN** para mejor rendimiento
5. **Soporte para múltiples imágenes de galería** por producto
