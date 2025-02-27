import React, { useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.scss';
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
          <h1>Bienvenido a ARTERSA</h1>
          <p></p>
        </div>
      </header>

      <main className="main-content">
        <section className="user-selection">
          <div className="selection-card">
            <h2>¿Eres Cliente?</h2>
            <p>Ingresa a nuestra pagina web!</p>
            <button 
              className="artesa-btn primary"
            >
              {user ? 'Ir al Home' : 'Acceder como Cliente'}
            </button>
          </div>

          <div className="selection-card">
            <h2>¿Eres Empresa?</h2>
            <p>Compras Empresariales, portal transaccional</p>
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