import React from "react";
import './listing.css';

const Listing = () => {
  const orders = [
    { id: 1, customer: "Juan Pérez", items: ["Pan Blanco", "Croissant"], total: 15.5 },
    { id: 2, customer: "María Gómez", items: ["Donas", "Pan Integral"], total: 10.0 },
  ];

  return (
    <div className="order-list">
      <h2>Órdenes Activas</h2>
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