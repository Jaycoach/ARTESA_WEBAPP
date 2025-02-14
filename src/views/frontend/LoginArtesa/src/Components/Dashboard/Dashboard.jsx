import React from 'react';
import "../../App.css";
import "./Dashboard.css";
// Importing Components ==========>
import Sidebar from "./Sidebar Section/Sidebar";
import Top from "./Body Section/Top Section/Top";
import Listing from "./Body Section/Listing Section/Listing";
import Activity from "./Body Section/Activity Section/Activity";
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