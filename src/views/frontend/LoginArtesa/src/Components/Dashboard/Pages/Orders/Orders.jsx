import React, { useState } from "react";
import "./Orders.scss";

const OrderForm = () => {
  const [order, setOrder] = useState({
    customerName: "",
    items: [],
    total: 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Orden creada:", order);
    // Aquí puedes enviar la orden al backend
  };

  return (
    <div className="order-form">
      <h2>Crear Nueva Orden</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre del Cliente:</label>
          <input
            type="text"
            value={order.customerName}
            onChange={(e) => setOrder({ ...order, customerName: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Productos:</label>
          <select
            onChange={(e) => {
              const selectedItem = e.target.value;
              setOrder({
                ...order,
                items: [...order.items, selectedItem],
              });
            }}
          >
            <option value="Pan Blanco">Pan Blanco</option>
            <option value="Pan Integral">Pan Integral</option>
            <option value="Croissant">Croissant</option>
            <option value="Donas">Donas</option>
          </select>
          <ul>
            {order.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="form-group">
          <label>Total:</label>
          <input
            type="number"
            value={order.total}
            onChange={(e) => setOrder({ ...order, total: parseFloat(e.target.value) })}
            required
          />
        </div>

        <button type="submit">Crear Pedido</button>
      </form>
    </div>
  );
};

export default OrderForm;