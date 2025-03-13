import React from "react";
import "../../../../App.scss";

const OrderList = () => {
  const orders = [
    { id: "A1023", status: "Pending", items: "10x White Bread" },
    { id: "A1022", status: "Completed", items: "5x Artisan Baguette" },
    { id: "A1019", status: "Canceled", items: "2x Croissant Pack" },
  ];

  return (
    <div className="order-list">
      <h2>📋 My Orders</h2>
      <ul>
        {orders.map((order) => (
          <li key={order.id} className={`order-item ${order.status.toLowerCase()}`}>
            <span>🔹 {order.items}</span>
            <span className="status">{order.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OrderList;