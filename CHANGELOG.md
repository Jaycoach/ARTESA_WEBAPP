# CHANGELOG

## [2023-10-01]
### Base de Datos
- Se crearon las tablas `Products`, `Orders` y `Order_Details` con sus respectivos campos.
- Se agregaron las columnas `created_at` y `updated_at` a las tablas `Orders` y `Order_Details`.
- Se crearon índices para mejorar el rendimiento de las consultas.
- Se implementaron triggers para actualizar automáticamente el campo `updated_at`.

#### Script SQL

```sql
-- Tabla Products
CREATE TABLE Products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Products
CREATE INDEX idx_products_name ON Products(name);
CREATE INDEX idx_products_created_at ON Products(created_at);

-- Tabla Orders
CREATE TABLE Orders (
    order_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Índices para Orders
CREATE INDEX idx_orders_user_id ON Orders(user_id);
CREATE INDEX idx_orders_order_date ON Orders(order_date);
CREATE INDEX idx_orders_created_at ON Orders(created_at);

-- Tabla Order_Details
CREATE TABLE Order_Details (
    order_detail_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
);

-- Índices para Order_Details
CREATE INDEX idx_order_details_order_id ON Order_Details(order_id);
CREATE INDEX idx_order_details_product_id ON Order_Details(product_id);
CREATE INDEX idx_order_details_created_at ON Order_Details(created_at);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON Orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_details_updated_at
BEFORE UPDATE ON Order_Details
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

# Changelog

## [1.1.0] - 2023-10-25

### Añadido
- Entidad de productos con campos: código, descripción, listas de precios, código de barras e imagen.
- Integración de Multer para la subida de imágenes a Amazon S3.
- Documentación de la API en Swagger para los endpoints de productos.

### Cambiado
- Estructura del proyecto para incluir la capa de servicios.
- Configuración de variables de entorno para AWS S3.

### Corregido
- Errores menores en la autenticación de usuarios.
- Campos adicionales en la tabla `products`:
  - `code`: Código único del producto.
  - `price_list1`, `price_list2`, `price_list3`: Listas de precios.
  - `barcode`: Código de barras único.
  - `image_url`: URL de la imagen del producto.

#### Script SQL

-- Agregar campo "code"
ALTER TABLE products
ADD COLUMN code VARCHAR(50) UNIQUE NOT NULL;

-- Agregar campos para las listas de precios
ALTER TABLE products
ADD COLUMN price_list1 NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN price_list2 NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN price_list3 NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- Agregar campo "barcode"
ALTER TABLE products
ADD COLUMN barcode VARCHAR(100) UNIQUE;

-- Agregar campo "image_url"
ALTER TABLE products
ADD COLUMN image_url TEXT;

-- (Opcional) Renombrar el campo "price" a "price_list1"
ALTER TABLE products
RENAME COLUMN price TO price_list1;

## [1.0.0] - 2025-02-12
### Added
- Endpoint para crear órdenes con detalles.
- Validación en la base de datos para evitar órdenes sin detalles.

## [1.0.0] - 2025-02-14
### Added
- ADD branch Features/frontEnd
- Merge desarrollo FrontEnd con Git

# CHANGELOG

## [1.2.0] - 2025-02-21
### Added
- Integración completa del sistema de autenticación Frontend-Backend
- Script de hasheo de contraseñas (scripts/hashPasswords.js)
- Nueva configuración de API en Frontend (src/views/frontend/LoginArtesa/src/api/config.js)
- Rutas seguras para productos (src/routes/secureProductRoutes.js)
- Botón de cierre de sesión en Sidebar

### Changed
- Actualización del controlador de autenticación (src/controllers/authController.js)
- Mejora del middleware de autenticación (src/middleware/auth.js)
- Actualización del modelo de usuario (src/models/userModel.js)
- Restructuración de rutas de autenticación y productos
- Corrección de la ruta de autenticación en app.js
- Actualización de configuración Vite

### Security
- Implementación de sistema robusto de autenticación JWT
- Mejora en manejo de contraseñas con bcrypt
- Implementación de rutas protegidas