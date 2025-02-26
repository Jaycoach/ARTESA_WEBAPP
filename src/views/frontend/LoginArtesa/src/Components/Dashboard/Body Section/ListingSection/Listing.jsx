import React from "react";
import './listing.css';

const Listing = () => {
  const orders = [
    { id: 1, customer: "Lina Romero", items: ["Pan Blanco", "Croissant"], total: 15.5 },
    { id: 2, customer: "Lukas Zuniga", items: ["Donas", "Pan Integral"], total: 10.0 },
  ];

  return (
    <div className="order-list">
      <h2>Pedidos activo</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Productos</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.customer}</td>
              <td>{order.items.join(", ")}</td>
              <td>${order.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Listing;