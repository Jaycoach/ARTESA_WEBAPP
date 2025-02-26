import React from 'react';
import "../../App.css";
import "./Dashboard.css";
// Importing Components ==========>
import Sidebar from "./SidebarSection/Sidebar";
import Top from "./Body Section/TopSection/Top";
import Listing from "./Body Section/ListingSection/Listing";
import Activity from "./Body Section/ActivitySection/Activity";
import { createContext, useState, useContext } from "react";
import { FaUserCircle } from "react-icons/fa";

const Dashboard = () => {
  return (
    <div className="dashboard">
      {/* Contenedor principal con Sidebar y contenido */}
      <div className="dashboard-layout">
        {/* Sidebar a la izquierda */}
        <Sidebar />

        {/* Contenido a la derecha */}
        <div className="dashboard-content">
          <h1>Welcome to the Dashboard</h1>
          <p>Here you can manage your products and sales.</p>

          {/* Aquí puedes agregar más secciones del dashboard */}
          <Top />
          <Listing />
          <Activity />
        </div>
      </div>
    </div>
  );
};
export default Dashboard;