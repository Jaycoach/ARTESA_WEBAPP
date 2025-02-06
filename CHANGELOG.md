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