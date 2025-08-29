# Fix: Error "chk_orders_total_positive" al Crear Órdenes desde Sucursales

## Problema Identificado

**Error:** 
```
error: new row for relation "orders" violates check constraint "chk_orders_total_positive"
```

**Causa:** Al crear órdenes desde sucursales a través del frontend, el total de la orden era 0 porque los precios unitarios de los productos no se estaban enviando correctamente.

## Análisis del Problema

### Error en el Frontend
El problema estaba en el archivo `CreateOrderForm.jsx` línea 902, donde se mapeaban los productos:

```jsx
// ❌ INCORRECTO - antes del fix
products: orderDetails.map(products => ({
  product_id: parseInt(products.product_id || 0),
  quantity: parseInt(products.quantity || 0),
  unit_price: parseFloat(products.price || 0), // ← products.price no existe!
  // ...resto del mapeo
}))
```

El campo `products.price` no existe en el objeto `orderDetails`. El campo correcto es `products.unit_price`.

### Flujo del Error
1. Frontend envía productos con `unit_price: 0`
2. Backend calcula total: `0 * cantidad = 0`
3. Modelo `Order.create()` intenta insertar orden con `total_amount = 0`
4. Base de datos rechaza por restricción `chk_orders_total_positive`

## Solución Implementada

### 1. Corrección en Frontend
**Archivo:** `src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Orders/CreateOrderForm.jsx`

```jsx
// ✅ CORRECTO - después del fix
products: orderDetails.map(products => ({
  product_id: parseInt(products.product_id || 0),
  quantity: parseInt(products.quantity || 0),
  unit_price: parseFloat(products.unit_price || 0), // ← Corregido a unit_price
  // ...resto del mapeo
}))
```

### 2. Validaciones Mejoradas en Backend

#### En el Modelo Order (`src/models/Order.js`)
```javascript
// Validar cada producto individualmente
products.forEach((product, index) => {
  if (!product.product_id) {
    throw new Error(`Producto ${index + 1}: ID de producto requerido`);
  }
  if (!product.quantity || parseInt(product.quantity) <= 0) {
    throw new Error(`Producto ${index + 1}: Cantidad debe ser mayor a 0`);
  }
  if (!product.unit_price || parseFloat(product.unit_price) <= 0) {
    throw new Error(`Producto ${index + 1}: Precio unitario debe ser mayor a 0`);
  }
});

// Validar que el total sea positivo
if (totalAmount <= 0) {
  throw new Error('El total de la orden debe ser mayor a 0');
}
```

#### En el Controlador de Sucursales (`src/controllers/branchOrderController.js`)
```javascript
// Validar cada producto individualmente
for (let i = 0; i < products.length; i++) {
  const product = products[i];
  if (!product.product_id) {
    return res.status(400).json({
      success: false,
      message: `Producto ${i + 1}: ID de producto requerido`
    });
  }
  if (!product.quantity || parseInt(product.quantity) <= 0) {
    return res.status(400).json({
      success: false,
      message: `Producto ${i + 1}: Cantidad debe ser mayor a 0`
    });
  }
  if (!product.unit_price || parseFloat(product.unit_price) <= 0) {
    return res.status(400).json({
      success: false,
      message: `Producto ${i + 1}: Precio unitario debe ser mayor a 0`
    });
  }
}
```

## Archivos Modificados

1. **Frontend:**
   - `src/views/frontend/LoginArtesa/src/Components/Dashboard/Pages/Orders/CreateOrderForm.jsx`

2. **Backend:**
   - `src/models/Order.js`
   - `src/controllers/branchOrderController.js`

## Prevención de Problemas Futuros

### 1. Validaciones Robustas
- Validación de productos antes del cálculo de totales
- Mensajes de error específicos por producto
- Validación de total positivo antes de insertar en DB

### 2. Logging Mejorado
- Log detallado de productos validados en `branchOrderController`
- Información de debugging para facilitar troubleshooting

### 3. Pruebas Recomendadas
- Verificar creación de órdenes desde sucursales
- Probar con productos sin precio
- Validar que mensajes de error sean claros

## Estado
✅ **RESUELTO** - El error "chk_orders_total_positive" ha sido corregido y se han implementado validaciones adicionales para prevenir problemas similares en el futuro.

---

**Fecha:** 29 de Agosto, 2025  
**Desarrollador:** GitHub Copilot  
**Prioridad:** Alta - Error bloqueante para creación de órdenes
