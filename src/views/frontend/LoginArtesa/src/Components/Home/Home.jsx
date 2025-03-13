import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.scss';
import btn_home_1 from '../../HomeAssets/btn_home_1.png';
import btn_home_2 from '../../HomeAssets/btn_home_2.png';
import Login from '../Login/Login';

const Home = () => {
  const navigate = useNavigate();
  const user = null;
  const handleNavigation = (path) => {
    navigate(path);
  };
  return (
    <div className="home-container">
      <header className="hero-section">
        <div className="hero-content">
          <h1>Bienvenido a ARTESA</h1>
          <p>Sistema de gestión de pedidos</p>
        </div>
      </header>

      <main className="main-content">
        <section className="user-selection">
          <div className="selection-card">
            <h2>¿Eres Cliente?</h2>
            <p>Ingresa a nuestra pagina web!</p>
            <img src={btn_home_1} className="client-image" alt="Cliente Artesa" />
            <button 
              className="artesa-btn primary"
              onClick={() => window.location.href = 'https://artesa.com.co'}
            >
              {user ? 'Ir al Home' : 'Acceder como Cliente'}
            </button>
          </div>

          <div className="selection-card">
            <h2>¿Eres Empresa?</h2>
            <p>Portal Pedidos Institucional</p>
            <img src={btn_home_2} className="Institucion-image" alt="Institucion Artesa" />
            <button 
              className="artesa-btn primary"
              onClick={() => handleNavigation('/login')}
            >
              {user ? 'Ir al Login' : 'Acceder como Empresa'}
            </button>
          </div>
        </section>

        <div className="legal-notice">
          <p>Creado para LA ARTESA ®2025</p>
        </div>
      </main>
    </div>
  );
};

export default Home;