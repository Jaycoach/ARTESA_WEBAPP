import React from "react";
import "../../../../App.css";
import "./Products.css";
// Importando Componentes
import Sidebar from "../../SidebarSection/Sidebar";
import Top from "../../Body Section/TopSection/Top";
import Listing from "../../Body Section/ListingSection/Listing";
import Activity from "../../Body Section/ActivitySection/Activity";

const Products = () => {
  return (
    <div className="Products">
      <Top />
      {/* Contenedor principal con Sidebar y contenido */}
      <div className="Products-layout">
        {/* Sidebar a la izquierda */}
        <Sidebar />
        {/* Contenido a la derecha */}
        <div className="Products-content">
          <h1>Welcome to the Products</h1>
          <p>Here you can manage your products and sales.</p>
          {/* Otras secciones */}
        </div>
      </div>
    </div>
  );
};

export default Products;